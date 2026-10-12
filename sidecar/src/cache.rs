//! A tiny in-memory compact-block cache implementing the `BlockCache` trait
//! required by `zcash_client_backend::sync::run`.
//!
//! Why in-memory: the house wallet's birthday is the chain tip at creation
//! time, so sync ranges are always short. Cached blocks are transient (they
//! are downloaded, scanned into the wallet DB, then deleted by the sync
//! flow); anything not yet scanned is simply re-downloaded after a restart.
//! No persistence needed, and `zcash_client_sqlite`'s `BlockDb` exposes no
//! public write API anyway.

use std::{
    collections::BTreeMap,
    fmt,
    sync::{Mutex, MutexGuard},
};

use async_trait::async_trait;
use zcash_client_backend::{
    data_api::{
        chain::{error::Error as ChainError, BlockCache, BlockSource},
        scanning::ScanRange,
    },
    proto::compact_formats::CompactBlock,
};
use zcash_protocol::consensus::BlockHeight;

/// Something went wrong in the in-memory cache (in practice: a poisoned lock).
#[derive(Debug)]
pub struct CacheError(pub String);

impl fmt::Display for CacheError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "block cache error: {}", self.0)
    }
}

impl std::error::Error for CacheError {}

/// Compact blocks keyed by height.
#[derive(Default)]
pub struct MemBlockCache {
    blocks: Mutex<BTreeMap<u32, CompactBlock>>,
}

impl MemBlockCache {
    fn lock(&self) -> Result<MutexGuard<'_, BTreeMap<u32, CompactBlock>>, CacheError> {
        self.blocks
            .lock()
            .map_err(|_| CacheError("cache lock poisoned".to_string()))
    }
}

impl BlockSource for MemBlockCache {
    type Error = CacheError;

    fn with_blocks<F, WalletErrT>(
        &self,
        from_height: Option<BlockHeight>,
        limit: Option<usize>,
        mut with_block: F,
    ) -> Result<(), ChainError<WalletErrT, Self::Error>>
    where
        F: FnMut(CompactBlock) -> Result<(), ChainError<WalletErrT, Self::Error>>,
    {
        // Clone the selection out first so the callback never runs while we
        // hold the cache lock (avoids any chance of re-entrant deadlock).
        let selected: Vec<CompactBlock> = {
            let blocks = self.lock().map_err(ChainError::BlockSource)?;
            // BlockSource contract: iterate blocks STARTING AT `from_height`,
            // inclusive (scan_cached_blocks asserts from_height ==
            // from_state.height + 1, so the first block fed back must be
            // exactly `from_height`). An earlier +1 here caused
            // NonSequentialBlocks on the first real sync.
            let start = from_height.map(u32::from).unwrap_or(0);
            let end = limit
                .and_then(|l| u32::try_from(l).ok())
                .map(|l| start.saturating_add(l))
                .unwrap_or(u32::MAX);
            blocks
                .range(start..end)
                .map(|(_, block)| block.clone())
                .collect()
        };
        for block in selected {
            with_block(block)?;
        }
        Ok(())
    }
}

#[async_trait]
impl BlockCache for MemBlockCache {
    fn get_tip_height(
        &self,
        range: Option<&ScanRange>,
    ) -> Result<Option<BlockHeight>, Self::Error> {
        let blocks = self.lock()?;
        let tip = match range {
            Some(range) => {
                let r = range.block_range();
                blocks
                    .range(u32::from(r.start)..u32::from(r.end))
                    .next_back()
                    .map(|(height, _)| *height)
            }
            None => blocks.keys().next_back().copied(),
        };
        Ok(tip.map(BlockHeight::from_u32))
    }

    async fn read(&self, range: &ScanRange) -> Result<Vec<CompactBlock>, Self::Error> {
        let blocks = self.lock()?;
        let r = range.block_range();
        let (start, end) = (u32::from(r.start), u32::from(r.end));
        // Blocks must be contiguous starting at `range.start`; a short read at
        // the end is allowed, a gap in the middle is not (we stop at the gap).
        let mut out = Vec::new();
        let mut height = start;
        while height < end {
            match blocks.get(&height) {
                Some(block) => out.push(block.clone()),
                None => break,
            }
            height += 1;
        }
        Ok(out)
    }

    async fn insert(&self, compact_blocks: Vec<CompactBlock>) -> Result<(), Self::Error> {
        let mut blocks = self.lock()?;
        for block in compact_blocks {
            let height = u32::try_from(block.height)
                .map_err(|_| CacheError(format!("block height {} out of range", block.height)))?;
            blocks.insert(height, block);
        }
        Ok(())
    }

    async fn delete(&self, range: ScanRange) -> Result<(), Self::Error> {
        let mut blocks = self.lock()?;
        let r = range.block_range();
        for height in u32::from(r.start)..u32::from(r.end) {
            blocks.remove(&height);
        }
        Ok(())
    }
}
