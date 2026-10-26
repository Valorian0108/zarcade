//! The house wallet: one shielded testnet account that funds the games.
//!
//! Lifecycle:
//! - A 32-byte seed is generated once and stored as hex in the data dir
//!   (testnet-only house wallet per DECISIONS D-025; the key never leaves
//!   this server).
//! - The wallet DB (SQLite) is initialized/migrated on every start.
//! - The account "house" is created once, with its birthday set to the
//!   current chain tip, so the first sync only covers new blocks instead of
//!   the whole testnet history.
//! - The ZIP-32 account index is always 0: this sidecar creates exactly one
//!   account from one seed.
//! - The deposit address is generated once and stored in a file so it does
//!   not rotate across restarts (faucet payouts must keep working).

use std::num::NonZeroU32;
use std::path::{Path, PathBuf};

use orchard::{
    keys::{Diversifier, PreparedIncomingViewingKey},
    note::{ExtractedNoteCommitment, Note as OrchardNote, NoteVersion as OrchardNoteVersion, Nullifier as OrchardNullifier, RandomSeed, Rho},
    note_encryption::{CompactAction, IronwoodDomain},
    value::NoteValue,
};
use rand::rngs::SysRng;
use rand_core::{Rng as _, UnwrapErr};
use secrecy::Secret;
use shardtree::error::ShardTreeError;
use zcash_client_backend::{
    data_api::{
        chain::ChainState,
        wallet::{
            create_proposed_transactions,
            input_selection::{GreedyInputSelector, SpendPolicy},
            propose_standard_transfer_to_address, propose_transfer, ConfirmationsPolicy,
            SpendingKeys,
        },
        Account as _, AccountBirthday, InputSource, WalletRead, WalletWrite,
    },
    fees::{standard::SingleOutputChangeStrategy, DustOutputPolicy, StandardFeeRule},
    proposal::Proposal,
    proto::{
        compact_formats::CompactOrchardAction,
        service::{self, compact_tx_streamer_client::CompactTxStreamerClient},
    },
    sync,
    wallet::OvkPolicy,
};
use zcash_client_sqlite::{
    util::SystemClock, wallet::commitment_tree, wallet::init::init_wallet_db, AccountUuid, WalletDb,
};
use zcash_keys::{
    address::Address,
    keys::{UnifiedAddressRequest, UnifiedIncomingViewingKey, UnifiedSpendingKey},
};
// The cabinet-four merchant scan trial-decrypts notes with an incoming viewing
// key only (SCOPE-CABINET-4.md 2.2), which is exactly these two functions.
use zcash_note_encryption::{
    try_compact_note_decryption, try_note_decryption, EphemeralKeyBytes,
};
use zcash_primitives::{
    block::BlockHash,
    transaction::{fees::FeeRule, Transaction},
};
use zcash_proofs::prover::LocalTxProver;
use zcash_transparent::keys::IncomingViewingKey;
use zcash_protocol::{
    consensus::{BlockHeight, BranchId, Network},
    memo::{Memo, MemoBytes},
    value::Zatoshis,
    ShieldedPool, TxId,
};
// ZIP-321 describes "pay these amounts to these addresses" as one value. The
// pot split (D-031) needs it because it pays the house address many times in a
// single transaction, which `propose_standard_transfer_to_address` cannot
// express: that helper hardcodes a request with exactly one payment.
use zip321::{Payment, TransactionRequest};

use crate::cache::MemBlockCache;

/// The public testnet lightwalletd operated by the zec.rocks team. This is
/// zcash-devtool's default server preset ("zecrocks", source checked
/// 2026-10-11). The old testnet.lightwalletd.com (Nighthawk Apps) was
/// decommissioned in May 2024 and no longer resolves.
pub const LIGHTWALLETD_HOST: &str = "testnet.zec.rocks";
pub const LIGHTWALLETD_URL: &str = "https://testnet.zec.rocks:443";

/// How long the wallet waits on lightwalletd before giving up (D-085).
///
/// Without a deadline the startup connect and the tip fetch can block forever
/// on a network that silently drops the connection (a rented home's egress, an
/// IPv6 blackhole). That looks exactly like a dead service: the door never
/// opens and the logs stay silent, which is what the first Railway deploy did.
/// A timeout turns the hang into a visible error the retry loop in main can
/// act on, so the service comes up and keeps trying instead of freezing.
pub const LWD_CONNECT_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(15);
pub const LWD_REQUEST_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(30);

/// Safety cap per send, in zatoshis (0.001 TAZ). Game logic requests fixed
/// tiny amounts; this cap is the last line of defense (DECISIONS D-025).
pub const MAX_SEND_ZATOSHIS: u64 = 100_000;

/// Head-room left on top of a payment when checking whether the house can pay
/// for a round. Observed ZIP 317 fees were 10,000 zatoshis for a hidden send and
/// 15,000 for an open one, so 20,000 covers both with room to spare. This is
/// only a pre-check to produce a good message; the wallet computes the real fee
/// and remains the final authority on whether a round can be paid for.
pub const FEE_HEADROOM_ZATOSHIS: u64 = 20_000;

/// The ZIP-317 marginal fee, spelled out locally because the wallet's balance
/// query uses it as a dust floor: a note worth this much or less is labelled
/// "uneconomic" and left OUT of the balance entirely, so it can never be spent.
/// Read from `zcash_client_sqlite::wallet::get_wallet_snapshot`
/// (`if value <= zip317::MARGINAL_FEE { ... uneconomic_value }`) and confirmed
/// against `zcash_primitives::transaction::fees::zip317::MARGINAL_FEE`.
///
/// This is why a 1,000-zatoshi round payment never comes back to the house
/// balance, and it is the reason `MIN_SPLIT_NOTE_ZATOSHIS` is one more than this.
pub const MARGINAL_FEE_ZATOSHIS: u64 = 5_000;

/// Smallest note a pot split may create. Anything at or below the marginal fee
/// would be uneconomic dust: invisible to the balance and unspendable forever.
pub const MIN_SPLIT_NOTE_ZATOSHIS: u64 = MARGINAL_FEE_ZATOSHIS + 1;

/// Upper bound on how many notes one split may create. ZIP-317 charges the
/// marginal fee per logical action, so a split of N notes costs roughly
/// 5,000 * (N + 1) zatoshis in fee on top of the notes themselves. 200 keeps
/// the worst case near 1,000,000 zatoshis, under one faucet claim.
pub const MAX_SPLIT_NOTES: usize = 200;

/// The two account names this sidecar keeps in its one wallet database.
///
/// Cabinet four (SCOPE-CABINET-4.md 2.1) added the merchant. Names, not
/// positions, decide which account is which: the house holds the pot and the
/// only spending key this sidecar ever derives, while the merchant is the shop
/// in the story and is read with its incoming viewing key alone.
pub const HOUSE_ACCOUNT_NAME: &str = "house";
pub const MERCHANT_ACCOUNT_NAME: &str = "merchant";

/// Finds an account by the name it was created with.
///
/// `WalletDb` hands back account ids in database order, which is not a promise
/// about which account is which, so every lookup in this file goes through the
/// name instead of taking the first id it is given.
fn find_account_by_name(wallet: &Wallet, name: &str) -> Result<Option<AccountUuid>, String> {
    for id in wallet
        .get_account_ids()
        .map_err(|e| format!("cannot read accounts: {e}"))?
    {
        let account = wallet
            .get_account(id)
            .map_err(|e| format!("cannot read one of the wallet's accounts: {e}"))?;
        if account.as_ref().and_then(|a| a.name()) == Some(name) {
            return Ok(Some(id));
        }
    }
    Ok(None)
}

/// Resolves the lightwalletd endpoint at runtime. ZARCADE_LIGHTWALLETD_URL
/// and ZARCADE_LIGHTWALLETD_HOST override the built-in default, which lets us
/// re-point the wallet at another server (or the canonical-chain gateway)
/// without a rebuild.
fn lwd_endpoint() -> (String, String) {
    let url = std::env::var("ZARCADE_LIGHTWALLETD_URL")
        .unwrap_or_else(|_| LIGHTWALLETD_URL.to_string());
    let host = std::env::var("ZARCADE_LIGHTWALLETD_HOST")
        .unwrap_or_else(|_| LIGHTWALLETD_HOST.to_string());
    (url, host)
}

/// Reads an optional pinned birthday height (a plain decimal block height)
/// from `path`. A missing or unreadable file means "no pinned birthday".
fn read_birthday(path: &Path) -> Option<u32> {
    std::fs::read_to_string(path)
        .ok()
        .and_then(|s| s.trim().parse::<u32>().ok())
}

/// The wallet's randomness source. `SysRng` is rand 0.10's system entropy
/// source; `UnwrapErr` adapts its fallible interface to the infallible
/// `rand::Rng` trait that `WalletDb` now requires. This is the same pairing
/// zcash_client_backend uses internally.
type SysRandom = UnwrapErr<SysRng>;

type Wallet = WalletDb<rusqlite::Connection, Network, SystemClock, SysRandom>;

// create_proposed_transactions leaves two generics unbound at the call site,
// so we name them via projections that always match the real types.
type InputsErr = <Wallet as InputSource>::Error;
type ChangeErr = <StandardFeeRule as FeeRule>::Error;

// The wallet's own handle for "this particular note". Naming it lets
// `build_and_broadcast` accept a proposal from either caller without caring
// which selector produced it.
type NoteRef = <Wallet as InputSource>::NoteRef;

