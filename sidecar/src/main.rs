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
//!                                 Three locks of its own (D-094): the x-zarcade-service
//!                                 token when ZARCADE_SEND_TOKEN is set, the game's own
//!                                 policy (house addresses only, exactly 1,000 zatoshis),
//!                                 and a daily budget that survives restarts.
//!                                 Answers 409 with `code: "settling"` when the house owns
//!                                 the money but the last payment is not mined yet.
//! - GET  /history?limit=N      -> the payments this wallet broadcast, newest first:
//!                                 txid, kind, amount, mined block (D-093). Read-only
//!                                 public facts, the supply for The Crowd's record book.
//! - GET  /merchant             -> cabinet four's window (SCOPE-CABINET-4.md 2.3): the
//!                                 payments the merchant account received, read with its
//!                                 incoming viewing key only. Amount, address, memo,
//!                                 block, transaction id. No sender, no key, no balance.
//! - GET  /merchant/verify?txid=…&output=…
//!                              -> proves ONE of those receipts against the chain
//!                                 (SCOPE-CABINET-4.md 2.4) and returns the result only.
//!                                 The note's plaintext never crosses this boundary, and
//!                                 two of the returned checks are the ones that say so.
//! - POST /admin/split          -> { notes, per_note } -> one transaction that breaks the pot
//!                                 into many small confirmed notes (D-031). Maintenance only:
//!                                 needs the x-zarcade-admin token and is never proxied by the
//!                                 bridge, so no player request can reach it.

mod cache;
mod history;
mod policy;
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
    /// `None` until the background startup task has the wallet open. The door
    /// binds first so the platform always gets an answer; while the wallet is
    /// still waking up every route that needs it says so plainly (D-085).
    wallet: Mutex<Option<HouseWallet>>,
    refilling: AtomicBool,
    /// Outcome of the most recent pot split, for operators who cannot read the
    /// container log (D-086). None until a split has finished or failed.
    last_split: Mutex<Option<String>>,
    /// How many payments this wallet has broadcast today, kept on disk so a
    /// restart cannot clear it (D-094). This is the durable treasury control;
    /// the website's in-memory rate limits are anti-abuse on top of it.
    budget: Mutex<policy::SendBudget>,
    /// The ledger of payments this wallet broadcast, newest first (D-093).
    /// The Crowd's record book is served from it, and it lives on disk so a
    /// restart cannot lose the arcade's own history.
    history: Mutex<history::SendHistory>,
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

/// The sentence a caller gets when the wallet has not finished waking up yet
/// (D-085). Same grandma rule as REFILLING: plain, says what to do, hides the
/// machinery. The website turns `code: "warming"` into a friendly "the house
/// wallet is starting up" instead of a hard error.
const WARMING: &str = "The house wallet is still waking up. Please try again in a moment.";

