# Zarcade sidecar — multi-stage Docker build for Railway (D-081).
#
# Stage one: build the Rust binary with a release profile (D-066 asked
# for shipping quality, and Railway's builders are beefy enough that the
# full zcash crypto stack compiles in a single deploy).
FROM rust:bookworm AS builder
WORKDIR /build

# Cache the dependency tree: copy manifests first, make a dummy main so
# cargo can fetch and compile all deps.  Our own code changes (much more
# frequent than deps) then rebuild only the crate layer.
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo 'fn main() {}' > src/main.rs &&  \
    cargo build --release --bin zarcade-sidecar 2>/dev/null; true

# Now the real source — cargo sees timestamps change and recompiles
# only the sidecar crate, not the heavy zcash stack.
COPY src ./src
RUN cargo build --release --bin zarcade-sidecar

# Stage two: a tiny runtime.  The proving parameters are bundled into
# the binary (bundled-prover), so no downloads or parameter files are
# needed at startup.
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /build/target/release/zarcade-sidecar /usr/local/bin/zarcade-sidecar

# Wallet data (seed.hex, wallet.sqlite, addresses) lives on a Railway
# volume mounted at /data.  Railway refuses the Dockerfile VOLUME
# keyword ("use Railway Volumes"), so the volume is attached from the
# dashboard instead, at the same path this variable points to.
ENV ZARCADE_DATA_DIR=/data

EXPOSE 9070
CMD ["zarcade-sidecar"]