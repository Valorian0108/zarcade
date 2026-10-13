# Take Zarcade live on Railway

This is the click-by-click for giving the arcade its own always-on home
using Railway (D-081).  The wallet lives in a separate service that only
the website can talk to, on a private network — the same posture as the
original Hetzner shape, without you touching a server.

The repo stays private.  Railway deploys straight from GitHub using your
account's connection.  You already sorted out the account side when you
brought Railway back up.  The plan is usage based, so keep an eye on the
usage page through the first week.

---

## What you need before starting

- Your Railway account, active and logged in (you said it is back up).
- Your GitHub account connected to Railway (Settings → Identity → GitHub
  when creating a project; or do it inside the flow).
- Your Namecheap login for obestlink.com — only for the last step when
  you connect a custom domain.
- One evening.  Most of it is waiting for the Rust wallet to compile
  (20–40 min the first time; much faster after that thanks to Docker
  layer caching).

---

## Part 1: Create the project and connect the repo

1. Go to `railway.app` → **New Project**.
2. Pick **Deploy from GitHub repo**.
3. Grant Railway access to the `Valorian0108/zarcade` repo if it asks.
   The repo is private — Railway works with private repos through
   GitHub's OAuth; nothing becomes public.
4. Select the `zarcade` repo.  Railway immediately starts deploying from
   the repo root.  That creates the **website** service (which it
   detects as Next.js).  Let it finish — the first build may fail
   because the website's env vars are not set yet; that is fine.
5. Rename this service to **web** so we know which is which:
   - Click the service → **Settings** (gear icon) → **General** →
     **Service Name** → type `web`.
6. Click **Add Service** → **GitHub Repo** → select the same `zarcade`
   repo.  This time, before Railway starts building:
   - Click the new service → **Settings** → **General** → **Root
     Directory** → type `sidecar`
   - Railway sees the Dockerfile inside `sidecar/` and builds the wallet
     sidecar (Rust).  This takes 20–40 minutes the first time.
   - Rename this service to **sidecar**.