fn warming() -> Response {
    (
        StatusCode::SERVICE_UNAVAILABLE,
        Json(json!({ "ok": false, "code": "warming", "error": WARMING })),
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
    // `ready` tells the website whether the wallet is open yet (D-085). While
    // it is still waking up, synced_to is null and ready is false, which is
    // honest and lets the arcade say "warming up" instead of showing a dead
    // spinner. A busy lock (a send or split holds it) still means the wallet
    // exists, so that counts as ready.
    let (synced_to, ready) = if refilling {
        (None, true)
    } else {
        match tokio::time::timeout(HEALTH_LOCK_TIMEOUT, state.wallet.lock()).await {
            Ok(guard) => match guard.as_ref() {
                Some(w) => (w.synced_height().ok(), true),
                None => (None, false),
            },
            Err(_) => (None, true),
        }
    };
    let last_split = state.last_split.lock().await.clone();
    let budget = state.budget.lock().await;
    Json(json!({
        "ok": true,
        "service": "zarcade-sidecar",
        "network": "testnet",
        // Null means "the wallet is busy or still waking up", not "unknown chain".
        "synced_to": synced_to,
        "ready": ready,
        "refilling": refilling,
        // Null until a split has finished or failed (D-086).
        "last_split": last_split,
        // Durable spend accounting (D-094), visible without reading the log.
        "sends_today": budget.sent_today(),
        "daily_send_cap": budget.cap(),
    }))
    .into_response()
}

async fn address(State(state): Shared) -> Response {
    let guard = state.wallet.lock().await;
    let Some(w) = guard.as_ref() else {
        return warming();
    };
    Json(json!({
        "ok": true,
        "network": "testnet",
        "address": w.address(),
    }))
    .into_response()
}

async fn transparent_address(State(state): Shared) -> Response {
    let guard = state.wallet.lock().await;
    let Some(w) = guard.as_ref() else {
        return warming();
    };
    Json(json!({
        "ok": true,
        "network": "testnet",
        "address": w.transparent_address(),
    }))
    .into_response()
}

async fn balance(State(state): Shared) -> Response {
    let mut guard = state.wallet.lock().await;
    let Some(w) = guard.as_mut() else {
        return warming();
    };
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
    let mut guard = state.wallet.lock().await;
    let Some(w) = guard.as_mut() else {
        return warming();
    };
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

async fn send(State(state): Shared, headers: HeaderMap, Json(req): Json<SendRequest>) -> Response {
    // Lock one (D-094): the service token, checked before anything else, even
    // before the refilling flag, so an unauthenticated caller learns nothing
    // about the wallet's state. Armed only when ZARCADE_SEND_TOKEN is set;
    // unset means this lock is off and the two locks below still hold.
    let expected = std::env::var("ZARCADE_SEND_TOKEN").ok();
    let supplied = headers
        .get("x-zarcade-service")
        .and_then(|v| v.to_str().ok());
    if !policy::service_token_ok(expected.as_deref(), supplied) {
        return fail(StatusCode::FORBIDDEN, "missing or wrong service token");
    }
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
    let mut guard = state.wallet.lock().await;
    let Some(w) = guard.as_mut() else {
        return warming();
    };
    // Lock two (D-094): the game's own policy, enforced here instead of
    // trusted from the caller. The money can only ever go to one of the
    // arcade's own three addresses, and only in the fixed round amount, so
    // nobody who reaches this door can aim a payment anywhere else. The third
    // address is cabinet four's merchant account (SCOPE-CABINET-4.md 2.1).
    if let Err(e) = policy::check_send(
        &req.to,
        req.zatoshis,
        w.address(),
        w.transparent_address(),
        w.merchant_address(),
    ) {
        return fail(StatusCode::FORBIDDEN, e.to_string());
    }
    // Lock three (D-094): the durable daily budget. The website keeps its own
    // in-memory limits, but those die with the process; this counter lives on
    // the wallet's disk and survives every restart.
    {
        let budget = state.budget.lock().await;
        if budget.exhausted() {
            return (
                StatusCode::TOO_MANY_REQUESTS,
                Json(json!({
                    "ok": false,
                    "code": "daily_budget",
                    "error": format!(
                        "The wallet has made its {} payments for today. Try again tomorrow.",
                        budget.cap()
                    ),
                })),
            )
                .into_response();
        }
    }
    match w.send(&req.to, req.zatoshis, req.memo.as_deref()).await {
        Ok(txid) => {
            // Count only a payment that was really built and broadcast, and
            // write it into the ledger The Crowd is served from (D-093). The
            // policy above guarantees `to` is one of the house's own addresses.
            state.budget.lock().await.record_send();
            if let Some(kind) = history::kind_for(&req.to, w.address(), w.transparent_address()) {
                let sent_at = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_secs())
                    .unwrap_or(0);
                state.history.lock().await.record(history::HistoryEntry {
                    txid: txid.clone(),
                    kind: kind.to_string(),
                    zatoshis: req.zatoshis,
                    sent_at,
                    block: None,
                });
            }
            Json(json!({
                "ok": true,
                "txid": txid,
                "explorer": format!("{EXPLORER_TX_BASE}/{txid}"),
            }))
            .into_response()
        },
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
struct HistoryQuery {
    limit: Option<usize>,
}

/// The payments this wallet broadcast, newest first, in facts the chain
/// already shows anyone (D-093). Read-only, never moves money, and holds no
/// secrets: an open payment is exactly the kind that reveals its own
/// destination. A missing mined height is filled in from the wallet the
/// first time it is asked and then cached in the ledger on disk, so the
/// network is never asked twice about the same payment.
async fn send_history(State(state): Shared, Query(q): Query<HistoryQuery>) -> Response {
    let limit = q.limit.unwrap_or(8).clamp(1, 20);
    let mut guard = state.wallet.lock().await;
    let Some(w) = guard.as_mut() else {
        return warming();
    };
    let mut ledger = state.history.lock().await;
    // Snapshot first: enriching writes back into the ledger, and one borrow
    // cannot do both at once.
    let snapshot: Vec<history::HistoryEntry> =
        ledger.entries().iter().take(limit).cloned().collect();
    let mut entries = Vec::with_capacity(snapshot.len());
    for entry in snapshot {
        let mut block = entry.block;
        if block.is_none() {
            if let Ok(s) = w.tx_status(&entry.txid).await {
                if let Some(h) = s.mined_height {
                    block = Some(u64::from(h));
                    ledger.set_block(&entry.txid, u64::from(h));
                }
            }
        }
        entries.push(json!({
            "txid": entry.txid,
            "kind": entry.kind,
            "zatoshis": entry.zatoshis,
            "block": block,
            "url": format!("{EXPLORER_TX_BASE}/{}", entry.txid),
        }));
    }
    Json(json!({ "ok": true, "entries": entries })).into_response()
}

/// Cabinet four's read-only window (SCOPE-CABINET-4.md 2.3).
///
/// Everything in this response came out of a note that the merchant account's
/// incoming viewing key decrypted. There is no key material in it, no
/// nullifier, no sender, no balance, and no write path: the cabinet looks
/// through this window and cannot reach through it.
///
/// A row appears only when a payment is really on the chain. While the deposit
/// is still travelling, the row list is empty, and the cabinet says so instead
/// of pretending.
async fn merchant(State(state): Shared) -> Response {
    let mut guard = state.wallet.lock().await;
    let Some(w) = guard.as_mut() else {
        return warming();
    };
    match w.merchant_scan().await {
        Ok(scan) => Json(json!({
            "ok": true,
            "network": "testnet",
            "merchant": scan,
        }))
        .into_response(),
        Err(e) => fail(StatusCode::BAD_GATEWAY, e),
    }
}

#[derive(Deserialize)]
struct VerifyQuery {
    txid: String,
    output: Option<u32>,
}

/// Cabinet four's verifier (SCOPE-CABINET-4.md 2.4, build step 3).
///
/// The partner beat asks one question: did that deposit really arrive, and does
/// the chain itself vouch for the amount and the memo on it? This route answers
/// with the result of that check and nothing more. The note's plaintext, which
/// is what makes the check possible, stays inside the sidecar; the last two
/// checks in the response are the ones that prove it stayed.
///
/// Two properties worth stating plainly. It is a GET, because reading is all it
/// does and no secret rides in the query. And it cannot be pointed at arbitrary
/// chain data: the transaction has to be one the merchant's incoming-only scan
/// already decrypted for the merchant's own address.
///
/// Callers are expected to ask GET /merchant first and verify a row they were
/// really given. An error here therefore never means "no such payment"; it
/// means the check could not be completed, and the cabinet says so rather than
/// showing a verdict it does not have.
async fn verify_receipt(State(state): Shared, Query(q): Query<VerifyQuery>) -> Response {
    let Some(output) = q.output else {
        return fail(
            StatusCode::BAD_REQUEST,
            "the output index is required: ?txid=<64 hex>&output=<index>",
        );
    };
    let mut guard = state.wallet.lock().await;
    let Some(w) = guard.as_mut() else {
        return warming();
    };
    match w.merchant_verify(&q.txid, output).await {
        Ok(result) => Json(json!({
            "ok": true,
            "network": "testnet",
            "verification": result,
        }))
        .into_response(),
        Err(e) => fail(StatusCode::BAD_GATEWAY, e),
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
    // The split runs in a background task and this handler answers immediately
    // (D-086). A pot split holds the wallet for about eight minutes; a rented
    // home's front door stops waiting long before that and cuts the connection,
    // which cancels the split before it starts. Returning at once and letting
    // the caller poll /health (refilling, last_split) is what those flags are for.
    let state2 = state.clone();
    let notes = req.notes;
    let per_note = req.per_note;
    tokio::spawn(async move {
        // Clears the refilling flag on every way out of this task, panic included.
        let _guard = RefillGuard(&state2.refilling);
        let mut guard = state2.wallet.lock().await;
        let Some(w) = guard.as_mut() else {
            let msg = "skipped: house wallet was still waking up".to_string();
            println!("pot split {msg}");
            *state2.last_split.lock().await = Some(msg);
            return;
        };
        let outcome = match w.split_pot(notes, per_note).await {
            Ok(txid) => {
                let msg = format!("complete: {txid} ({notes} notes of {per_note} zatoshis each)");
                println!("pot split {msg}");
                msg
            }
            Err(e) => {
                let msg = format!("failed: {e}");
                println!("pot split {msg}");
                msg
            }
        };
        *state2.last_split.lock().await = Some(outcome);
    });

    (
        StatusCode::ACCEPTED,
        Json(json!({
            "ok": true,
            "started": true,
            "notes": req.notes,
            "per_note_zatoshis": req.per_note,
            "poll": "/health",
        })),
    )
        .into_response()
}

#[derive(Deserialize)]
struct TxStatusQuery {
    txid: String,
}

/// Where a payment landed, as a fact rather than a timer. Read-only, never moves
/// money, and once the payment is mined it never touches the network, so the game
/// can keep asking while the next player's round is being built (D-031, C).
async fn tx_status(State(state): Shared, Query(q): Query<TxStatusQuery>) -> Response {
    let mut guard = state.wallet.lock().await;
    let Some(w) = guard.as_mut() else {
        return warming();
    };
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

#[derive(Deserialize)]
struct GateQuery {
    txid: Option<String>,
    index: Option<u32>,
}

/// GATE ONLY (SCOPE-CABINET-4.md section 3). Reads one received note from a
/// second, read-only SQLite connection and verifies it against the chain.
///
/// It is registered only when the process is started with ZARCADE_GATE=1,
/// because its payload includes the note's randomness. The shipped cabinet
/// will call a verifier that returns the result, never this plaintext.
async fn gate_disclosure(State(state): Shared, Query(q): Query<GateQuery>) -> Response {
    let mut guard = state.wallet.lock().await;
    let Some(w) = guard.as_mut() else {
        return warming();
    };
    match w.disclosure_report(q.txid.as_deref(), q.index).await {
        Ok(report) => Json(json!({ "ok": true, "report": report })).into_response(),
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

    // The wallet data lives in ./data under the working directory by default.
    // ZARCADE_DATA_DIR overrides it, which is how a rented home (D-081)
    // points the sidecar at its persistent volume without changing local runs.
    let data_dir = match std::env::var("ZARCADE_DATA_DIR") {
        Ok(dir) => std::path::PathBuf::from(dir),
        Err(_) => std::env::current_dir()
            .expect("cannot determine working directory")
            .join("data"),
    };

    // Bind the door BEFORE the wallet is open (D-085). The first Railway deploy
    // froze here: init blocked on lightwalletd with no deadline, so the listener
    // never bound and every request answered 502 with a silent log. Opening the
    // door first means the platform always gets an answer, /health reports
    // ready:false while the wallet wakes, and a background task keeps retrying.
    let port = std::env::var("PORT").unwrap_or_else(|_| "9070".to_string());
    // A rented home sets PORT and reaches us over its own network, not loopback,
    // so listen on all interfaces. Without PORT (local dev) stay localhost-only.
    // ZARCADE_SIDECAR_BIND still wins if the operator pins it explicitly.
    let bind_host = std::env::var("ZARCADE_SIDECAR_BIND").unwrap_or_else(|_| {
        if std::env::var("PORT").is_ok() {
            "0.0.0.0".to_string()
        } else {
            "127.0.0.1".to_string()
        }
    });
    let bind_addr = format!("{bind_host}:{port}");
    let listener = tokio::net::TcpListener::bind(&bind_addr)
        .await
        .unwrap_or_else(|e| panic!("cannot bind to {bind_addr}: {e}"));
    println!("zarcade-sidecar listening on http://{bind_addr}");

    // D-094: announce the send door's locks at startup, so an operator can
    // see in the deploy log alone whether the token is armed.
    match std::env::var("ZARCADE_SEND_TOKEN") {
        Ok(t) if !t.is_empty() => {
            println!("service token armed: /send requires x-zarcade-service");
        }
        _ => println!(
            "warning: ZARCADE_SEND_TOKEN is not set, so the /send token lock is OFF \
             (the destination and amount policy and the daily budget still hold)"
        ),
    }
    let budget = policy::SendBudget::load(&data_dir, policy::SendBudget::cap_from_env());
    println!(
        "daily send budget: {} payments per UTC day, {} already sent today",
        budget.cap(),
        budget.sent_today()
    );
    let ledger = history::SendHistory::load(&data_dir);
    println!(
        "round history ledger: {} payments recorded",
        ledger.entries().len()
    );

    let state = Arc::new(AppState {
        wallet: Mutex::new(None),
        refilling: AtomicBool::new(false),
        last_split: Mutex::new(None),
        budget: Mutex::new(budget),
        history: Mutex::new(ledger),
    });

    // Research mode for the cabinet-four gate. The gate verifies a transaction
    // directly against lightwalletd, so it does not need the household scan;
    // skipping it here avoids blocking the gate behind a half-hour scan of
    // blocks it never reads. This mode is never set in production.
    let gate_enabled = std::env::var("ZARCADE_GATE").ok().as_deref() == Some("1");

    // Background startup: open the wallet, then keep it. On failure, retry with
    // a short capped backoff so a transient network blip self-heals instead of
    // leaving the service permanently "warming up". The door is already open,
    // so this never blocks a request.
    {
        let state = state.clone();
        let data_dir = data_dir.clone();
        tokio::spawn(async move {
            let mut attempt: u32 = 0;
            loop {
                attempt += 1;
                println!("opening house wallet (attempt {attempt}, data dir {data_dir:?})");
                match HouseWallet::init(&data_dir).await {
                    Ok(mut house) => {
                        println!("house wallet ready; deposit address:\n  {}", house.address());
                        println!(
                            "merchant address (cabinet four):\n  {}",
                            house.merchant_address()
                        );
                        if gate_enabled {
                            println!(
                                "gate mode: skipping the initial scan; the gate reads its transaction from lightwalletd directly"
                            );
                        } else {
                            // One initial sync so the first request is fast; failures
                            // are not fatal (every balance/send syncs on demand).
                            match house.sync().await {
                                Ok(h) => println!("initial sync complete up to height {h}"),
                                Err(e) => {
                                    println!("initial sync failed, will retry on demand: {e}")
                                }
                            }
                        }
                        *state.wallet.lock().await = Some(house);
                        println!("house wallet is live");
                        break;
                    }
                    Err(e) => {
                        let wait = std::cmp::min(5 * attempt, 30);
                        println!("house wallet not ready: {e}; retrying in {wait}s");
                        tokio::time::sleep(std::time::Duration::from_secs(wait as u64)).await;
                    }
                }
            }
        });
    }

    let app = Router::new()
        .route("/health", get(health))
        .route("/address", get(address))
        .route("/transparent-address", get(transparent_address))
        .route("/balance", get(balance))
        .route("/tx-status", get(tx_status))
        .route("/sync", post(sync_now))
        .route("/send", post(send))
        .route("/history", get(send_history))
        .route("/merchant", get(merchant))
        .route("/merchant/verify", get(verify_receipt))
        .route("/admin/split", post(admin_split));

    // The gate's payload includes a note's randomness, so the route only
    // exists when the operator deliberately asks for it.
    let app = if gate_enabled {
        app.route("/gate/disclosure", get(gate_disclosure))
    } else {
        app
    }
    .with_state(state);

    axum::serve(listener, app).await.expect("server crashed");
}
