//! The wallet's own copy of the game's money rules (D-094).
//!
//! The website already refuses anything but the two fixed game choices, but a
//! rule that lives only in the website protects the wallet only as long as
//! nobody else can reach it. These rules live HERE, at the door that actually
//! moves money, so the wallet stays safe even if the network boundary is ever
//! misconfigured:
//!
//!  1. A service token (when armed): `/send` answers only a caller that knows
//!     `ZARCADE_SEND_TOKEN`.
//!  2. The game's policy: a payment can only go to one of the arcade's own
//!     addresses, and only in the exact fixed round amount. Money cannot be
//!     aimed at a stranger's address through this door at all.
//!  3. A daily budget that lives on disk, so a restart cannot clear it. The
//!     website's in-memory rate limits are anti-abuse; this is the treasury
//!     control.
//!
//! Everything here is pure or file-local, so it is tested without a wallet,
//! a chain, or a network.

use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

/// The exact amount one game round moves. Mirrors `ROUND_ZATOSHIS` in
/// lib/zcash/config.ts; both live server-side and neither is player-settable.
pub const GAME_SEND_ZATOSHIS: u64 = 1_000;

/// The default daily budget, mirroring `LIMITS.maxSendsPerDayGlobal` in
/// lib/zcash/config.ts. `ZARCADE_DAILY_SEND_CAP` overrides it.
pub const DEFAULT_DAILY_SEND_CAP: u64 = 150;

/// Why the wallet's own policy refused a send.
#[derive(Debug, PartialEq, Eq)]
pub enum PolicyError {
    BadAmount,
    BadDestination,
}

impl std::fmt::Display for PolicyError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PolicyError::BadAmount => write!(
                f,
                "this door moves only the fixed round amount of {GAME_SEND_ZATOSHIS} zatoshis"
            ),
            PolicyError::BadDestination => {
                f.write_str("this door pays only the house's own addresses")
            }
        }
    }
}

/// The game's policy at the wallet boundary: the exact round amount, and one of
/// the arcade's own addresses, or nothing.
///
/// The third address is cabinet four's merchant account (SCOPE-CABINET-4.md
/// 2.1). It lives in this same sidecar and comes from this same seed, so paying
/// it is still the house paying itself: no player-supplied destination exists
/// here, and the amount is still the one fixed round amount. An empty
/// destination never matches, even if an address file were ever empty.
pub fn check_send(
    to: &str,
    zatoshis: u64,
    own_shielded: &str,
    own_transparent: &str,
    own_merchant: &str,
) -> Result<(), PolicyError> {
    if zatoshis != GAME_SEND_ZATOSHIS {
        return Err(PolicyError::BadAmount);
    }
    let allowed = [own_shielded, own_transparent, own_merchant];
    if to.is_empty() || !allowed.iter().any(|own| *own == to) {
        return Err(PolicyError::BadDestination);
    }
    Ok(())
}

/// Lock one: the service token. An unset or empty expected value means the
/// lock is OFF (announced at startup), which is what lets the code deploy
/// before the operator has set the variable; the policy and budget locks hold
/// either way.
pub fn service_token_ok(expected: Option<&str>, supplied: Option<&str>) -> bool {
    match expected {
        Some(t) if !t.is_empty() => supplied == Some(t),
        _ => true,
    }
}

/// The day number since the Unix epoch, in UTC. The budget resets when this
/// number changes; no calendar crate needed to know what "tomorrow" is.
fn epoch_day() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() / 86_400)
        .unwrap_or(0)
}

/// The durable daily send counter, persisted as `send-budget.json` in the
/// wallet's data directory: the same volume as the seed, the same access
/// story, and it survives every restart of the process.
pub struct SendBudget {
    path: PathBuf,
    cap: u64,
    day: u64,
    sent: u64,
}

impl SendBudget {
    /// `ZARCADE_DAILY_SEND_CAP` when it parses to a positive number, else the
    /// default of 150.
    pub fn cap_from_env() -> u64 {
        std::env::var("ZARCADE_DAILY_SEND_CAP")
            .ok()
            .and_then(|v| v.parse::<u64>().ok())
            .filter(|c| *c > 0)
            .unwrap_or(DEFAULT_DAILY_SEND_CAP)
    }

    /// Read the persisted counter for today.
    pub fn load(data_dir: &Path, cap: u64) -> Self {
        Self::load_on_day(data_dir, cap, epoch_day())
    }

    /// Load against an explicit day number, so the tests can simulate
    /// midnight without waiting for it.
    fn load_on_day(data_dir: &Path, cap: u64, today: u64) -> Self {
        let path = data_dir.join("send-budget.json");
        let stored = fs::read_to_string(&path)
            .ok()
            .and_then(|text| serde_json::from_str::<serde_json::Value>(&text).ok())
            .and_then(|v| Some((v.get("day")?.as_u64()?, v.get("sent")?.as_u64()?)));
        match stored {
            // A file from an earlier day, a corrupt file, or no file at all
            // means the same honest thing: nothing sent yet today.
            Some((day, sent)) if day == today => Self {
                path,
                cap,
                day,
                sent,
            },
            _ => Self {
                path,
                cap,
                day: today,
                sent: 0,
            },
        }
    }