/// The house account's money, split by whether it can be spent this instant.
/// All values are zatoshis (1 TAZ = 100,000,000).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Balances {
    /// Everything economically relevant, including money that is still settling.
    pub total: u64,
    /// Shielded notes with enough confirmations to spend right now. This is the
    /// number that decides whether a round can be played.
    pub spendable: u64,
    /// Change from the house's own transactions, awaiting confirmations.
    pub pending_change: u64,
    /// Transparent coins. The shielded spend path does not use these, so they
    /// are reported separately rather than folded into `spendable`.
    pub transparent: u64,
}

impl Balances {
    pub fn empty() -> Self {
        Self {
            total: 0,
            spendable: 0,
            pending_change: 0,
            transparent: 0,
        }
    }

    /// Can the house pay `amount` plus a network fee right now? The fee is
    /// estimated rather than exact, and only ever over-estimates: a ZIP 317 fee
    /// for one of our rounds is at most a few tens of thousands of zatoshis, so
    /// this leaves room and the wallet remains the final authority.
    ///
    /// Deliberately counts shielded money only. Transparent coins pile up on the
    /// house's open address as open rounds are played, and leaving them there is
    /// the point: they are a public, permanent record of every visible payment
    /// the arcade has made, which anyone can read on the explorer.
    pub fn can_pay(&self, amount: u64, fee_estimate: u64) -> bool {
        self.spendable >= amount.saturating_add(fee_estimate)
    }
}

/// What the chain says about one payment the house made. This is the real thing
/// behind the game's "your payment is landing" beat (D-031, option C): the block
/// number is not an animation timer, it is the block the network actually put the
/// payment in.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct TxStatus {
    /// The block the payment landed in, or `None` while it is still on its way.
    pub mined_height: Option<u32>,
    /// The highest block the wallet knows about at the time of asking.
    pub tip: u32,
    /// Blocks built on top of the payment, counting its own block as the first.
    /// Zero while unmined. One confirmation is what the wallet needs before it
    /// will spend the change, so 1 means "landed".
    pub confirmations: u32,
}

impl TxStatus {
    fn new(mined_height: Option<u32>, tip: u32) -> Self {
        let confirmations =
            mined_height.map_or(0, |h| tip.saturating_sub(h).saturating_add(1));
        Self {
            mined_height,
            tip,
            confirmations,
        }
    }
}

/// Why a send did not happen, with enough detail for the caller to explain it
/// honestly rather than shrug.
#[derive(Clone, Debug)]
pub enum SendError {
    /// The house owns the money but cannot spend it yet. The change from the
    /// previous round is not mined, and ZIP 315 requires confirmations before a
    /// note may be spent. Carries the real numbers so the game can say how much
    /// is on its way.
    Settling(Balances),
    /// Everything else. Holds a technical message meant for the server log, not
    /// for a player.
    Other(String),
}

impl From<String> for SendError {
    fn from(message: String) -> Self {
        SendError::Other(message)
    }
}

impl std::fmt::Display for SendError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SendError::Settling(b) => write!(
                f,
                "no spendable notes yet: {} zatoshis spendable, {} zatoshis of change awaiting confirmation",
                b.spendable, b.pending_change
            ),
            SendError::Other(message) => f.write_str(message),
        }
    }
}

/// One check in the single-payment disclosure gate (SCOPE-CABINET-4.md §3).
#[derive(Clone, Debug, serde::Serialize)]
pub struct DisclosureCheck {
    pub name: String,
    pub passed: bool,
    pub detail: String,
}

/// The gate's exported disclosure and its verification result.
///
/// This payload includes the note's randomness, so it is the most sensitive
/// thing the sidecar can produce. It exists only for the gate and is served
/// only when the process is started with ZARCADE_GATE=1. The shipped cabinet
/// will ask the verifier for a result and will never receive this struct.
#[derive(Clone, Debug, serde::Serialize)]
pub struct DisclosureReport {
    pub note_id: i64,
    pub txid: String,
    pub pool: String,
    pub output_index: u32,
    pub claimed_height: u32,
    pub network_height: Option<u32>,
    pub value_zat: u64,
    pub note_version: u8,
    pub diversifier: String,
    pub rho: String,
    pub rseed: String,
    /// The note's own Orchard address, 43 bytes hex. This is what the verifier
    /// feeds back into the commitment, not a viewing key.
    pub recipient: String,
    /// The merchant's window handles payments received at the account's
    /// address, which are external scope. Change notes at internal addresses
    /// are outside this receipt path.
    pub recipient_scope: String,
    pub memo_hex: Option<String>,
    pub memo_text: Option<String>,
    pub note_commitment: String,
    pub onchain_commitment: String,
    /// Out of scope for the receipt proof, but shown so nobody mistakes a
    /// spent note for an unspent one.
    pub spent: bool,
    pub checks: Vec<DisclosureCheck>,
    pub verified: bool,
}

/// The wallet stores an empty memo as the single byte 0xf6 and a real memo as
/// the full 512-byte ZIP 302 encoding. Decode only a genuine text memo;
/// anything else stays hex, so this cannot invent a message that was not on
/// chain.
fn disclosure_memo(memo: Option<&[u8]>) -> (Option<String>, Option<String>) {
    let Some(bytes) = memo else {
        return (None, None);
    };
    if bytes == [0xf6] {
        return (None, None);
    }
    let hex_text = hex::encode(bytes);
    let text = if bytes.len() == 512 {
        Memo::from_bytes(bytes).ok().and_then(|memo| match memo {
            Memo::Text(text) => Some(String::from(text)),
            _ => None,
        })
    } else {
        None
    };
    (Some(hex_text), text)
}

/// One payment the merchant received, as the incoming-only scan read it.
///
/// Every field here comes out of a note that the merchant's incoming viewing
/// key decrypted. Nothing is inferred, nothing is filled in from the sender's
/// side, and there is deliberately no field for who paid: a receiving-side key
/// does not name the payer (SCOPE-CABINET-4.md 2.2).
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct MerchantRow {
    pub txid: String,
    pub pool: String,
    pub output_index: u32,
    pub zatoshis: u64,
    /// The merchant's own address that was paid.
    pub address: String,
    /// The memo the payment carried, when it carried one. `None` means the note
    /// had no text memo; it is never guessed.
    pub memo: Option<String>,
    pub block: u32,
    /// Block time as the chain reports it, in seconds since the Unix epoch.
    pub block_time: u32,
}

/// What one pass of the incoming-only scan reports.
///
/// `can_spend` is always false and is stated out loud on purpose: the cabinet's
/// lesson is that reading and spending are separate secrets, so the response
/// carries that fact instead of leaving it implied.
#[derive(Clone, Debug, serde::Serialize)]
pub struct MerchantScan {
    pub address: String,
    pub key_used: String,
    pub can_spend: bool,
    pub scanned_from: u32,
    pub scanned_to: u32,
    pub blocks_scanned: u32,
    pub rows: Vec<MerchantRow>,
}

/// The shipped disclosure verifier's only output (SCOPE-CABINET-4.md 2.4,
/// build step 3).
///
/// This struct has deliberately no field for the note's plaintext: no
/// randomness, no diversifier, no recipient bytes. The sidecar decrypts the
/// note, recomputes its commitment, compares that with the chain, and never
/// serializes any of the plaintext. Only the result crosses this boundary,
/// plus facts that are already public (the transaction id, the on-chain
/// commitment, the heights) or already the merchant's own to show (the amount
/// and memo of the merchant's receipt). The gate's `DisclosureReport` is the
/// opposite on purpose: it carries everything and is why it stays behind
/// ZARCADE_GATE=1.
#[derive(Clone, Debug, serde::Serialize)]
pub struct ReceiptVerification {
    pub txid: String,
    pub pool: String,
    pub output_index: u32,
    pub zatoshis: u64,
    pub memo: Option<String>,
    /// The block the incoming-only scan recorded the receipt in.
    pub claimed_height: u32,
    /// The block lightwalletd reports the transaction in, right now.
    pub network_height: Option<u32>,
    /// The commitment the chain itself carries for this output. Not a secret;
    /// it is what the recomputed commitment is compared against.
    pub onchain_commitment: String,
    pub checks: Vec<DisclosureCheck>,
    pub verified: bool,
}

/// The scan's progress and its rows, kept in `data/merchant-scan.json`.
///
/// The file is a cache, not a source of truth: every row in it was decrypted
/// from a real block, and it exists so a second look at the cabinet does not
/// re-download blocks it has already read.
#[derive(Clone, Debug, Default, serde::Serialize, serde::Deserialize)]
struct MerchantScanState {
    last_height: u32,
    rows: Vec<MerchantRow>,
}

pub struct HouseWallet {
    wallet: Wallet,
    /// The same database's path, kept so the gate can open a second,
    /// read-only connection. `WalletDb` keeps its connection private, and the
    /// gate must never be able to write through a hole in the house wallet.
    db_path: PathBuf,
    cache: MemBlockCache,
    client: CompactTxStreamerClient<tonic::transport::Channel>,
    prover: LocalTxProver,
    account: AccountUuid,
    seed: Vec<u8>,
    address: String,
    /// The house's own transparent address, derived from the same seed (D-030).
    /// The "leave it open" branch of the game pays here, so the demo is
    /// self-contained and no third-party or player-supplied address is ever
    /// involved.
    transparent_address: String,
    /// Cabinet four (SCOPE-CABINET-4.md 2.1): a second account in the same
    /// wallet, belonging to the merchant in the story. The house pot pays it one
    /// real deposit; the cabinet then reads that deposit with the merchant's
    /// incoming viewing key and nothing else. Only what the read needs is kept
    /// here: the address, that key, and the birthday the scan starts from.
    merchant_address: String,
    /// The merchant account's incoming viewing key. It is the only key the
    /// merchant scan uses, and no route ever returns it.
    merchant_uivk: UnifiedIncomingViewingKey,
    merchant_birthday: u32,
    merchant_scan_path: PathBuf,
}

