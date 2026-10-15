//! The wallet's own ledger of the payments it broadcast (D-093).
//!
//! The Crowd's record book is served from real round history: every payment
//! this wallet makes can become a row a future player is handed. An entry
//! holds only facts the chain already shows anyone: the txid, which of the
//! house's two own addresses was paid (that is exactly what an open payment
//! reveals), the fixed amount, and the block once mined. The file lives
//! beside the wallet data and survives restarts, same as the send budget
//! (D-094).
//!
//! Pure and file-local, so it is tested without a wallet, a chain, or a
//! network.

use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

pub const KIND_SHIELDED: &str = "shielded";
pub const KIND_OPEN: &str = "open";

/// How many entries the ledger keeps. The book only ever shows three rows,
/// so this is generous head-room for picking fresh ones.
pub const HISTORY_MAX: usize = 50;

/// One broadcast payment, in facts the chain already shows to anyone.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct HistoryEntry {
    pub txid: String,
    /// "shielded" or "open": which of the house's own addresses was paid.
    pub kind: String,
    pub zatoshis: u64,
    /// Unix seconds when the wallet broadcast it.
    pub sent_at: u64,
    /// Filled in once the wallet has seen the payment mined, then cached on
    /// disk so /history never asks the network twice about one payment.
    #[serde(default)]
    pub block: Option<u64>,
}

/// Which of the house's own addresses a destination is, if either. The send
/// policy (D-094) guarantees a broadcast payment always paid one of them.
pub fn kind_for(to: &str, own_shielded: &str, own_transparent: &str) -> Option<&'static str> {
    if to == own_transparent {
        Some(KIND_OPEN)
    } else if to == own_shielded {
        Some(KIND_SHIELDED)
    } else {
        None
    }
}

/// The ledger, newest entry first.
pub struct SendHistory {
    path: PathBuf,
    entries: Vec<HistoryEntry>,
}

impl SendHistory {
    /// Read the ledger. A missing or corrupt file simply means "no history
    /// yet": the book falls back to its curated rows and nothing breaks.
    pub fn load(data_dir: &Path) -> Self {
        let path = data_dir.join("history.json");
        let entries = fs::read_to_string(&path)
            .ok()
            .and_then(|text| serde_json::from_str::<Vec<HistoryEntry>>(&text).ok())
            .unwrap_or_default();
        Self { path, entries }
    }

    /// Every entry, newest first.
    pub fn entries(&self) -> &[HistoryEntry] {
        &self.entries
    }

    /// Count one payment that was really broadcast. Re-recording a txid
    /// replaces its entry instead of duplicating it.
    pub fn record(&mut self, entry: HistoryEntry) {
        self.entries.retain(|e| e.txid != entry.txid);
        self.entries.insert(0, entry);
        self.entries.truncate(HISTORY_MAX);
        self.save();
    }

    /// Cache a mined height the wallet has confirmed. Returns true when the
    /// ledger changed and was rewritten.
    pub fn set_block(&mut self, txid: &str, block: u64) -> bool {
        let Some(entry) = self.entries.iter_mut().find(|e| e.txid == txid) else {
            return false;
        };
        if entry.block == Some(block) {
            return false;
        }
        entry.block = Some(block);
        self.save();
        true
    }

    fn save(&self) {
        match serde_json::to_string(&self.entries) {
            Ok(body) => {
                if let Err(e) = fs::write(&self.path, body) {
                    eprintln!("history: could not persist the ledger: {e}");
                }
            }
            Err(e) => eprintln!("history: could not serialize the ledger: {e}"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("zarcade-history-{tag}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("create temp dir");
        dir
    }

    fn entry(txid: &str, kind: &str) -> HistoryEntry {
        HistoryEntry {
            txid: txid.to_string(),
            kind: kind.to_string(),
            zatoshis: 1_000,
            sent_at: 1_760_000_000,
            block: None,
        }
    }

    #[test]
    fn kind_for_reads_the_two_house_addresses() {
        assert_eq!(kind_for("tOpen", "zHouse", "tOpen"), Some(KIND_OPEN));
        assert_eq!(kind_for("zHouse", "zHouse", "tOpen"), Some(KIND_SHIELDED));
        assert_eq!(kind_for("tStranger", "zHouse", "tOpen"), None);
    }

    #[test]
    fn ledger_round_trips_newest_first() {
        let dir = temp_dir("roundtrip");
        {
            let mut h = SendHistory::load(&dir);
            assert!(h.entries().is_empty());
            h.record(entry("aa", KIND_SHIELDED));
            h.record(entry("bb", KIND_OPEN));
        }
        let h = SendHistory::load(&dir);
        let txids: Vec<&str> = h.entries().iter().map(|e| e.txid.as_str()).collect();
        assert_eq!(txids, vec!["bb", "aa"]);
    }

    #[test]
    fn ledger_never_duplicates_a_txid() {
        let dir = temp_dir("dedupe");
        let mut h = SendHistory::load(&dir);
        h.record(entry("aa", KIND_SHIELDED));
        let mut again = entry("aa", KIND_SHIELDED);
        again.block = Some(4_500_000);
        h.record(again);
        assert_eq!(h.entries().len(), 1);
        assert_eq!(h.entries()[0].block, Some(4_500_000));
    }

    #[test]
    fn ledger_keeps_only_the_newest_entries() {
        let dir = temp_dir("cap");
        let mut h = SendHistory::load(&dir);
        for i in 0..(HISTORY_MAX + 5) {
            h.record(entry(&format!("tx{i:04}"), KIND_SHIELDED));
        }
        assert_eq!(h.entries().len(), HISTORY_MAX);
        // The newest survives, the oldest fell off the end.
        assert_eq!(
            h.entries()[0].txid,
            format!("tx{:04}", HISTORY_MAX + 4)
        );
    }

    #[test]
    fn set_block_caches_on_disk_once() {
        let dir = temp_dir("setblock");
        let mut h = SendHistory::load(&dir);
        h.record(entry("aa", KIND_SHIELDED));
        assert!(h.set_block("aa", 4_500_123));
        // Idempotent: the same height again changes nothing.
        assert!(!h.set_block("aa", 4_500_123));
        // Unknown txids are refused, not invented.
        assert!(!h.set_block("nope", 4_500_123));
        let reloaded = SendHistory::load(&dir);
        assert_eq!(reloaded.entries()[0].block, Some(4_500_123));
    }

    #[test]
    fn ledger_ignores_a_corrupt_file() {
        let dir = temp_dir("corrupt");
        fs::write(dir.join("history.json"), "not json at all").unwrap();
        let h = SendHistory::load(&dir);
        assert!(h.entries().is_empty());
    }
}