    pub fn cap(&self) -> u64 {
        self.cap
    }

    pub fn sent_today(&self) -> u64 {
        self.sent
    }

    pub fn exhausted(&self) -> bool {
        self.sent >= self.cap
    }

    /// Count one send that was really broadcast, and persist at once. A
    /// persistence failure is announced but cannot un-send the payment; the
    /// in-memory count still holds for this process's life.
    pub fn record_send(&mut self) {
        self.sent += 1;
        let body = serde_json::json!({ "day": self.day, "sent": self.sent });
        if let Err(e) = fs::write(&self.path, body.to_string()) {
            eprintln!("send budget: could not persist the count: {e}");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SHIELDED: &str = "ztestsapling1house";
    const TRANSPARENT: &str = "tmHouseOpen";
    const MERCHANT: &str = "u1merchantWindow";

    fn temp_dir(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("zarcade-budget-{tag}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("create temp dir");
        dir
    }

    #[test]
    fn policy_allows_the_three_own_addresses() {
        // The two cabinet-one destinations, plus cabinet four's merchant account
        // (SCOPE-CABINET-4.md 2.1). All three belong to this one sidecar.
        assert!(
            check_send(SHIELDED, GAME_SEND_ZATOSHIS, SHIELDED, TRANSPARENT, MERCHANT).is_ok()
        );
        assert!(
            check_send(TRANSPARENT, GAME_SEND_ZATOSHIS, SHIELDED, TRANSPARENT, MERCHANT).is_ok()
        );
        assert!(
            check_send(MERCHANT, GAME_SEND_ZATOSHIS, SHIELDED, TRANSPARENT, MERCHANT).is_ok()
        );
    }

    #[test]
    fn policy_refuses_any_other_destination() {
        // The review's P0, closed at the door that moves money: even with the
        // right amount, a stranger's address never passes.
        assert_eq!(
            check_send(
                "tStrangerAddr",
                GAME_SEND_ZATOSHIS,
                SHIELDED,
                TRANSPARENT,
                MERCHANT
            ),
            Err(PolicyError::BadDestination)
        );
        assert_eq!(
            check_send("", GAME_SEND_ZATOSHIS, SHIELDED, TRANSPARENT, MERCHANT),
            Err(PolicyError::BadDestination)
        );
        // An empty own-address must never turn an empty destination into a match.
        assert_eq!(
            check_send("", GAME_SEND_ZATOSHIS, SHIELDED, "", ""),
            Err(PolicyError::BadDestination)
        );
    }

    #[test]
    fn policy_refuses_any_other_amount() {
        for amount in [0u64, 1, 999, 1_001, 100_000] {
            assert_eq!(
                check_send(SHIELDED, amount, SHIELDED, TRANSPARENT, MERCHANT),
                Err(PolicyError::BadAmount),
                "amount {amount} must be refused"
            );
        }
    }

    #[test]
    fn token_lock_is_off_until_armed_then_exact() {
        assert!(service_token_ok(None, None));
        assert!(service_token_ok(Some(""), None));
        assert!(service_token_ok(Some("secret"), Some("secret")));
        assert!(!service_token_ok(Some("secret"), None));
        assert!(!service_token_ok(Some("secret"), Some("wrong")));
        assert!(!service_token_ok(Some("secret"), Some("")));
    }

    #[test]
    fn budget_counts_and_survives_a_restart() {
        let dir = temp_dir("persist");
        {
            let mut b = SendBudget::load(&dir, 150);
            assert_eq!(b.sent_today(), 0);
            assert!(!b.exhausted());
            b.record_send();
            b.record_send();
        }
        // A "restart": a fresh load must see the persisted count.
        let b = SendBudget::load(&dir, 150);
        assert_eq!(b.sent_today(), 2);
    }

    #[test]
    fn budget_resets_on_a_new_day() {
        let dir = temp_dir("rollover");
        let today = epoch_day();
        let mut b = SendBudget::load_on_day(&dir, 150, today - 1);
        b.record_send();
        // Midnight passes: the same file now means "nothing sent yet today".
        let fresh = SendBudget::load_on_day(&dir, 150, today);
        assert_eq!(fresh.sent_today(), 0);
    }

    #[test]
    fn budget_refuses_past_its_cap() {
        let dir = temp_dir("cap");
        let mut b = SendBudget::load(&dir, 2);
        b.record_send();
        assert!(!b.exhausted());
        b.record_send();
        assert!(b.exhausted());
        assert_eq!(b.sent_today(), 2);
    }

    #[test]
    fn budget_ignores_a_corrupt_file() {
        let dir = temp_dir("corrupt");
        fs::write(dir.join("send-budget.json"), "not json at all").unwrap();
        let b = SendBudget::load(&dir, 150);
        assert_eq!(b.sent_today(), 0);
    }

    #[test]
    fn default_cap_matches_the_website_seatbelt() {
        // LIMITS.maxSendsPerDayGlobal in lib/zcash/config.ts is 150; if either
        // side changes, this test is the reminder to change the other.
        assert_eq!(DEFAULT_DAILY_SEND_CAP, 150);
    }
}
