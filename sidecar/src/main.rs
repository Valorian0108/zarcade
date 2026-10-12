//! Zarcade sidecar: a localhost-only HTTP helper that holds the house wallet
//! (DECISIONS D-024, D-025). The Next.js app talks to this; players never do.
//!
//! Endpoints (all JSON):
//! - GET  /health               -> liveness + synced height
//! - GET  /address              -> the house deposit address (for faucets)
//! - GET  /transparent-address  -> the house's own transparent address (D-030)
//! - GET  /balance              -> syncs, then reports total, spendable and pending change
//! - GET  /tx-status?txid=…     -> where one payment landed: block height and confirmations
//! - POST /sync                 -> sync the wallet to the chain tip
//! - POST /send                 -> { to, zatoshis, memo? } -> tiny fixed-amount transfer.
//!                                 Answers 409 with `code: "settling"` when the house owns
//!                                 the money but the last payment is not mined yet.
//! - POST /admin/split          -> { notes, per_note } -> one transaction that breaks the pot
//!                                 into many small confirmed notes (D-031). Maintenance only:
//!                                 needs the x-zarcade-admin token and is never proxied by the
//!                                 bridge, so no player request can reach it.

mod cache;
mod wallet;

use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};

use axum::{
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::json;
use tokio::sync::Mutex;

use wallet::{HouseWallet, SendError};

/// Everything the handlers share.
///
/// The wallet sits behind one mutex because it builds a single transaction at a
/// time. The `refilling` flag deliberately sits OUTSIDE that mutex: a pot split
/// holds the wallet for about eight minutes, so anything that needed the mutex
/// in order to answer would queue behind the split and the player would just see
/// a spinner. This way a round request can be refused instantly, with the truth,
/// while the refill is still running.
struct AppState {
    wallet: Mutex<HouseWallet>,
    refilling: AtomicBool,
}

type Shared = State<Arc<AppState>>;

/// Clears the refilling flag when it goes out of scope, so that a split which
/// fails, or panics, cannot leave the arcade permanently telling players it is
/// refilling.
struct RefillGuard<'a>(&'a AtomicBool);

impl Drop for RefillGuard<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::SeqCst);
    }
}

/// The sentence a player sees if they press the button during a refill. It goes
/// through the bridge, so it has to obey the grandma rule: no jargon, and it says
/// what to do rather than what broke.
const REFILLING: &str = "The arcade is refilling its coins. Please try again in a few minutes.";

fn fail(status: StatusCode, message: impl Into<String>) -> Response {
    (
        status,
        Json(json!({ "ok": false, "error": message.into() })),
    )
        .into_response()
}

fn zec_str(zatoshis: u64) -> String {
    format!(
        "{}.{:08}",
        zatoshis / 100_000_000,
        zatoshis % 100_000_000
    )
}

/// Liveness, plus the one thing an operator needs at a glance: is a refill
/// running.
///
/// Two deliberate choices here.
///
/// The refilling flag is read WITHOUT touching the wallet, which keeps this the
/// one endpoint that answers instantly even in the middle of an eight-minute
/// split. Every other route needs the wallet mutex and so queues behind it.
///
/// The height lookup is given a short deadline rather than awaited indefinitely.
/// A health endpoint that hangs is worse than one that admits it could not read
/// the height, and `synced_to` being null is honest: the wallet is busy. This is
/// also the only way to observe the flag without side effects, which matters
/// because the alternative, probing `/admin/split`, starts a real split if no
/// refill happens to be running.
const HEALTH_LOCK_TIMEOUT: std::time::Duration = std::time::Duration::from_millis(500);

async fn health(State(state): Shared) -> Response {
    let refilling = state.refilling.load(Ordering::SeqCst);
    // While a refill holds the wallet the height simply cannot be read, so there
    // is no point paying the lock deadline to find that out. Skipping the wait is
    // what keeps this endpoint fast at the exact moment someone is most likely to
    // be asking "is it still going?".
    let synced_to = if refilling {
        None
    } else {
        match tokio::time::timeout(HEALTH_LOCK_TIMEOUT, state.wallet.lock()).await {
            Ok(w) => w.synced_height().ok(),
            Err(_) => None,
        }
    };
    Json(json!({
        "ok": true,
        "service": "zarcade-sidecar",
        "network": "testnet",
        // Null means "the wallet is busy", not "unknown chain".
        "synced_to": synced_to,
        "refilling": refilling,
    }))
    .into_response()
}

async fn address(State(state): Shared) -> Response {
    let w = state.wallet.lock().await;
    Json(json!({
        "ok": true,
        "network": "testnet",
        "address": w.address(),
    }))
    .into_response()
}

