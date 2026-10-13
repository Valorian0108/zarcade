# Zarcade goes live: the Hetzner walkthrough

This is the click-by-click for giving the arcade its own always-on home
(D-066). You do the clicking, the machine does the work, and the script in
this folder (`setup.sh`) does the building. Budget one evening. After this
evening the arcade never needs your PC again.

What you need before starting:

- An email you check, and your phone (Hetzner may text a code).
- A way to pay Hetzner that is NOT a credit card: PayPal or bank transfer
  both work there. About €4 to €8 a month, cancel anytime, hourly billing.
- Your Namecheap login for obestlink.com (only used at the very end).
- Your Windows PC, for this one session. PowerShell is enough; it already
  has the `ssh` command built in.

---

## Part 1: The Hetzner account

1. Go to `hetzner.com` and click Cloud, then Sign Up (or go straight to
   `console.hetzner.cloud`).
2. Register with your email and a password.
3. They verify new accounts by hand. This can take a few hours, and they
   sometimes ask for a photo ID. This is normal, not a rejection. It is the
   price of their low prices: fewer bots.
4. When asked for payment, choose PayPal or bank transfer. No credit card
   is required for either.

If they refuse the account outright, stop and tell me. We reopen the other
doors from D-065; nothing else changes.

## Part 2: Ordering the machine

1. In the Hetzner Cloud Console, create a project. Name it `zarcade`.
2. Inside the project, click Add Server.
3. Location: your choice. Ashburn (USA) or Falkenstein/Nuremberg (Europe)
   are the common picks. Either is fine for players anywhere.
4. Image: **Ubuntu 24.04**.
5. Type: Shared vCPU. Pick the **cheapest model with at least 4 GB of
   memory** (in Europe that is usually named CX22; in America look at the
   CPX list). Do not pick a 2 GB model; the wallet compilation needs room.
6. Networking: leave the defaults (public IPv4 and IPv6).
7. Credentials: if the form lets you set a **root password** instead of an
   SSH key, use a strong password and store it somewhere safe. If it only
   offers SSH keys, stop and tell me; we generate one together with a
   single command before you continue.
8. Click Create. Within a minute you get the server's IP address. Write it
   down; everything below calls it YOUR-IP.

## Part 3: The firewall (still in the Hetzner console)

1. Open your new server's page, find the Firewall tab.
2. Create a firewall with exactly three rules: TCP 22 (SSH), TCP 80
   (website), TCP 443 (website with padlock).
3. Apply it to the server. Everything else stays shut. The setup script
   adds a second, independent lock (ufw) from inside.

## Part 4: Connecting from your PC

1. Open PowerShell (Start menu, type `powershell`).
2. Type: `ssh root@YOUR-IP` and press Enter.
3. The first time it asks about a fingerprint: type `yes`.
4. It asks for the password. **Typing is invisible**, no dots, nothing.
   That is normal. Paste with a right-click, then press Enter.

You are now inside the rented machine. Everything below happens there.

## Part 5: The one decision, then two pastes

If the GitHub repo is still private, the clone below fails. Making it
public is recommended (the footer link on the site currently leads to a
not-found page while it is private, and the history was verified clean:
the seed and wallet data were never committed). To flip it: GitHub, open
`zarcade`, Settings, scroll to the red Danger Zone at the bottom, Change
visibility, Public, confirm by typing the repo name.

Then, inside the SSH window, paste these two commands one at a time:

```
git clone https://github.com/Valorian0108/zarcade /opt/zarcade
```

```
bash /opt/zarcade/deploy/setup.sh
```

The script talks while it works, step 1 of 9 through 9 of 9. The long
step is the wallet helper compiling (15 to 40 minutes). Do not close the
window. If your connection drops anyway, just SSH back in and run the
second command again; the script is safe to re-run.

## Part 6: Waking the wallet and funding it

The wallet generates its own brand-new seed on first run. Your home seed
never leaves your home. When the script finishes:

1. Check the wallet is awake (give it a few minutes on first run):
   `curl -s 127.0.0.1:9070/health` should answer with `"ok":true`.
2. Get the new deposit address: `curl -s 127.0.0.1:9070/address`
3. Open `https://zakura.com/nu7` in your browser, paste that address,
   claim. One claim is 0.125 TAZ of practice money; the faucet refreshes
   every 24 hours. Use ONLY this faucet: the older ones pay on an
   abandoned fork of the chain.
4. After a minute or two, split the pot so no player ever waits (about
   8 minutes of real proving):

```
TOKEN=$(grep -oP 'ZARCADE_ADMIN_TOKEN=\K[0-9a-f]+' /etc/systemd/system/zarcade-sidecar.service)
curl -s -X POST 127.0.0.1:9070/admin/split \
  -H "x-zarcade-admin: $TOKEN" -H "content-type: application/json" \
  -d '{"notes":40,"per_note":100000}'
```

## Part 7: The name (Namecheap)

1. Log into Namecheap. Domain List, then Manage next to obestlink.com.
2. Advanced DNS tab, Host Records section, Add New Record.
3. Type: **A Record**. Host: **zarcade**. Value: **YOUR-IP**. TTL: Automatic.
4. Save. Nothing else on the domain is touched; this only adds one line.
   Deleting that line later undoes everything.
5. Wait 5 to 60 minutes. Then open `http://zarcade.obestlink.com`. It
   should upgrade itself to https with a padlock: Caddy fetches the
   certificate automatically once the name points at the machine.

## Part 8: Prove it

Play one full round yourself at the public address: choose hidden, pay,
watch the steps, see the payment land in the public record. If that
works, the arcade is live and your PC can sleep forever.

## Part 9: Daily life (keep this)

- After a machine reboot: nothing. Everything restarts itself.
- Site updates after we push changes:

```
cd /opt/zarcade && git pull && npm ci && npm run build && systemctl restart zarcade-web
```

- Wallet helper updates (rare):

```
cd /opt/zarcade/sidecar && git pull && cargo build --release && systemctl restart zarcade-sidecar
```

- Pot running low: claim the faucet again (24h refresh), then re-run the
  split command from Part 6.
- Health checks: `curl -s 127.0.0.1:9070/health` and
  `systemctl status zarcade-sidecar zarcade-web caddy`.
- Logs when something is odd: `journalctl -u zarcade-sidecar -n 50`
  (swap the unit name for zarcade-web or caddy).

## Trouble, plainly

- **Build dies with "killed" or memory errors:** run `free -h`; if swap
  shows 0B, re-run the setup script (it adds swap).
- **Cannot SSH in:** check the Hetzner firewall has TCP 22, and the
  server shows Running in the console.
- **Website says 502:** the web service is still starting; wait a minute,
  then `systemctl status zarcade-web`.
- **No padlock yet:** the name has not propagated. Check at dnschecker.org
  for zarcade.obestlink.com; Caddy logs: `journalctl -u caddy -n 30`.
- **Game says the wallet is not running:** first sync may still be going.
  `curl -s 127.0.0.1:9070/health`, retry in a few minutes.

## Appendix: if the repo stays private

Tell me before the setup session. The clone command changes to an SSH
deploy key (one keygen command, one paste into GitHub settings,
read-only access), and we revisit the footer link, because visitors
clicking GITHUB would hit a not-found page.