impl HouseWallet {
    /// Opens (creating on first run) the house wallet. All errors are plain
    /// strings so the HTTP layer can surface them without type gymnastics.
    pub async fn init(data_dir: &Path) -> Result<Self, String> {
        std::fs::create_dir_all(data_dir).map_err(|e| format!("cannot create data dir: {e}"))?;

        // 1. House seed: generated once, stored next to the wallet DB.
        let seed = load_or_create_seed(&data_dir.join("seed.hex"))?;

        // 2. Wallet DB (SQLite) with migrations applied.
        let db_path = data_dir.join("wallet.sqlite");
        let mut wallet = WalletDb::for_path(
            &db_path,
            Network::TestNetwork,
            SystemClock,
            UnwrapErr(SysRng),
        )
        .map_err(|e| format!("cannot open wallet db: {e}"))?;
        init_wallet_db(&mut wallet, Some(Secret::new(seed.clone())))
            .map_err(|e| format!("cannot initialize wallet db: {e:?}"))?;

        // 3. Connection to lightwalletd. Built exactly the way zcash-devtool
        //    (the librustzcash team's own CLI, same server) does it: TLS with
        //    webpki roots, explicit domain name, HTTP/2 assumed.
        let (lwd_url, lwd_host) = lwd_endpoint();
        let channel = tonic::transport::Endpoint::from_shared(lwd_url.clone())
            .map_err(|e| format!("bad lightwalletd url: {e}"))?
            .tls_config(
                tonic::transport::ClientTlsConfig::new()
                    .domain_name(lwd_host)
                    .assume_http2(true)
                    .with_webpki_roots(),
            )
            .map_err(|e| format!("cannot configure TLS: {e}"))?
            .connect_timeout(LWD_CONNECT_TIMEOUT)
            .connect()
            .await
            .map_err(|e| format!("cannot reach lightwalletd at {lwd_url}: {e}"))?;
        let mut client = CompactTxStreamerClient::new(channel);

        // 4. Chain tip (fallback birthday) and, when the operator has pinned
        //    one, an explicit birthday height from data/birthday.txt. The
        //    pinned height matters when the wallet is re-homed onto a chain
        //    where it was already paid: the birthday must sit below that
        //    payment or the notes can never be discovered.
        let tip = tokio::time::timeout(
            LWD_REQUEST_TIMEOUT,
            client.get_latest_block(service::ChainSpec {}),
        )
        .await
        .map_err(|_| format!("timed out fetching chain tip from {lwd_url}"))?
        .map_err(|e| format!("cannot fetch chain tip: {e}"))?
        .into_inner();
        let tip_height = u32::try_from(tip.height)
            .map_err(|_| format!("implausible tip height {}", tip.height))?;
        let tip_hash: [u8; 32] = tip
            .hash
            .try_into()
            .map_err(|_| "chain tip hash is not 32 bytes".to_string())?;

        // 5. House account: reuse the existing one, or create it. Accounts are
        //    found BY NAME and never by position, because cabinet four adds a
        //    second account to this wallet and "the first one" would be a guess
        //    that silently points the house's money at the wrong key.
        let account = match find_account_by_name(&wallet, HOUSE_ACCOUNT_NAME)? {
            Some(id) => id,
            None => {
                let birthday_height =
                    read_birthday(&data_dir.join("birthday.txt")).unwrap_or(tip_height);
                let birthday_state = if birthday_height == tip_height {
                    ChainState::empty(BlockHeight::from_u32(tip_height), BlockHash(tip_hash))
                } else {
                    tokio::time::timeout(
                        LWD_REQUEST_TIMEOUT,
                        client.get_tree_state(service::BlockId {
                            height: u64::from(birthday_height),
                            hash: vec![],
                        }),
                    )
                    .await
                    .map_err(|_| format!("timed out fetching birthday tree state from {lwd_url}"))?
                    .map_err(|e| format!("cannot fetch birthday tree state: {e}"))?
                    .into_inner()
                    .to_chain_state()
                    .map_err(|e| format!("birthday tree state is invalid: {e}"))?
                };
                let birthday = AccountBirthday::from_parts(birthday_state, None);
                let (id, _usk) = wallet
                    .create_account(
                        HOUSE_ACCOUNT_NAME,
                        &Secret::new(seed.clone()),
                        &birthday,
                        None,
                    )
                    .map_err(|e| format!("cannot create house account: {e}"))?;
                id
            }
        };

        // 5b. Merchant account (cabinet four, SCOPE-CABINET-4.md 2.1): the
        //     account the shop in the story owns. It is created at the chain tip
        //     because the merchant has no history to discover; it only ever
        //     receives the one deposit the game pays it. That birthday is also
        //     what bounds the incoming-only scan, so a fresh merchant never
        //     re-reads the whole testnet.
        let merchant = match find_account_by_name(&wallet, MERCHANT_ACCOUNT_NAME)? {
            Some(id) => id,
            None => {
                let birthday_state =
                    ChainState::empty(BlockHeight::from_u32(tip_height), BlockHash(tip_hash));
                let birthday = AccountBirthday::from_parts(birthday_state, None);
                let (id, _usk) = wallet
                    .create_account(
                        MERCHANT_ACCOUNT_NAME,
                        &Secret::new(seed.clone()),
                        &birthday,
                        None,
                    )
                    .map_err(|e| format!("cannot create merchant account: {e}"))?;
                println!("created the merchant account with birthday height {tip_height}");
                id
            }
        };
        let merchant_account = wallet
            .get_account(merchant)
            .map_err(|e| format!("cannot read the merchant account: {e}"))?
            .ok_or_else(|| "the merchant account is missing from the wallet".to_string())?;
        let merchant_birthday = u32::from(merchant_account.birthday_height());
        // The incoming viewing key is the ONLY key the merchant scan uses. It is
        // derived here, held in memory, and never returned by any route.
        let merchant_uivk = merchant_account.uivk();

        // 6. Stable deposit address (generated once, then read from file).
        let address = load_or_create_address(&data_dir.join("address.txt"), &mut wallet, account)?;

        // 6b. Stable transparent address derived from the same seed (D-030),
        //     also generated once and then read from file.
        let transparent_address =
            load_or_create_transparent_address(&data_dir.join("transparent-address.txt"), &seed)?;

        // 6c. The merchant's stable receiving address, generated once and then
        //     read from file, exactly like the house deposit address: the cabinet
        //     shows it to the player, so it must never rotate between restarts.
        let merchant_address = load_or_create_address(
            &data_dir.join("merchant-address.txt"),
            &mut wallet,
            merchant,
        )?;

        // 7. Prover with the Sapling parameters embedded in the binary.
        //    This parses ~50MB once at startup; sends are then fast.
        let prover = LocalTxProver::bundled();

        Ok(Self {
            wallet,
            db_path,
            cache: MemBlockCache::default(),
            client,
            prover,
            account,
            seed,
            address,
            transparent_address,
            merchant_address,
            merchant_uivk,
            merchant_birthday,
            merchant_scan_path: data_dir.join("merchant-scan.json"),
        })
    }

    pub fn address(&self) -> &str {
        &self.address
    }

    /// The house's own transparent address (D-030): where the "leave it open"
    /// branch of a game pays to.
    pub fn transparent_address(&self) -> &str {
        &self.transparent_address
    }

    /// The merchant account's receiving address (cabinet four). The house pays
    /// the story's deposit here, and the incoming-only scan reads back whatever
    /// lands at it.
    pub fn merchant_address(&self) -> &str {
        &self.merchant_address
    }

    /// Height the wallet has scanned up to (0 = never synced).
    pub fn synced_height(&self) -> Result<u32, String> {
        Ok(self
            .wallet
            .chain_height()
            .map_err(|e| format!("cannot read chain height: {e}"))?
            .map(u32::from)
            .unwrap_or(0))
    }

    /// Downloads and scans new blocks until the wallet matches the chain tip.
    pub async fn sync(&mut self) -> Result<u32, String> {
        sync::run(
            &mut self.client,
            &Network::TestNetwork,
            &self.cache,
            &mut self.wallet,
            100,
        )
        .await
        .map_err(|e| format!("sync failed: {e:?}"))?;
        self.synced_height()
    }