async fn transparent_address(State(state): Shared) -> Response {
    let w = state.wallet.lock().await;
    Json(json!({
        "ok": true,
        "network": "testnet",
        "address": w.transparent_address(),
    }))
    .into_response()
}

async fn balance(State(state): Shared) -> Response {
    let mut w = state.wallet.lock().await;
    let synced_to = match w.sync().await {
        Ok(h) => h,
        Err(e) => return fail(StatusCode::BAD_GATEWAY, e),
    };
    match w.balances() {
        Ok(b) => Json(json!({
            "ok": true,
            "zatoshis": b.total,
            "zec": zec_str(b.total),
            // The split is the useful part. `spendable_zatoshis` is what a round
            // can actually be built from; `pending_change_zatoshis` is money the
            // house owns but cannot touch until its last payment is mined.
            "spendable_zatoshis": b.spendable,
            "pending_change_zatoshis": b.pending_change,
            "transparent_zatoshis": b.transparent,
            "synced_to": synced_to,
        }))
        .into_response(),
        Err(e) => fail(StatusCode::INTERNAL_SERVER_ERROR, e),
    }
}

async fn sync_now(State(state): Shared) -> Response {
    let mut w = state.wallet.lock().await;
    match w.sync().await {
        Ok(h) => Json(json!({ "ok": true, "synced_to": h })).into_response(),
        Err(e) => fail(StatusCode::BAD_GATEWAY, e),
    }
}

#[derive(Deserialize)]
struct SendRequest {
    to: String,
    zatoshis: u64,
    memo: Option<String>,
}

/// Explorer base for the "see it with your own eyes" link shown after a send.
/// It must be an explorer that indexes the CANONICAL NU7 testnet (D-027).
/// `testnet.zecblock.com` was verified block-for-block against
/// `testnet.zec.rocks`, and it confirmed our own send in block 4,488,884.
/// The previously used `zexplorer.app` indexes the abandoned pre-NU7 fork, so
/// every link it produced for our transactions would have been a dead end.
const EXPLORER_TX_BASE: &str = "https://testnet.zecblock.com/tx";

async fn send(State(state): Shared, Json(req): Json<SendRequest>) -> Response {
    // Checked before taking the wallet lock, which is the whole point. A split
    // holds that lock for about eight minutes, so waiting for it would leave the
    // player watching a spinner and then handing them a timeout that may not even
    // be true: the wallet would still carry out the request afterwards.
    if state.refilling.load(Ordering::SeqCst) {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({ "ok": false, "code": "refilling", "error": REFILLING })),
        )
            .into_response();
    }
    let mut w = state.wallet.lock().await;
    match w.send(&req.to, req.zatoshis, req.memo.as_deref()).await {
        Ok(txid) => Json(json!({
            "ok": true,
            "txid": txid,
            "explorer": format!("{EXPLORER_TX_BASE}/{txid}"),
        }))
        .into_response(),
        // A distinct status and a machine-readable code, because this one is not
        // a mistake and not a failure: the money is real and on its way, the
        // wallet just may not spend it until the network has agreed. The caller
        // turns the numbers into a sentence a player can act on.
        Err(SendError::Settling(b)) => (
            StatusCode::CONFLICT,
            Json(json!({
                "ok": false,
                "code": "settling",
                "error": SendError::Settling(b).to_string(),
                "spendable_zatoshis": b.spendable,
                "pending_change_zatoshis": b.pending_change,
                "total_zatoshis": b.total,
            })),
        )
            .into_response(),
        Err(e) => fail(StatusCode::BAD_REQUEST, e.to_string()),
    }
}

#[derive(Deserialize)]
struct SplitRequest {
    notes: usize,
    per_note: u64,
}

