//! Throwaway diagnostic tool: ask a lightwalletd server what chain it is on.
//!
//! Why: there are two live chains calling themselves "Zcash testnet" (one of
//! them is a forked testnet used by librustzcash developers), and the faucet
//! paid us on the canonical one. This prints the server's self-reported chain
//! name, vendor, height and its latest block hash so we can identify the right
//! endpoint before pointing the house wallet at it.
//!
//! Usage: cargo run --bin probe -- https://host:port [tls-domain-name]

use zcash_client_backend::proto::service::{
    self, compact_tx_streamer_client::CompactTxStreamerClient,
};

#[tokio::main]
async fn main() {
    let _ = rustls::crypto::ring::default_provider().install_default();

    let url = std::env::args()
        .nth(1)
        .expect("usage: probe <url> [tls-name-or-height]");
    // Second arg: a number means "also fetch this block height"; otherwise it
    // is a TLS domain override.
    let arg2 = std::env::args().nth(2);
    let block_height = arg2.as_deref().and_then(|s| s.parse::<u64>().ok());
    let host = match &arg2 {
        Some(s) if block_height.is_none() => s.clone(),
        _ => url
            .trim_start_matches("https://")
            .trim_start_matches("http://")
            .split(':')
            .next()
            .unwrap_or("")
            .to_string(),
    };

    let endpoint = match tonic::transport::Endpoint::from_shared(url.clone()) {
        Ok(e) => e.connect_timeout(std::time::Duration::from_secs(12)),
        Err(e) => {
            println!("[{url}] bad url: {e}");
            return;
        }
    };
    let endpoint = if url.starts_with("https") {
        match endpoint.tls_config(
            tonic::transport::ClientTlsConfig::new()
                .domain_name(host.clone())
                .assume_http2(true)
                .with_webpki_roots(),
        ) {
            Ok(e) => e,
            Err(e) => {
                println!("[{url}] tls config: {e}");
                return;
            }
        }
    } else {
        endpoint
    };

    let channel = match endpoint.connect().await {
        Ok(c) => c,
        Err(e) => {
            println!("[{url}] connect failed: {e}");
            return;
        }
    };
    let mut client = CompactTxStreamerClient::new(channel);

    match client.get_lightd_info(service::Empty {}).await {
        Ok(r) => {
            let i = r.into_inner();
            println!(
                "[{url}] OK chain_name={:?} vendor={:?} version={:?} height={} estimated_height={} sapling_activation={}",
                i.chain_name,
                i.vendor,
                i.version,
                i.block_height,
                i.estimated_height,
                i.sapling_activation_height
            );
        }
        Err(e) => println!("[{url}] get_lightd_info failed: {e:?}"),
    }

    match client.get_latest_block(service::ChainSpec {}).await {
        Ok(r) => {
            let b = r.into_inner();
            let mut display = b.hash.clone();
            display.reverse(); // explorers show block hashes big-endian
            println!(
                "[{url}] latest_block height={} hash_be={}",
                b.height,
                hex::encode(display)
            );
        }
        Err(e) => println!("[{url}] get_latest_block failed: {e:?}"),
    }

    if let Some(h) = block_height {
        match client
            .get_block(service::BlockId {
                height: h,
                hash: vec![],
            })
            .await
        {
            Ok(r) => {
                let b = r.into_inner();
                let mut display = b.hash.clone();
                display.reverse();
                println!("[{url}] block {h} hash_be={}", hex::encode(display));
                if let Some(md) = &b.chain_metadata {
                    println!(
                        "[{url}] block {h} tree sizes: sapling={} orchard={} ironwood={}",
                        md.sapling_commitment_tree_size,
                        md.orchard_commitment_tree_size,
                        md.ironwood_commitment_tree_size
                    );
                } else {
                    println!("[{url}] block {h} chain_metadata: NONE");
                }
                println!("[{url}] block {h} vtx count = {}", b.vtx.len());
                for tx in &b.vtx {
                    let mut t = tx.txid.clone();
                    t.reverse(); // display order
                    println!(
                        "  tx {} spends={} outputs={} actions={} ironwood_actions={}",
                        hex::encode(t),
                        tx.spends.len(),
                        tx.outputs.len(),
                        tx.actions.len(),
                        tx.ironwood_actions.len()
                    );
                }
            }
            Err(e) => println!("[{url}] get_block {h} failed: {e:?}"),
        }
    }

    // Optional third arg: a 64-hex txid to look up via GetTransaction.
    let txid = std::env::args()
        .nth(3)
        .filter(|s| s.len() == 64 && s.chars().all(|c| c.is_ascii_hexdigit()));
    if let Some(t) = txid {
        // Display-order hex -> internal little-endian bytes.
        let mut bytes = hex::decode(&t).expect("txid arg is not valid hex");
        bytes.reverse();
        match client
            .get_transaction(service::TxFilter {
                block: None,
                index: 0,
                hash: bytes,
            })
            .await
        {
            Ok(r) => {
                let raw = r.into_inner();
                println!(
                    "[{url}] get_transaction {t}: FOUND raw_len={} height={}",
                    raw.data.len(),
                    raw.height
                );
            }
            Err(e) => println!("[{url}] get_transaction {t} NOT FOUND: {e:?}"),
        }
    }
}