    /// Cabinet four (SCOPE-CABINET-4.md 2.2): read the merchant's incoming side
    /// with the merchant's incoming viewing key and nothing else.
    ///
    /// How it works, in plain terms. The scan asks lightwalletd for the compact
    /// blocks between the merchant's birthday and the chain tip. A compact block
    /// carries, for every Ironwood action, the note commitment, the ephemeral
    /// public key, and the first 52 bytes of the note ciphertext. Those 52 bytes
    /// are enough for a receiving key to try the lock: when the key fits, the
    /// amount and the receiving address come out; when it does not, the bytes
    /// stay noise. That is the whole of incoming viewing.
    ///
    /// What it deliberately does not do. No nullifier key is derived, so the scan
    /// cannot tell whether a note was later spent, and no spending key is
    /// touched. A compact block carries no memo, so a note that opens is fetched
    /// once in full and decrypted a second time to read the memo that payment
    /// really carried. If that second read fails, the scan says so instead of
    /// publishing a row with an invented or silently missing memo.
    ///
    /// Progress is cached in `data/merchant-scan.json`, so a second look reads
    /// only blocks it has not seen yet. Rows already in the cache are never
    /// rewritten; a row is added only by a successful decryption.
    pub async fn merchant_scan(&mut self) -> Result<MerchantScan, String> {
        // `prepare()` returns an owned key, so nothing below holds a borrow of
        // `self` while the network client is in use.
        let prepared = {
            let ivk = self
                .merchant_uivk
                .orchard()
                .as_ref()
                .ok_or_else(|| {
                    "the merchant account has no Ironwood incoming viewing key".to_string()
                })?;
            ivk.prepare()
        };
        // The one receiver this scan may label a row with. A note that opens for
        // any other address is an error, not a row: the cabinet must never show a
        // receipt it cannot account for.
        let merchant_receiver = merchant_address_receiver(&self.merchant_address)?;
        let mut client = self.client.clone();
        let birthday = self.merchant_birthday;
        let address = self.merchant_address.clone();
        let path = self.merchant_scan_path.clone();

        let mut state = load_merchant_scan_state(&path);
        let mut next = if state.last_height < birthday {
            birthday
        } else {
            state.last_height.saturating_add(1)
        };
        let scan_from = next;

        let tip = tokio::time::timeout(
            LWD_REQUEST_TIMEOUT,
            client.get_latest_block(service::ChainSpec {}),
        )
        .await
        .map_err(|_| "timed out fetching the chain tip for the merchant scan".to_string())?
        .map_err(|e| format!("cannot fetch the chain tip for the merchant scan: {e}"))?
        .into_inner();
        let tip_height = u32::try_from(tip.height)
            .map_err(|_| format!("implausible tip height {}", tip.height))?;

        let mut blocks_scanned = 0u32;
        while next <= tip_height {
            let end = std::cmp::min(next.saturating_add(MERCHANT_SCAN_CHUNK - 1), tip_height);
            let mut stream = tokio::time::timeout(
                LWD_REQUEST_TIMEOUT,
                client.get_block_range(service::BlockRange {
                    start: Some(service::BlockId {
                        height: u64::from(next),
                        hash: vec![],
                    }),
                    end: Some(service::BlockId {
                        height: u64::from(end),
                        hash: vec![],
                    }),
                    pool_types: vec![],
                }),
            )
            .await
            .map_err(|_| {
                format!("timed out fetching blocks {next} to {end} for the merchant scan")
            })?
            .map_err(|e| {
                format!("cannot fetch blocks {next} to {end} for the merchant scan: {e}")
            })?
            .into_inner();

            while let Some(block) = stream
                .message()
                .await
                .map_err(|e| format!("cannot read the block stream: {e}"))?
            {
                let height = u32::try_from(block.height)
                    .map_err(|_| format!("implausible block height {}", block.height))?;
                for tx in &block.vtx {
                    let txid_bytes: [u8; 32] = tx
                        .txid
                        .as_slice()
                        .try_into()
                        .map_err(|_| format!("block {height} carries a malformed transaction id"))?;
                    let txid = TxId::from_bytes(txid_bytes);
                    for (index, compact) in tx.ironwood_actions.iter().enumerate() {
                        let Some(row) = merchant_try_compact_action(
                            &mut client,
                            &prepared,
                            &merchant_receiver,
                            &address,
                            txid,
                            index as u32,
                            compact,
                            height,
                            block.time,
                        )
                        .await?
                        else {
                            continue;
                        };
                        let already_known = state
                            .rows
                            .iter()
                            .any(|r| r.txid == row.txid && r.output_index == row.output_index);
                        if !already_known {
                            println!(
                                "merchant scan: {} zat in block {} in {}, memo {}",
                                row.zatoshis,
                                row.block,
                                row.txid,
                                row.memo.clone().unwrap_or_else(|| "none".to_string())
                            );
                            state.rows.push(row);
                        }
                    }
                }
                blocks_scanned = blocks_scanned.saturating_add(1);
                state.last_height = state.last_height.max(height);
            }
            // Saved after every chunk, so an interrupted scan resumes where it
            // stopped instead of starting over.
            save_merchant_scan_state(&path, &state);
            next = end.saturating_add(1);
        }

        Ok(MerchantScan {
            address,
            key_used: "merchant incoming viewing key".to_string(),
            // Stated on every read: this key can open notes. It cannot sign
            // anything, so it cannot move the money it just showed you.
            can_spend: false,
            scanned_from: scan_from,
            scanned_to: state.last_height,
            blocks_scanned,
            rows: state.rows.clone(),
        })
    }

    /// The shipped disclosure verifier (SCOPE-CABINET-4.md 2.4, build step 3):
    /// prove one of the merchant's receipts against the chain and return the
    /// result, never the plaintext that proves it.
    ///
    /// The story beat is the partner checking the deposit before releasing
    /// materials; the mechanism is the one the section 3 gate passed on real
    /// money. Decrypt the note with the merchant's incoming viewing key,
    /// rebuild its commitment from the plaintext, and compare that with the
    /// commitment the transaction carries on chain. A match proves the payment:
    /// the amount, the receiving address and the memo all went into the
    /// commitment, so the chain itself vouches for them. No Merkle path and no
    /// tree state are needed, and nothing about the rest of the account is
    /// revealed.
    ///
    /// Two rules keep this honest. The transaction must be one the
    /// incoming-only scan really decrypted for the merchant's address, so this
    /// endpoint cannot be pointed at arbitrary chain data. And the plaintext
    /// (randomness, diversifier, recipient bytes) never leaves: the final
    /// checks probe the serialized payload for exactly those fragments and for
    /// every stored key, the same way the gate's fourth criterion did.
    pub async fn merchant_verify(
        &mut self,
        txid_hex: &str,
        output_index: u32,
    ) -> Result<ReceiptVerification, String> {
        let txid = TxId::from_hex(txid_hex.trim()).ok_or_else(|| {
            "not a transaction id: expected 64 hexadecimal digits".to_string()
        })?;
        let canonical = txid.as_hex();

        // Run the incremental scan first, so a payment that landed moments ago
        // is not rejected just because nobody has looked at the window yet.
        let scan = self.merchant_scan().await?;
        let row = scan
            .rows
            .iter()
            .find(|r| r.txid == canonical && r.output_index == output_index)
            .ok_or_else(|| {
                format!(
                    "the merchant's incoming-only scan has no receipt in {canonical} at output {output_index}"
                )
            })?
            .clone();

        let prepared = {
            let ivk = self
                .merchant_uivk
                .orchard()
                .as_ref()
                .ok_or_else(|| {
                    "the merchant account has no Ironwood incoming viewing key".to_string()
                })?;
            ivk.prepare()
        };
        let merchant_receiver = merchant_address_receiver(&self.merchant_address)?;
        let mut client = self.client.clone();

        // Everything below comes from the chain as it answers right now, not
        // from the cache: the whole point of the verifier is an independent
        // second look.
        let network_tx = tokio::time::timeout(
            LWD_REQUEST_TIMEOUT,
            client.get_transaction(service::TxFilter {
                block: None,
                index: 0,
                hash: txid.as_ref().to_vec(),
            }),
        )
        .await
        .map_err(|_| format!("timed out fetching {canonical} for verification"))?
        .map_err(|e| format!("cannot fetch {canonical} for verification: {e}"))?
        .into_inner();
        let network_height = if network_tx.height == 0 || network_tx.height == u64::MAX {
            None
        } else {
            Some(
                u32::try_from(network_tx.height)
                    .map_err(|_| "lightwalletd returned an invalid height".to_string())?,
            )
        };
        let height_confirmed = network_height == Some(row.block);

        let tx = Transaction::read(
            &network_tx.data[..],
            BranchId::for_height(&Network::TestNetwork, BlockHeight::from(row.block)),
        )
        .map_err(|e| format!("cannot parse {canonical}: {e}"))?;
        let action = tx
            .ironwood_bundle()
            .and_then(|bundle| bundle.actions().get(output_index as usize))
            .ok_or_else(|| {
                format!("{canonical} has no Ironwood action at index {output_index}")
            })?;
        let (note, recipient, memo_bytes) =
            try_note_decryption(&IronwoodDomain::for_action(action), &prepared, action)
                .ok_or_else(|| {
                    format!(
                        "the note at {canonical} output {output_index} does not open with the merchant's incoming viewing key, so the scan row and the chain disagree"
                    )
                })?;
        if &recipient != &merchant_receiver {
            return Err(format!(
                "the note at {canonical} output {output_index} pays an address that is not the merchant's own"
            ));
        }
        let value_zat = note.value().inner();
        if value_zat != row.zatoshis {
            return Err(format!(
                "the chain and the scan disagree about the amount at {canonical} output {output_index}"
            ));
        }

        // The commitment is where the proof lives: it was computed by the
        // sender from value, recipient and randomness, and it is what the chain
        // stores. Recomputing it from the decrypted plaintext and finding the
        // same bytes is what turns "the scan says so" into "the chain says so".
        let computed_bytes: [u8; 32] = ExtractedNoteCommitment::from(note.commitment()).to_bytes();
        let onchain_bytes: [u8; 32] = action.cmx().into();
        let commitment_matches = computed_bytes == onchain_bytes;
        let memo = merchant_memo_text(&memo_bytes);

        // The plaintext fragments that must never cross this boundary. Held
        // only long enough to prove, below, that the serialized payload does
        // not contain them. `orchard::Note` is a small Copy value, so there is
        // nothing to free here; what matters is that it is never serialized,
        // and the last two checks below verify exactly that.
        let plaintext_fragments = [
            hex::encode(note.rho().to_bytes()),
            hex::encode(note.rseed().as_bytes()),
            hex::encode(note.recipient().diversifier().as_array()),
            hex::encode(note.recipient().to_raw_address_bytes()),
        ];

        let mut result = ReceiptVerification {
            txid: canonical.clone(),
            pool: "ironwood".to_string(),
            output_index,
            zatoshis: value_zat,
            memo,
            claimed_height: row.block,
            network_height,
            onchain_commitment: hex::encode(onchain_bytes),
            checks: vec![
                DisclosureCheck {
                    name: "note_decrypted".to_string(),
                    passed: true,
                    detail: format!(
                        "the merchant's incoming viewing key opens the note at Ironwood action {output_index} of {canonical}, worth {value_zat} zatoshis, at the merchant's own address"
                    ),
                },
                DisclosureCheck {
                    name: "commitment_matches".to_string(),
                    passed: commitment_matches,
                    detail: format!(
                        "recomputed commitment {} against on-chain output commitment {}",
                        hex::encode(computed_bytes),
                        hex::encode(onchain_bytes)
                    ),
                },
                DisclosureCheck {
                    name: "height_confirmed".to_string(),
                    passed: height_confirmed,
                    detail: match network_height {
                        Some(h) => format!(
                            "the scan recorded this receipt in block {}, lightwalletd reports the transaction in block {h}",
                            row.block
                        ),
                        None => format!(
                            "the scan recorded this receipt in block {}, lightwalletd does not report the transaction as mined",
                            row.block
                        ),
                    },
                },
            ],
            verified: false,
        };

        // Both remaining checks are probed, not asserted: serialize exactly
        // what is about to be sent, then hunt for secrets inside it.
        let probe = serde_json::to_string(&result)
            .map_err(|e| format!("cannot serialize the verification result: {e}"))?;

        // Every stored key of every account in this wallet, plus the seed.
        let conn = rusqlite::Connection::open_with_flags(
            &self.db_path,
            rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
        )
        .map_err(|e| format!("cannot open the wallet database read-only: {e}"))?;
        let mut secrets: Vec<(String, String)> = vec![("seed".to_string(), hex::encode(&self.seed))];
        let accounts = conn
            .prepare("SELECT id, name, uivk, ufvk FROM accounts ORDER BY id")
            .and_then(|mut stmt| {
                stmt.query_map([], |r| {
                    Ok((
                        r.get::<_, i64>(0)?,
                        r.get::<_, Option<String>>(1)?,
                        r.get::<_, Option<String>>(2)?,
                        r.get::<_, Option<String>>(3)?,
                    ))
                })
                .and_then(|rows| rows.collect::<Result<Vec<_>, _>>())
            })
            .map_err(|e| format!("cannot read the accounts for the key probe: {e}"))?;
        for (id, name, uivk, ufvk) in accounts {
            let who = name.unwrap_or_else(|| format!("account {id}"));
            if let Some(key) = uivk {
                secrets.push((format!("incoming viewing key of {who}"), key));
            }
            if let Some(key) = ufvk {
                secrets.push((format!("full viewing key of {who}"), key));
            }
        }
        let leaked_key = secrets
            .iter()
            .find(|(_, value)| !value.is_empty() && probe.contains(value.as_str()));
        result.checks.push(match leaked_key {
            Some((label, _)) => DisclosureCheck {
                name: "no_key_material".to_string(),
                passed: false,
                detail: format!("the payload contains the {label}"),
            },
            None => DisclosureCheck {
                name: "no_key_material".to_string(),
                passed: true,
                detail: "the payload contains no seed and no viewing key text of any account"
                    .to_string(),
            },
        });

        let leaked_plaintext = plaintext_fragments
            .iter()
            .any(|fragment| probe.contains(fragment.as_str()));
        result.checks.push(match leaked_plaintext {
            true => DisclosureCheck {
                name: "result_only".to_string(),
                passed: false,
                detail: "the payload contains part of the note's plaintext".to_string(),
            },
            false => DisclosureCheck {
                name: "result_only".to_string(),
                passed: true,
                detail: "the note's randomness, diversifier and recipient bytes stay in the sidecar; only the result is shipped"
                    .to_string(),
            },
        });

        result.verified = result.checks.iter().all(|check| check.passed);
        Ok(result)
    }