/// D-031 setup: split the pot into many small confirmed notes so that rounds can
/// follow back to back. This is a MAINTENANCE action, run by hand before a
/// session, never by the game.
///
/// Three layers keep it out of reach:
///  1. The sidecar binds 127.0.0.1 only, so nothing outside this machine can
///     call it at all.
///  2. The Next.js bridge does not proxy it. `lib/zcash/sidecar.ts` exposes
///     exactly two sidecar calls and neither is this one, so no browser request
///     can reach it however it is phrased.
///  3. It requires `x-zarcade-admin` to match `ZARCADE_ADMIN_TOKEN`. With that
///     variable unset the endpoint is disabled outright rather than open.
///
/// Even if all three were bypassed it cannot steal: every note it creates is
/// paid to the house's own shielded address, so the worst case is a burnt fee.
async fn admin_split(
    State(state): Shared,
    headers: HeaderMap,
    Json(req): Json<SplitRequest>,
) -> Response {
    let expected = match std::env::var("ZARCADE_ADMIN_TOKEN") {
        Ok(t) if !t.is_empty() => t,
        _ => {
            return fail(
                StatusCode::SERVICE_UNAVAILABLE,
                "admin is disabled: set ZARCADE_ADMIN_TOKEN before starting the sidecar",
            )
        }
    };
    let supplied = headers
        .get("x-zarcade-admin")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if supplied != expected {
        return fail(StatusCode::FORBIDDEN, "missing or wrong admin token");
    }

    // One refill at a time. Without this a second call would simply queue behind
    // the first and then run again, paying the fee twice for no benefit.
    if state
        .refilling
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return (
            StatusCode::CONFLICT,
            Json(json!({ "ok": false, "code": "refilling", "error": "a refill is already running" })),
        )
            .into_response();
    }
    // Clears the flag on every way out of this function, including a panic.
    let _guard = RefillGuard(&state.refilling);

    let mut w = state.wallet.lock().await;
    match w.split_pot(req.notes, req.per_note).await {
        Ok(txid) => Json(json!({
            "ok": true,
            "txid": txid,
            "notes": req.notes,
            "per_note_zatoshis": req.per_note,
            "explorer": format!("{EXPLORER_TX_BASE}/{txid}"),
        }))
        .into_response(),
        Err(SendError::Settling(b)) => (
            StatusCode::CONFLICT,
            Json(json!({
                "ok": false,
                "code": "settling",
                "error": SendError::Settling(b).to_string(),
                "spendable_zatoshis": b.spendable,
                "pending_change_zatoshis": b.pending_change,
                "total_zatoshis": b.total,
            })),
        )
            .into_response(),
        Err(e) => fail(StatusCode::BAD_REQUEST, e.to_string()),
    }
}

#[derive(Deserialize)]
struct TxStatusQuery {
    txid: String,
}

/// Where a payment landed, as a fact rather than a timer. Read-only, never moves
/// money, and once the payment is mined it never touches the network, so the game
/// can keep asking while the next player's round is being built (D-031, C).
async fn tx_status(State(state): Shared, Query(q): Query<TxStatusQuery>) -> Response {
    let mut w = state.wallet.lock().await;
    match w.tx_status(&q.txid).await {
        Ok(s) => Json(json!({
            "ok": true,
            "txid": q.txid,
            // `landed` is the one bit the game needs: has the network put this
            // payment in a block yet.
            "landed": s.mined_height.is_some(),
            "mined_height": s.mined_height,
            "confirmations": s.confirmations,
            "tip": s.tip,
            "explorer": format!("{EXPLORER_TX_BASE}/{}", q.txid),
        }))
        .into_response(),
        Err(e) => fail(StatusCode::BAD_REQUEST, e),
    }
}

#[tokio::main]
async fn main() {
    // rustls cannot guess which crypto engine to use when more than one (or
    // zero) are compiled in; we installed "ring" via Cargo features and must
    // select it once, before any TLS connection is made.
    rustls::crypto::ring::default_provider()
        .install_default()
        .expect("failed to install the TLS crypto provider");

    let data_dir = std::env::current_dir()
        .expect("cannot determine working directory")
        .join("data");

    let mut house = HouseWallet::init(&data_dir)
        .await
        .unwrap_or_else(|e| panic!("zarcade-sidecar could not start: {e}"));

    println!("house wallet ready; deposit address:\n  {}", house.address());

    // One initial sync so the first request is fast; failures are not fatal
    // (every balance/send syncs again on demand).
    match house.sync().await {
        Ok(h) => println!("initial sync complete up to height {h}"),
        Err(e) => println!("initial sync failed, will retry on demand: {e}"),
    }

    let app = Router::new()
        .route("/health", get(health))
        .route("/address", get(address))
        .route("/transparent-address", get(transparent_address))
        .route("/balance", get(balance))
        .route("/tx-status", get(tx_status))
        .route("/sync", post(sync_now))
        .route("/send", post(send))
        .route("/admin/split", post(admin_split))
        .with_state(Arc::new(AppState {
            wallet: Mutex::new(house),
            refilling: AtomicBool::new(false),
        }));

    // Localhost only: the sidecar is never exposed to players directly.
    let listener = tokio::net::TcpListener::bind("127.0.0.1:9070")
        .await
        .expect("cannot bind to 127.0.0.1:9070");
    println!("zarcade-sidecar listening on http://127.0.0.1:9070");
    axum::serve(listener, app).await.expect("server crashed");
}