> **Why two services?**  The wallet holds real testnet funds.  By keeping
> it in a separate service with *no public domain*, only the website (and
> your account's private network) can reach it.  Same security as the
> original plan where the wallet bound to 127.0.0.1.

---

## Part 2: Set up the sidecar (wallet service)

### Add a persistent volume

The wallet's seed, transaction history, and addresses must survive
redeploys.  Railway containers are ephemeral, so you need a volume.

1. In the **sidecar** service, go to **Settings** → **Volumes**.
2. Click **Add Volume**.
3. Mount path: `/data` (this matches `ZARCADE_DATA_DIR=/data` in the
   Dockerfile).
4. Size: start with 1 GB (wallet data is tiny, ~a few MB).
5. Click **Add**.

### Set the admin token

The admin token protects the `/admin/split` endpoint.  No one can split
the pot without it.

1. Go to **Settings** → **Environment Variables**.
2. Add a variable:
   - **Name**: `ZARCADE_ADMIN_TOKEN`
   - **Value**: (generate a random one — run this in your Windows
     PowerShell and paste the result):

```
-join ((1..64) | ForEach-Object { '{0:x}' -f (Get-Random -Maximum 16) })
```

3. Add another variable:
   - **Name**: `ZARCADE_SIDECAR_BIND`
   - **Value**: `0.0.0.0`

   (This tells the sidecar to listen on the container's network, so
   Railway's private network can route traffic to it.  On your local
   machine it stays on `127.0.0.1`.)

4. Add one more variable:
   - **Name**: `PORT`
   - **Value**: `8080`

   Railway injects a `PORT` variable of its own and defaults it to 8080.
   Declaring it by hand pins the number in place, so the same 8080 shows
   up in three spots and they can never drift apart.

5. **Deploy** the sidecar: go back to the service overview and click
   **Deploy** (or just wait — Railway auto-deploys when env vars change).

### Verify the sidecar works

The sidecar will now be running on the private network.  Let's give it a
temporary public domain so you can test it from your PC.

1. In the **sidecar** service → **Settings** → **Networking**.
2. Click **Generate Domain**.
   - If Railway asks for a **port**, type `8080`.  That is the number the
     sidecar listens on (its `PORT` variable above).  The field is asking
     which inside port to send visitors to, so it must match.
   - Railway gives you a URL like `zarcade-sidecar.up.railway.app`.
     Copy it — you will remove it after setup is done.

Now open a PowerShell window and run these checks:

```
curl https://YOUR-TEMP-DOMAIN/health
curl https://YOUR-TEMP-DOMAIN/address
```

You should see JSON responses.  The address is your new house wallet —
it starts empty.  **Keep this address**, you will fund it in Part 4.

---

## Part 3: Set up the website (Next.js)

### Link the website to the sidecar

The website reads `ZARCADE_SIDECAR_URL` to know where the wallet lives.

1. Go to the **web** service → **Settings** → **Environment Variables**.
2. Add a variable:
   - **Name**: `ZARCADE_SIDECAR_URL`
   - **Value**: `http://${{sidecar.RAILWAY_PRIVATE_DOMAIN}}:8080`

   The `${{sidecar.RAILWAY_PRIVATE_DOMAIN}}` part is a Railway reference
   variable.  It fills in the sidecar's private address.  The `:8080` is
   the port the sidecar listens on, and the private address does not
   carry a port by itself, so we write it here.  The two services can now
   talk over Railway's internal network without going through the public
   internet.

3. **Deploy** the website (click **Deploy** in the service overview).

Railway gives the website a public URL like `zarcade.up.railway.app`.
Test it:

```
curl https://YOUR-WEB-DOMAIN/api/house/status
```

If it replies with the wallet address, the private link works.

---

## Part 4: Fund the wallet

The house wallet needs testnet ZEC before it can pay out players.

1. Go to `zakura.com/nu7` — the only testnet faucet on the current
   canonical chain (the old faucets feed a dead fork).
2. Paste the wallet address you saved in Part 2.
3. Claim.  The faucet sends a few coins.  They arrive in one or more
   shielded transactions.
4. Wait for the sidecar to sync.  Run this every minute or so:

```
curl https://YOUR-TEMP-DOMAIN/balance
```

When the balance shows the faucet's deposit, you are ready.

5. **Split the pot** into shielded notes (the game sends 1,000 zat per
   round, so the pot needs many small notes):

```
curl -X POST https://YOUR-TEMP-DOMAIN/admin/split `
  -H "x-zarcade-admin: YOUR-ADMIN-TOKEN" `
  -H "Content-Type: application/json" `
  -d '{"notes":40,"per_note":100000}'
```

   (The numbers mean: create 40 shielded notes of 100,000 zatoshis
   each = 4,000,000 zat total, which is 0.04 ZEC.  Adjust based on what
   the faucet gave you.)

6. Verify the split worked — check the balance again and look for the
   shielded count in `/health`.

### Remove the temporary domain

Your wallet is now funded.  It does not need a public domain anymore.

- Go back to **sidecar** → **Settings** → **Networking** and **delete**
  the public domain.  The sidecar now answers only the website (via the
  private network) and your account's internal tools.

---

## Part 5: Play a real round

Open your website's public URL in a browser and play one complete hidden
round of **The Unseen**.  This is the proof that everything works end to
end:

- Player sends 1,000 zat → sidecar receives the payment → game says
  "payment hidden"
- Check the balance at the website's status page

---

## Part 6: Add your custom domain (optional)

When you want Zarcade at `zarcade.obestlink.com` instead of a Railway
subdomain:

1. Go to the **web** service → **Settings** → **Networking**.
2. Under **Custom Domains**, type `zarcade.obestlink.com` and click Add.
3. Railway shows you a target like `zarcade.up.railway.app`.
4. Go to Namecheap → Domain List → obestlink.com → Advanced DNS.
5. **Change** the `zarcade` record:
   - **Type**: `CNAME`
   - **Host**: `zarcade`
   - **Target**: (the Railway target from step 3)
   - **TTL**: Automatic
6. Railway automatically provisions a TLS certificate (Let's Encrypt).
   HTTPS works within minutes.

---

## Daily life

- **Pushing code**: every push to `main` on GitHub triggers a Railway
  deploy.  The website rebuilds in ~1 minute.  The sidecar rebuilds
  only if `sidecar/src/` or `sidecar/Cargo.toml` changed (layer caching).
- **Wallet data**: the volume at `/data` survives all redeploys.  Your
  seed, transaction history, and addresses are safe.
- **Pot getting low**: claim more testnet ZEC from the faucet, then
  split again.  The sidecar has no public address in normal life, so to
  run the split curls again, temporarily add a public domain back to the
  sidecar (Settings, Networking), run the curls, then remove it.  The
  admin token guards the split the whole time.

- **Checking logs**: Railway dashboard → service → **Deploy Logs** or
  **Runtime Logs**.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Website shows 500 on game pages | Sidecar not reachable: verify `ZARCADE_SIDECAR_URL` and that the sidecar service is running |
| `/admin/split` returns 403 | Admin token does not match: check `ZARCADE_ADMIN_TOKEN` on the sidecar |
| Sidecar build fails with OOM | Railway's default builder memory is small for the zcash crypto stack.  Go to the sidecar service → **Settings** → **Builder** → increase memory to 4 GB, click Save, then **Deploy** it again. |
| Wallet sync never finishes | The sidecar connects to `testnet.zec.rocks:443` (the canonical lightwalletd endpoint).  If Railway egress is blocked, try setting `ZARCADE_LIGHTWALLETD_URL` to a different endpoint. |
| Website build fails with "Module not found" | Run `npm install` locally and push the updated `package-lock.json`.  Railway runs `npm ci` which requires the lockfile to be up to date. |