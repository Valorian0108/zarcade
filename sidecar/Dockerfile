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

# Now the real source.  Cargo decides what to recompile by comparing
# timestamps, and the stand-in main.rs above was written moments ago by this
# same build, so a plain copy can leave cargo convinced the crate is already
# built.  When that happened the image shipped the stand-in: it starts, prints
# nothing and exits 0, which the platform reports as a successful deploy while
# the wallet is simply absent (D-098, 2026-10-16).  Touching the sources forces
# the real crate to build.  Dependencies stay cached, so this is still quick.
COPY src ./src
RUN find src -type f -exec touch {} + \
    && cargo build --release --bin zarcade-sidecar

# Refuse to ship a stand-in.  The real binary carries our startup line and
# weighs tens of megabytes (bundled proving parameters); the stand-in is a few
# hundred kilobytes and says nothing.  Failing the build here is loud, which is
# the point: a silent stand-in must never reach a deployment again.
RUN grep -aq "zarcade-sidecar listening" target/release/zarcade-sidecar \
    || { echo "refusing to ship a stand-in binary: the real sidecar did not build"; exit 1; }

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

# The rented home pins PORT=8080 (D-083), so that is the port the
# sidecar listens on there.  Local runs, which set no PORT, stay on 9070.
EXPOSE 8080
CMD ["zarcade-sidecar"]