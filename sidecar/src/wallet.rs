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
use std::path::Path;

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
        AccountBirthday, InputSource, WalletRead, WalletWrite,
    },
    fees::{standard::SingleOutputChangeStrategy, DustOutputPolicy, StandardFeeRule},
    proposal::Proposal,
    proto::service::{self, compact_tx_streamer_client::CompactTxStreamerClient},
    sync,
    wallet::OvkPolicy,
};
use zcash_client_sqlite::{
    util::SystemClock, wallet::commitment_tree, wallet::init::init_wallet_db, AccountUuid, WalletDb,
};
use zcash_keys::{
    address::Address,
    keys::{UnifiedAddressRequest, UnifiedSpendingKey},
};
use zcash_primitives::{block::BlockHash, transaction::fees::FeeRule};
use zcash_proofs::prover::LocalTxProver;
use zcash_transparent::keys::IncomingViewingKey;
use zcash_protocol::{
    consensus::{BlockHeight, Network},
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

pub struct HouseWallet {
    wallet: Wallet,
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
}

impl HouseWallet {
    /// Opens (creating on first run) the house wallet. All errors are plain
    /// strings so the HTTP layer can surface them without type gymnastics.
    pub async fn init(data_dir: &Path) -> Result<Self, String> {
        std::fs::create_dir_all(data_dir).map_err(|e| format!("cannot create data dir: {e}"))?;

        // 1. House seed: generated once, stored next to the wallet DB.
        let seed = load_or_create_seed(&data_dir.join("seed.hex"))?;

        // 2. Wallet DB (SQLite) with migrations applied.
        let mut wallet = WalletDb::for_path(
            data_dir.join("wallet.sqlite"),
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

        // 5. House account: reuse the existing one, or create it.
        let existing = wallet
            .get_account_ids()
            .map_err(|e| format!("cannot read accounts: {e}"))?;
        let account = match existing.first() {
            Some(id) => *id,
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
                    .create_account("house", &Secret::new(seed.clone()), &birthday, None)
                    .map_err(|e| format!("cannot create house account: {e}"))?;
                id
            }
        };

        // 6. Stable deposit address (generated once, then read from file).
        let address = load_or_create_address(&data_dir.join("address.txt"), &mut wallet, account)?;

        // 6b. Stable transparent address derived from the same seed (D-030),
        //     also generated once and then read from file.
        let transparent_address =
            load_or_create_transparent_address(&data_dir.join("transparent-address.txt"), &seed)?;

        // 7. Prover with the Sapling parameters embedded in the binary.
        //    This parses ~50MB once at startup; sends are then fast.
        let prover = LocalTxProver::bundled();

        Ok(Self {
            wallet,
            cache: MemBlockCache::default(),
            client,
            prover,
            account,
            seed,
            address,
            transparent_address,
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