    /// What the house account holds, split by whether it can be spent right now.
    ///
    /// The split matters more than the total. A payment needs a note with enough
    /// confirmations behind it (ZIP 315, and `ConfirmationsPolicy::MIN` still
    /// means one confirmation), so the change from the previous round does not
    /// count until that round is mined. Reading only `total` is how the arcade
    /// would end up promising a round it cannot pay for.
    pub fn balances(&self) -> Result<Balances, String> {
        let summary = self
            .wallet
            .get_wallet_summary(ConfirmationsPolicy::MIN)
            .map_err(|e| format!("cannot read balance: {e}"))?;
        let account = summary
            .as_ref()
            .and_then(|s| s.account_balances().get(&self.account));
        let Some(b) = account else {
            return Ok(Balances::empty());
        };
        // `unshielded()` is deprecated in backend 0.25, so total the two
        // transparent buckets (regular and coinbase) ourselves.
        let transparent = b.unshielded_balance().total();
        Ok(Balances {
            total: u64::from(b.total()),
            spendable: u64::from(b.spendable_value()),
            pending_change: u64::from(b.change_pending_confirmation()),
            transparent: u64::from(transparent),
        })
    }

    /// Looks up one payment on the chain and reports where it landed.
    ///
    /// The game polls this while it shows a payment landing, so it is written to
    /// stay cheap: it reads the wallet database first and only reaches out to the
    /// network when the payment is not yet known to be mined. Once it has landed
    /// this is a local lookup, which means a player watching their payment settle
    /// cannot slow down the next player's round.
    ///
    /// `txid_hex` is the display form, the same 64 hex digits the explorer shows
    /// and `/send` returns. `TxId::from_hex` handles the byte reversal that
    /// Zcash transaction ids are stored with.
    pub async fn tx_status(&mut self, txid_hex: &str) -> Result<TxStatus, String> {
        let txid = TxId::from_hex(txid_hex.trim())
            .ok_or_else(|| "not a transaction id: expected 64 hexadecimal digits".to_string())?;

        if let Some(height) = self.tx_height(txid)? {
            return Ok(TxStatus::new(Some(height), self.tip_from_db()?));
        }

        // Not mined as far as the wallet knows. Tell "still on its way" apart
        // from "never existed": a payment is stored in the database as soon as we
        // broadcast it, before it is mined, so a transaction with no record at all
        // is not one of ours. Without this the caller would poll a made-up id
        // forever and always be told it is landing.
        let known = self
            .wallet
            .get_transaction(txid)
            .map_err(|e| format!("cannot look up the transaction: {e}"))?
            .is_some();
        if !known {
            return Err(format!(
                "the house wallet has no record of a payment with id {txid_hex}"
            ));
        }

        // Still on its way, so the only way to find out is to look at the chain.
        let tip = self.sync().await?;
        Ok(TxStatus::new(self.tx_height(txid)?, tip))
    }

