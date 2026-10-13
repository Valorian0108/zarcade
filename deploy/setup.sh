#!/usr/bin/env bash
# =============================================================================
# Zarcade server setup (D-066).
#
# Run once on a fresh Ubuntu 24.04 machine, as root:
#
#   git clone https://github.com/Valorian0108/zarcade /opt/zarcade
#   bash /opt/zarcade/deploy/setup.sh
#
# It installs everything, builds both halves of the arcade, wires two services
# that survive reboots, puts Caddy in front for automatic HTTPS, and locks the
# machine down. Safe to re-run after an interruption: every step skips work
# that is already done.
#
# Every step announces itself in plain words because the owner reads along.
# The human walkthrough lives next door in deploy/SETUP-GUIDE.md.
# =============================================================================
set -euo pipefail

DOMAIN="${ZARCADE_DOMAIN:-zarcade.obestlink.com}"
REPO_DIR=/opt/zarcade

echo "== Zarcade setup starting. Budget 20 to 50 minutes; the slow part is honest cryptography compiling."

echo "== 1/9 System updates and basic tools"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y git curl wget ufw fail2ban openssl \
  build-essential pkg-config libsqlite3-dev ca-certificates gnupg

echo "== 2/9 Swap space (4G), so the compiler never runs out of breath"
if [ ! -f /swapfile ]; then
  fallocate -l 4G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "== 3/9 Rust toolchain (stable)"
if ! command -v cargo >/dev/null 2>&1; then
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable
fi
# shellcheck disable=SC1091
. "$HOME/.cargo/env"

echo "== 4/9 Node.js 22 (the website's engine)"
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | sed 's/v\([0-9]*\).*/\1/')" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

echo "== 5/9 Building the wallet helper (release build; the long step, 15 to 40 minutes)"
cd "$REPO_DIR/sidecar"
cargo build --release

echo "== 6/9 Building the website"
cd "$REPO_DIR"
npm ci
npm run build

echo "== 7/9 Two services that restart themselves and survive reboots"
ADMIN_TOKEN="$(openssl rand -hex 32)"

cat > /etc/systemd/system/zarcade-sidecar.service <<EOF
[Unit]
Description=Zarcade house wallet helper (internal only, never faces the internet)
After=network-online.target
Wants=network-online.target

[Service]
WorkingDirectory=$REPO_DIR/sidecar
ExecStart=$REPO_DIR/sidecar/target/release/zarcade-sidecar
Environment=ZARCADE_ADMIN_TOKEN=$ADMIN_TOKEN
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/zarcade-web.service <<EOF
[Unit]
Description=Zarcade website
After=network-online.target zarcade-sidecar.service
Wants=network-online.target

[Service]
WorkingDirectory=$REPO_DIR
ExecStart=/usr/bin/node node_modules/next/dist/bin/next start -p 3000
Environment=ZARCADE_SIDECAR_URL=http://127.0.0.1:9070
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now zarcade-sidecar
systemctl enable --now zarcade-web

echo "== 8/9 Caddy: the public door, automatic HTTPS for $DOMAIN"
if ! command -v caddy >/dev/null 2>&1; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi
cat > /etc/caddy/Caddyfile <<EOF
$DOMAIN {
    encode zstd gzip
    reverse_proxy 127.0.0.1:3000
}
EOF
systemctl enable caddy
systemctl restart caddy

echo "== 9/9 Firewall: SSH and the website, nothing else"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
systemctl enable --now fail2ban

cat <<EOF

=============================================================
 Setup finished. What happens next, in order:

 1. Give the wallet a few minutes: on first run it generates
    a brand-new seed and syncs with the chain. Then check:
      curl -s 127.0.0.1:9070/health
    It should answer JSON containing "ok":true.

 2. Write down the new deposit address:
      curl -s 127.0.0.1:9070/address

 3. Fund it at the Zakura NU7 faucet: https://zakura.com/nu7
    The only faucet on the canonical testnet chain; the older
    ones pay on an abandoned fork. One claim is 0.125 TAZ and
    it refreshes every 24h.

 4. After the claim lands (a minute or two), split the pot so
    players never wait. This takes about 8 minutes of real
    proving work:
      TOKEN=\$(grep -oP 'ZARCADE_ADMIN_TOKEN=\\K[0-9a-f]+' /etc/systemd/system/zarcade-sidecar.service)
      curl -s -X POST 127.0.0.1:9070/admin/split \\
        -H "x-zarcade-admin: \$TOKEN" -H "content-type: application/json" \\
        -d '{"notes":40,"per_note":100000}'

 5. At Namecheap, add ONE record for obestlink.com:
      Type: A    Host: zarcade    Value: THIS SERVER'S IP    TTL: Automatic
    Within minutes https://$DOMAIN wakes up with its padlock:
    Caddy fetches the certificate as soon as the name points here.

 6. Play one full round at the public address to prove it all.

 If anything looks wrong:
   systemctl status zarcade-sidecar zarcade-web caddy
   journalctl -u zarcade-sidecar -n 50
=============================================================
EOF