    /// GATE ONLY (SCOPE-CABINET-4.md section 3): export one received note's
    /// plaintext and verify it against the transaction that is on the chain.
    ///
    /// Four checks, all of which must pass before the cabinet may ship a
    /// single-payment path:
    /// 1. A plaintext disclosure exists for a real received note.
    /// 2. Its commitment recomputes to the commitment in the on-chain output.
    /// 3. The transaction sits at the claimed height on testnet.
    /// 4. The returned payload contains no key material.
    ///
    /// The note is read through a second, read-only SQLite connection because
    /// `WalletDb` keeps its own connection private. Nothing here can write.
    /// A spent note is still a real received note and still proves receipt;
    /// spent status is deliberately out of scope for this path. Spend status is
    /// read from the spend table, not from the nullifier column, because this
    /// wallet stores a nullifier for every detected note.
    pub async fn disclosure_report(
        &mut self,
        txid_hex: Option<&str>,
        output_index: Option<u32>,
    ) -> Result<DisclosureReport, String> {
        let txid_filter: Option<Vec<u8>> = match txid_hex {
            Some(text) => Some(
                TxId::from_hex(text.trim())
                    .ok_or_else(|| {
                        "not a transaction id: expected 64 hexadecimal digits".to_string()
                    })?
                    .as_ref()
                    .to_vec(),
            ),
            None => None,
        };

        let conn = rusqlite::Connection::open_with_flags(
            &self.db_path,
            rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
        )
        .map_err(|e| format!("cannot open the wallet database read-only: {e}"))?;

        // Ironwood is the pool this wallet's notes are actually in. The pool is
        // named in the report so the verifier knows which output format to read.
        let row = conn
            .query_row(
                "SELECT n.id, n.action_index, n.account_id, n.diversifier, n.value,
                        n.rho, n.rseed, n.memo, n.note_version,
                        EXISTS (SELECT 1 FROM ironwood_received_note_spends s
                                WHERE s.ironwood_received_note_id = n.id),
                        n.recipient_key_scope, t.txid, t.mined_height
                 FROM ironwood_received_notes n
                 JOIN transactions t ON t.id_tx = n.transaction_id
                 WHERE t.mined_height IS NOT NULL
                   AND n.recipient_key_scope = 0
                   AND (?1 IS NULL OR t.txid = ?1)
                   AND (?2 IS NULL OR n.action_index = ?2)
                 ORDER BY t.mined_height DESC, n.action_index DESC, n.id DESC
                 LIMIT 1",
                rusqlite::params![txid_filter, output_index],
                |r| {
                    Ok((
                        r.get::<_, i64>(0)?,
                        r.get::<_, i64>(1)?,
                        r.get::<_, i64>(2)?,
                        r.get::<_, Vec<u8>>(3)?,
                        r.get::<_, i64>(4)?,
                        r.get::<_, Vec<u8>>(5)?,
                        r.get::<_, Vec<u8>>(6)?,
                        r.get::<_, Option<Vec<u8>>>(7)?,
                        r.get::<_, i64>(8)?,
                        r.get::<_, i64>(9)?,
                        r.get::<_, i64>(10)?,
                        r.get::<_, Vec<u8>>(11)?,
                        r.get::<_, i64>(12)?,
                    ))
                },
            )
            .map_err(|e| match e {
                rusqlite::Error::QueryReturnedNoRows => {
                    "the wallet has no mined external-scope received note matching that request \
                     (change notes at internal addresses are outside the merchant receipt path)"
                        .to_string()
                }
                other => format!("cannot read the received note: {other}"),
            })?;

        let note_id = row.0;
        let action_index = u32::try_from(row.1)
            .map_err(|_| "stored note has a negative action index".to_string())?;
        let account_id = row.2;
        let diversifier_bytes: [u8; 11] = row
            .3
            .try_into()
            .map_err(|_| "stored note has a malformed diversifier".to_string())?;
        let value_zat = u64::try_from(row.4)
            .map_err(|_| "stored note has a negative value".to_string())?;
        let rho_bytes: [u8; 32] = row
            .5
            .try_into()
            .map_err(|_| "stored note has a malformed rho".to_string())?;
        let rseed_bytes: [u8; 32] = row
            .6
            .try_into()
            .map_err(|_| "stored note has a malformed random seed".to_string())?;
        let memo_bytes = row.7;
        let note_version_code = u8::try_from(row.8)
            .map_err(|_| "stored note has an invalid version".to_string())?;
        let spent = row.9 != 0;
        let scope_code = row.10;
        if scope_code != 0 {
            return Err(format!(
                "the selected note is at key scope {scope_code}, not the external scope this receipt path handles"
            ));
        }
        let txid_bytes: [u8; 32] = row
            .11
            .try_into()
            .map_err(|_| "stored transaction has a malformed id".to_string())?;
        let claimed_height = u32::try_from(row.12)
            .map_err(|_| "stored transaction has an invalid height".to_string())?;
        let txid = TxId::from_bytes(txid_bytes);

        // Rebuild the recipient from the account's incoming viewing key and the
        // note's diversifier. This is the same reconstruction the wallet itself
        // performs; no spending or full viewing key is needed.
        let (uivk_str, ufvk_str): (String, Option<String>) = conn
            .query_row(
                "SELECT uivk, ufvk FROM accounts WHERE id = ?1",
                [account_id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .map_err(|e| format!("cannot read the account's viewing key: {e}"))?;
        let uivk = UnifiedIncomingViewingKey::decode(&Network::TestNetwork, &uivk_str)
            .map_err(|e| format!("cannot decode the account's incoming viewing key: {e}"))?;
        let ivk = uivk
            .orchard()
            .as_ref()
            .ok_or_else(|| "the account has no Orchard incoming viewing key".to_string())?;
        let recipient = ivk.address(Diversifier::from_bytes(diversifier_bytes));

        let rho = Option::<Rho>::from(Rho::from_bytes(&rho_bytes))
            .ok_or_else(|| "stored note has an invalid rho".to_string())?;
        let rseed = Option::<RandomSeed>::from(RandomSeed::from_bytes(rseed_bytes, &rho))
            .ok_or_else(|| "stored note has an invalid random seed".to_string())?;
        let note_version = match note_version_code {
            2 => OrchardNoteVersion::V2,
            3 => OrchardNoteVersion::V3,
            other => return Err(format!("unsupported note version {other}")),
        };
        let note = Option::<OrchardNote>::from(OrchardNote::from_parts(
            recipient,
            NoteValue::from_raw(value_zat),
            rho,
            rseed,
            note_version,
        ))
        .ok_or_else(|| "stored note fields do not form a valid note".to_string())?;

        let computed_cmx: ExtractedNoteCommitment = note.commitment().into();
        let computed_bytes = computed_cmx.to_bytes();

        // Fetch the transaction from the network, not from the wallet's copy,
        // so the commitment comparison and the height both come from the chain.
        let network_tx = self
            .client
            .get_transaction(service::TxFilter {
                block: None,
                index: 0,
                hash: txid.as_ref().to_vec(),
            })
            .await
            .map_err(|e| format!("cannot fetch the transaction from lightwalletd: {e}"))?
            .into_inner();

        let network_height = if network_tx.height == 0 || network_tx.height == u64::MAX {
            None
        } else {
            Some(
                u32::try_from(network_tx.height)
                    .map_err(|_| "lightwalletd returned an invalid height".to_string())?,
            )
        };
        let height_confirmed = network_height == Some(claimed_height);

        let tx = Transaction::read(
            &network_tx.data[..],
            BranchId::for_height(
                &Network::TestNetwork,
                BlockHeight::from(claimed_height),
            ),
        )
        .map_err(|e| format!("cannot parse the transaction returned by lightwalletd: {e}"))?;
        let bundle = tx
            .ironwood_bundle()
            .ok_or_else(|| "the transaction has no Ironwood bundle".to_string())?;
        let action = bundle
            .actions()
            .get(action_index as usize)
            .ok_or_else(|| {
                format!("the transaction has no Ironwood action at index {action_index}")
            })?;
        let onchain_bytes: [u8; 32] = action.cmx().into();
        let commitment_matches = computed_bytes == onchain_bytes;

        let (memo_hex, memo_text) = disclosure_memo(memo_bytes.as_deref());

        let mut report = DisclosureReport {
            note_id,
            txid: txid.as_hex(),
            pool: "ironwood".to_string(),
            output_index: action_index,
            claimed_height,
            network_height,
            value_zat,
            note_version: note_version_code,
            diversifier: hex::encode(diversifier_bytes),
            rho: hex::encode(rho_bytes),
            rseed: hex::encode(rseed_bytes),
            recipient: hex::encode(recipient.to_raw_address_bytes()),
            recipient_scope: "external".to_string(),
            memo_hex,
            memo_text,
            note_commitment: hex::encode(computed_bytes),
            onchain_commitment: hex::encode(onchain_bytes),
            spent,
            checks: vec![
                DisclosureCheck {
                    name: "plaintext_exported".to_string(),
                    passed: true,
                    detail: format!(
                        "note {note_id} from transaction {} at Ironwood action {action_index}, value {value_zat} zatoshis",
                        txid.as_hex()
                    ),
                },
                DisclosureCheck {
                    name: "commitment_matches".to_string(),
                    passed: commitment_matches,
                    detail: format!(
                        "recomputed commitment {} against on-chain output commitment {}",
                        hex::encode(computed_bytes),
                        hex::encode(onchain_bytes)
                    ),
                },
                DisclosureCheck {
                    name: "height_confirmed".to_string(),
                    passed: height_confirmed,
                    detail: match network_height {
                        Some(h) => format!(
                            "claimed height {claimed_height}, lightwalletd reports height {h}"
                        ),
                        None => format!(
                            "claimed height {claimed_height}, lightwalletd does not report the transaction as mined"
                        ),
                    },
                },
            ],
            verified: false,
        };

        // Criterion 4 is checked, not asserted: serialize what we are about to
        // send and look for the account's keys and the house seed in it.
        let probe = serde_json::to_string(&report)
            .map_err(|e| format!("cannot serialize the disclosure report: {e}"))?;
        let mut secrets: Vec<(&str, String)> = vec![
            ("incoming viewing key", uivk_str),
            ("seed", hex::encode(&self.seed)),
        ];
        if let Some(ufvk) = ufvk_str {
            secrets.push(("full viewing key", ufvk));
        }
        let leaked = secrets
            .iter()
            .find(|(_, value)| !value.is_empty() && probe.contains(value.as_str()));
        report.checks.push(match leaked {
            Some((label, _)) => DisclosureCheck {
                name: "no_key_material".to_string(),
                passed: false,
                detail: format!("the payload contains the {label}"),
            },
            None => DisclosureCheck {
                name: "no_key_material".to_string(),
                passed: true,
                detail: "the payload contains no seed, full viewing key or incoming viewing key text"
                    .to_string(),
            },
        });
        report.verified = report.checks.iter().all(|check| check.passed);
        Ok(report)
    }

    fn tx_height(&self, txid: TxId) -> Result<Option<u32>, String> {
        self.wallet
            .get_tx_height(txid)
            .map(|h| h.map(u32::from))
            .map_err(|e| format!("cannot look up the transaction: {e}"))
    }

    /// The wallet's view of the chain tip, without syncing.
    /// `get_target_and_anchor_heights` answers "which block would a NEW
    /// transaction be mined in", which is one past the tip.
    fn tip_from_db(&self) -> Result<u32, String> {
        let (target, _anchor) = self
            .wallet
            .get_target_and_anchor_heights(NonZeroU32::MIN)
            .map_err(|e| format!("cannot read the chain tip: {e}"))?
            .ok_or_else(|| "the wallet holds no blocks yet".to_string())?;
        Ok(u32::from(target).saturating_sub(1))
    }

    /// Builds, proves, signs, stores and broadcasts one transaction.
    /// Returns the txid as hex.
    pub async fn send(
        &mut self,
        to: &str,
        zatoshis: u64,
        memo: Option<&str>,
    ) -> Result<String, SendError> {
        if zatoshis == 0 || zatoshis > MAX_SEND_ZATOSHIS {
            return Err(format!(
                "amount must be between 1 and {MAX_SEND_ZATOSHIS} zatoshis; game logic sets fixed tiny amounts"
            )
            .into());
        }
        let recipient = Address::decode(&Network::TestNetwork, to)
            .ok_or_else(|| format!("not a valid testnet address: {to}"))?;
        let amount =
            Zatoshis::from_u64(zatoshis).map_err(|e| format!("amount out of range: {e:?}"))?;
        let memo_bytes = match memo {
            Some(text) => Some(MemoBytes::from(
                text.parse::<Memo>()
                    .map_err(|e| format!("memo is not valid text: {e}"))?,
            )),
            None => None,
        };

        // Sync first so input selection sees the latest notes.
        self.sync().await?;

        // Ask before trying. The wallet would refuse anyway once the money is
        // still settling, but refusing here lets us hand back the real numbers:
        // how much has landed and how much is on its way. That is the
        // difference between a useful message and a mysterious one.
        let balances = self.balances()?;
        if !balances.can_pay(zatoshis, FEE_HEADROOM_ZATOSHIS) {
            return Err(SendError::Settling(balances));
        }

        // The turbofish pins the one generic the compiler cannot infer from
        // the arguments: sqlite's commitment-tree error type.
        let proposal = propose_standard_transfer_to_address::<
            _,
            _,
            ShardTreeError<commitment_tree::Error>,
        >(
            &mut self.wallet,
            &Network::TestNetwork,
            StandardFeeRule::Zip317,
            self.account,
            ConfirmationsPolicy::MIN,
            &recipient,
            amount,
            memo_bytes,
            None,
            ShieldedPool::Sapling,
            None,
            None,
        )
        .map_err(|e| format!("cannot plan the transfer: {e:?}"))?;

        self.build_and_broadcast(proposal).await
    }

    /// D-031: break the pot into many small notes with ONE transaction.
    ///
    /// Why this exists. A shielded note can only be spent once the network has
    /// confirmed it. The house normally holds one large note, so every round
    /// spends it and turns it into pending change, and the next player waits
    /// about one block for that change to land (measured 34 to 99 seconds,
    /// against a 23.6 second average block). This pays the house's OWN shielded
    /// address `count` times in a single transaction. Once it is mined there are
    /// `count` independent confirmed notes, so rounds can follow back to back at
    /// the ~22 seconds each one actually takes.
    ///
    /// Two rules this obeys, both established by reading the wallet's own code
    /// rather than assuming:
    ///
    /// 1. Every note must be worth more than the ZIP-317 marginal fee. The
    ///    balance query labels anything at or below it "uneconomic" and leaves it
    ///    out of the total, so smaller notes would be unusable. See
    ///    `MIN_SPLIT_NOTE_ZATOSHIS`.
    /// 2. Note selection is oldest-first (`ValueSelection::Accumulate` orders by
    ///    commitment tree position). That works in our favour: this
    ///    transaction's change output is written last, so it is the NEWEST note
    ///    and is only reached after the small ones are spent.
    ///
    /// Returns the txid. The caller must wait for it to be mined before rounds
    /// resume, exactly as for any other send.
    pub async fn split_pot(&mut self, count: usize, per_note: u64) -> Result<String, SendError> {
        if count < 2 || count > MAX_SPLIT_NOTES {
            return Err(format!(
                "note count must be between 2 and {MAX_SPLIT_NOTES}; one note changes nothing"
            )
            .into());
        }
        if per_note < MIN_SPLIT_NOTE_ZATOSHIS || per_note > MAX_SEND_ZATOSHIS {
            return Err(format!(
                "each note must be between {MIN_SPLIT_NOTE_ZATOSHIS} and {MAX_SEND_ZATOSHIS} zatoshis; \
                 anything at or below {MARGINAL_FEE_ZATOSHIS} is uneconomic dust the wallet will never spend"
            )
            .into());
        }

        let amount = Zatoshis::from_u64(per_note)
            .map_err(|e| format!("note value out of range: {e:?}"))?;
        let recipient = Address::decode(&Network::TestNetwork, self.address())
            .ok_or_else(|| "the house's own address did not decode".to_string())?;

        // A split is bigger than a round, so the round-sized fee head-room does
        // not apply. ZIP-317 charges the marginal fee per logical action, and a
        // split has `count` outputs plus a change output, so this estimate is
        // deliberately a little generous. It is only a pre-check to give a clear
        // message; the proposal below computes the real fee and is authoritative.
        let estimated_fee = MARGINAL_FEE_ZATOSHIS.saturating_mul(count as u64 + 2);
        let wanted = per_note.saturating_mul(count as u64);

        self.sync().await?;

        let balances = self.balances()?;
        if !balances.can_pay(wanted, estimated_fee) {
            return Err(SendError::Settling(balances));
        }

        let payments: Vec<Payment> = (0..count)
            .map(|_| Payment::without_memo(recipient.to_zcash_address(&Network::TestNetwork), amount))
            .collect();
        let request = TransactionRequest::new(payments)
            .map_err(|e| format!("cannot describe the split: {e:?}"))?;

        // These two are exactly what `propose_standard_transfer_to_address`
        // builds internally; we spell them out because that helper hardcodes a
        // single-payment request and we need many.
        let input_selector = GreedyInputSelector::<Wallet>::new();
        let change_strategy = SingleOutputChangeStrategy::<Wallet>::new(
            StandardFeeRule::Zip317,
            None,
            ShieldedPool::Sapling,
            DustOutputPolicy::default(),
        );

        let proposal = propose_transfer::<_, _, _, _, ShardTreeError<commitment_tree::Error>>(
            &mut self.wallet,
            &Network::TestNetwork,
            self.account,
            &input_selector,
            &change_strategy,
            request,
            ConfirmationsPolicy::MIN,
            &SpendPolicy::default(),
            None,
            None,
        )
        .map_err(|e| format!("cannot plan the split: {e:?}"))?;

        self.build_and_broadcast(proposal).await
    }

    /// Turns an already-planned proposal into a signed transaction on the
    /// network and returns its txid. Shared by `send` and `split_pot` so that
    /// there is exactly one place that proves, signs and broadcasts money.
    async fn build_and_broadcast(
        &mut self,
        proposal: Proposal<StandardFeeRule, NoteRef>,
    ) -> Result<String, SendError> {
        let usk = self.spending_key()?;
        // backend 0.25 added two parameters here: an explicit `clock` (used for
        // expiry-delta timing) and an explicit `rng` for signing randomness.
        // Previously both came implicitly from the WalletDb. We pass the same
        // SystemClock the wallet was built with, and the same UnwrapErr(SysRng)
        // entropy source the Zcash crates use internally.
        let txids = create_proposed_transactions::<_, _, InputsErr, _, ChangeErr, _>(
            &mut self.wallet,
            &Network::TestNetwork,
            &SystemClock,
            &mut UnwrapErr(SysRng),
            &self.prover,
            &self.prover,
            &SpendingKeys::from_unified_spending_key(usk),
            OvkPolicy::Sender,
            &proposal,
            None,
        )
        .map_err(|e| format!("cannot build or sign the transaction: {e:?}"))?;

        let txid = txids.head;
        let tx = self
            .wallet
            .get_transaction(txid)
            .map_err(|e| format!("cannot read back the transaction: {e}"))?
            .ok_or_else(|| {
                SendError::Other("transaction was not stored in the wallet db".to_string())
            })?;
        let mut raw = Vec::new();
        tx.write(&mut raw)
            .map_err(|e| format!("cannot serialize transaction: {e}"))?;

        let response = self
            .client
            .send_transaction(service::RawTransaction {
                data: raw,
                height: 0,
            })
            .await
            .map_err(|e| format!("cannot reach lightwalletd to broadcast: {e}"))?
            .into_inner();
        if response.error_code != 0 {
            return Err(format!(
                "the network rejected the transaction (code {}): {}",
                response.error_code, response.error_message
            )
            .into());
        }
        Ok(txid.to_string())
    }

    /// Re-derives the spending key from the seed at ZIP-32 account index 0.
    fn spending_key(&self) -> Result<UnifiedSpendingKey, String> {
        let account_index = zip32::AccountId::try_from(0u32)
            .map_err(|e| format!("account index 0 rejected: {e}"))?;
        UnifiedSpendingKey::from_seed(&Network::TestNetwork, &self.seed, account_index)
            .map_err(|e| format!("cannot derive spending key: {e:?}"))
    }
}

fn load_or_create_seed(path: &Path) -> Result<Vec<u8>, String> {
    if path.exists() {
        let text = std::fs::read_to_string(path).map_err(|e| format!("cannot read seed: {e}"))?;
        return hex::decode(text.trim()).map_err(|e| format!("seed file is corrupt: {e}"));
    }
    let mut seed = [0u8; 32];
    // Only reached on the very first run; the existing seed.hex is reused so
    // the deposit address never rotates.
    UnwrapErr(SysRng).fill_bytes(&mut seed);
    std::fs::write(path, hex::encode(seed)).map_err(|e| format!("cannot save seed: {e}"))?;
    Ok(seed.to_vec())
}

fn load_or_create_address(
    path: &Path,
    wallet: &mut Wallet,
    account: AccountUuid,
) -> Result<String, String> {
    if let Ok(saved) = std::fs::read_to_string(path) {
        let saved = saved.trim().to_string();
        if !saved.is_empty() {
            return Ok(saved);
        }
    }
    let (ua, _diversifier_index) = wallet
        .get_next_available_address(account, UnifiedAddressRequest::SHIELDED)
        .map_err(|e| format!("cannot generate address: {e}"))?
        .ok_or("wallet could not generate a unified address")?;
    let address = ua.encode(&Network::TestNetwork);
    std::fs::write(path, &address).map_err(|e| format!("cannot save address: {e}"))?;
    Ok(address)
}

/// Derives the house's own transparent address from the seed (D-030) and caches
/// it in `path`. It uses the same ZIP-32 account index (0) as the shielded
/// deposit address, so both belong to one account in one wallet.
///
/// The production derivation path is walked by hand because the convenient
/// `UnifiedSpendingKey::default_transparent_address` helper is compiled only
/// for test builds:
///   seed -> UnifiedSpendingKey -> transparent AccountPrivKey -> AccountPubKey
///        -> external IVK (BIP44 change level 0) -> default address (index 0)
fn load_or_create_transparent_address(path: &Path, seed: &[u8]) -> Result<String, String> {
    if let Ok(saved) = std::fs::read_to_string(path) {
        let saved = saved.trim().to_string();
        if !saved.is_empty() {
            return Ok(saved);
        }
    }
    let account_index =
        zip32::AccountId::try_from(0u32).map_err(|e| format!("account index 0 rejected: {e}"))?;
    let usk = UnifiedSpendingKey::from_seed(&Network::TestNetwork, seed, account_index)
        .map_err(|e| format!("cannot derive spending key: {e:?}"))?;
    let external_ivk = usk
        .transparent()
        .to_account_pubkey()
        .derive_external_ivk()
        .map_err(|e| format!("cannot derive the transparent viewing key: {e}"))?;
    let (transparent, _index) = external_ivk.default_address();
    let address = Address::from(transparent).encode(&Network::TestNetwork);
    std::fs::write(path, &address)
        .map_err(|e| format!("cannot save transparent address: {e}"))?;
    Ok(address)
}

/// How many compact blocks one merchant-scan request asks lightwalletd for.
/// Small enough that a slow server answers well inside `LWD_REQUEST_TIMEOUT`,
/// large enough that catching up over a quiet weekend is a handful of requests.
const MERCHANT_SCAN_CHUNK: u32 = 100;

/// The shielded receiver inside the merchant's stored address.
///
/// The scan compares every note it opens against this receiver, so a payment to
/// some other address can never be filed as one of the merchant's receipts.
fn merchant_address_receiver(address: &str) -> Result<orchard::Address, String> {
    match Address::decode(&Network::TestNetwork, address)
        .ok_or_else(|| format!("the merchant address on file cannot be decoded: {address}"))?
    {
        Address::Unified(ua) => ua
            .orchard()
            .copied()
            .ok_or_else(|| "the merchant address on file has no shielded receiver".to_string()),
        _ => Err("the merchant address on file is not a unified address".to_string()),
    }
}

/// A ZIP-302 text memo, and only that. An empty memo, a memo of arbitrary
/// bytes, or anything that will not parse becomes `None`: the cabinet never
/// prints a message the payment did not carry.
fn merchant_memo_text(memo_bytes: &[u8]) -> Option<String> {
    match Memo::from_bytes(memo_bytes) {
        Ok(Memo::Text(text)) => Some(String::from(text)),
        _ => None,
    }
}

/// Tries one compact Ironwood action against the merchant's incoming viewing key.
///
/// `Ok(None)` is the ordinary answer: this output belongs to somebody else,
/// which is true of every payment on the chain except the merchant's own.
/// Anything else is either a receipt or a real problem, and a real problem comes
/// back as an error rather than being quietly dropped, because a missing receipt
/// would look exactly like "no payment yet" on screen.
#[allow(clippy::too_many_arguments)]
async fn merchant_try_compact_action(
    client: &mut CompactTxStreamerClient<tonic::transport::Channel>,
    prepared: &PreparedIncomingViewingKey,
    merchant_receiver: &orchard::Address,
    address: &str,
    txid: TxId,
    output_index: u32,
    compact: &CompactOrchardAction,
    height: u32,
    block_time: u32,
) -> Result<Option<MerchantRow>, String> {
    // A compact action is exactly 32 + 32 + 32 + 52 bytes. Anything else is a
    // malformed block from the server, and the scan refuses to guess at it.
    let nullifier_bytes: [u8; 32] = compact
        .nullifier
        .as_slice()
        .try_into()
        .map_err(|_| format!("block {height} carries a malformed action nullifier"))?;
    let cmx_bytes: [u8; 32] = compact
        .cmx
        .as_slice()
        .try_into()
        .map_err(|_| format!("block {height} carries a malformed note commitment"))?;
    let epk_bytes: [u8; 32] = compact
        .ephemeral_key
        .as_slice()
        .try_into()
        .map_err(|_| format!("block {height} carries a malformed ephemeral key"))?;
    let ciphertext: [u8; 52] = compact
        .ciphertext
        .as_slice()
        .try_into()
        .map_err(|_| format!("block {height} carries a malformed compact ciphertext"))?;

    let Some(nullifier) =
        Option::<OrchardNullifier>::from(OrchardNullifier::from_bytes(&nullifier_bytes))
    else {
        return Err(format!("block {height} carries an invalid action nullifier"));
    };
    let Some(cmx) =
        Option::<ExtractedNoteCommitment>::from(ExtractedNoteCommitment::from_bytes(&cmx_bytes))
    else {
        return Err(format!("block {height} carries an invalid note commitment"));
    };

    // Trial decryption with the incoming viewing key alone (ZIP 307). The
    // nullifier key slot stays empty, which is what makes this read-only.
    let action = CompactAction::from_parts(
        nullifier,
        cmx,
        EphemeralKeyBytes(epk_bytes),
        ciphertext,
    );
    let domain = IronwoodDomain::for_compact_action(&action);
    let Some((note, recipient)) = try_compact_note_decryption(&domain, prepared, &action) else {
        return Ok(None);
    };
    if &recipient != merchant_receiver {
        return Err(format!(
            "a note in {} opened for an address that is not the merchant's own",
            txid.as_hex()
        ));
    }
    let zatoshis = note.value().inner();

    // The compact block has no memo. Fetch this one payment in full and decrypt
    // it a second time, so the memo on the row is the memo the payment carried.
    let full = tokio::time::timeout(
        LWD_REQUEST_TIMEOUT,
        client.get_transaction(service::TxFilter {
            block: None,
            index: 0,
            hash: txid.as_ref().to_vec(),
        }),
    )
    .await
    .map_err(|_| format!("timed out fetching {} to read its memo", txid.as_hex()))?
    .map_err(|e| format!("cannot fetch {} to read its memo: {e}", txid.as_hex()))?
    .into_inner();
    let tx = Transaction::read(
        &full.data[..],
        BranchId::for_height(&Network::TestNetwork, BlockHeight::from(height)),
    )
    .map_err(|e| format!("cannot parse {}: {e}", txid.as_hex()))?;
    let full_action = tx
        .ironwood_bundle()
        .and_then(|bundle| bundle.actions().get(output_index as usize))
        .ok_or_else(|| {
            format!(
                "{} has no Ironwood action at index {output_index}",
                txid.as_hex()
            )
        })?;
    let (full_note, _, memo_bytes) = try_note_decryption(
        &IronwoodDomain::for_action(full_action),
        prepared,
        full_action,
    )
    .ok_or_else(|| {
        format!(
            "the compact block opened a note in {} that the full transaction did not",
            txid.as_hex()
        )
    })?;

    // Cross-check the two reads before publishing anything. If they disagree,
    // the row would be a claim the machine cannot support.
    let compact_cmx: ExtractedNoteCommitment = note.commitment().into();
    let full_cmx: ExtractedNoteCommitment = full_note.commitment().into();
    if full_note.value().inner() != zatoshis || compact_cmx.to_bytes() != full_cmx.to_bytes() {
        return Err(format!(
            "the compact and full reads of {} disagree about the note",
            txid.as_hex()
        ));
    }

    Ok(Some(MerchantRow {
        txid: txid.as_hex(),
        pool: "ironwood".to_string(),
        output_index,
        zatoshis,
        address: address.to_string(),
        memo: merchant_memo_text(&memo_bytes),
        block: height,
        block_time,
    }))
}

/// Reads the merchant scan's cache. A missing or unreadable file simply means
/// "start again from the merchant's birthday": every row is re-derived from the
/// chain, so nothing is lost but time.
fn load_merchant_scan_state(path: &Path) -> MerchantScanState {
    std::fs::read_to_string(path)
        .ok()
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_default()
}

fn save_merchant_scan_state(path: &Path, state: &MerchantScanState) {
    match serde_json::to_string(state) {
        Ok(text) => {
            if let Err(e) = std::fs::write(path, text) {
                eprintln!("merchant scan: could not save progress: {e}");
            }
        }
        Err(e) => eprintln!("merchant scan: could not write down progress: {e}"),
    }
}
