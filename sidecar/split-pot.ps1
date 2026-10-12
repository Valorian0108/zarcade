# Split the arcade pot into many small coins, so players can follow each other
# straight away instead of waiting for the network (D-031).
#
# Run this BEFORE a session, not while people are queued. It takes about eight
# minutes and nobody can play during it, because the wallet builds a single
# transaction containing one zero-knowledge proof per coin.
#
#   powershell -File sidecar\split-pot.ps1
#   powershell -File sidecar\split-pot.ps1 -Notes 20 -PerNote 20000
#   powershell -File sidecar\split-pot.ps1 -Yes        # skip the confirmation
#
# The admin token comes from ZARCADE_ADMIN_TOKEN, the same value the sidecar was
# started with. If it is not set in this shell you are asked for it.

param(
    [int]$Notes = 40,
    [int]$PerNote = 20000,
    [string]$Sidecar = "http://127.0.0.1:9070",
    [switch]$Yes
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# A coin worth 5,000 zatoshis or less is treated as dust by the wallet and will
# never be spent again. The money is not lost, it is just unusable (RESEARCH I5).
$DustFloor = 5000
# ZIP 317: the fee is 5,000 per logical action. A split of N coins has N outputs
# plus one change output, measured exactly twice as 5,000 x (N + 1) (RESEARCH I7).
$FeePerAction = 5000

function Stop-Here([string]$message) {
    Write-Host ""
    Write-Host $message -ForegroundColor Red
    exit 1
}

function Read-ErrorBody($caught) {
    if ($caught.ErrorDetails -and $caught.ErrorDetails.Message) {
        return $caught.ErrorDetails.Message
    }
    return $caught.Exception.Message
}

# 1. Token. ---------------------------------------------------------------
$token = $env:ZARCADE_ADMIN_TOKEN
if (-not $token) {
    $token = Read-Host "Admin token (the ZARCADE_ADMIN_TOKEN the sidecar was started with)"
}
if (-not $token) { Stop-Here "No token given, nothing sent." }

# 2. Is the wallet even running? -----------------------------------------
try {
    $health = Invoke-RestMethod -Uri "$Sidecar/health" -Method Get -TimeoutSec 20
} catch {
    Stop-Here "Cannot reach the wallet at $Sidecar. Start the sidecar first (see README)."
}
Write-Host ""
Write-Host ("Wallet is up. Last block it has on record: {0}" -f $health.synced_to)

# 3. What can it actually spend right now? -------------------------------
try {
    $bal = Invoke-RestMethod -Uri "$Sidecar/balance" -Method Get -TimeoutSec 120
} catch {
    Stop-Here ("Could not read the balance: " + (Read-ErrorBody $_))
}
$spendable = [int64]$bal.spendable_zatoshis
$pending = [int64]$bal.pending_change_zatoshis

# 4. Bounds and affordability, checked here so a mistake costs nothing. ---
if ($PerNote -le $DustFloor) {
    Stop-Here ("Each coin must be worth more than {0} zatoshis, or the wallet treats it as dust and will never spend it. Nothing sent." -f $DustFloor)
}
$fee = $FeePerAction * ($Notes + 1)
$coins = $Notes * $PerNote
$cost = $coins + $fee

Write-Host ""
Write-Host ("Making {0} coins of {1} zatoshis each." -f $Notes, $PerNote)
Write-Host ("That needs {0} for the coins plus at least {1} in fees = {2} zatoshis." -f $coins, $fee, $cost)
Write-Host "The fee is 5,000 per logical action, so it can come out higher than that if the"
Write-Host "wallet has to gather the money from several small coins instead of one large one."
Write-Host "The wallet has the final say and will refuse rather than overspend."
Write-Host ("Spendable now: {0} zatoshis." -f $spendable)
if ($pending -gt 0) {
    Write-Host ("Also {0} zatoshis still landing from a previous payment, not usable yet." -f $pending) -ForegroundColor Yellow
}
if ($spendable -lt $cost) {
    Stop-Here ("Not enough. Short by {0} zatoshis. Use fewer or smaller coins, or top up the arcade first. Nothing sent." -f ($cost - $spendable))
}

# 5. Confirm, because this blocks the arcade for eight minutes. -----------
if (-not $Yes) {
    Write-Host ""
    Write-Host "This takes about eight minutes and NOBODY can play while it runs." -ForegroundColor Yellow
    Write-Host "Players who try get told the arcade is refilling, so nothing looks broken."
    $null = Read-Host "Press Enter to go ahead, or Ctrl+C to stop"
}

# 6. Build and broadcast. The request body goes through a file: PowerShell
#    mangles inline JSON, which was already learned the hard way.
$bodyFile = Join-Path $env:TEMP "zarcade-split.json"
$json = '{"notes":' + $Notes + ',"per_note":' + $PerNote + '}'
[IO.File]::WriteAllText($bodyFile, $json, (New-Object System.Text.UTF8Encoding($false)))

Write-Host ""
Write-Host "Building. About twelve seconds per coin, so please wait." -ForegroundColor Cyan
$watch = [System.Diagnostics.Stopwatch]::StartNew()
try {
    $r = Invoke-RestMethod -Uri "$Sidecar/admin/split" -Method Post -ContentType "application/json" `
        -Headers @{ "x-zarcade-admin" = $token } -InFile $bodyFile -TimeoutSec 1800
} catch {
    Stop-Here ("The wallet refused: " + (Read-ErrorBody $_))
}
$watch.Stop()
Write-Host ("Built and broadcast in {0:n0} seconds." -f $watch.Elapsed.TotalSeconds) -ForegroundColor Green
Write-Host ("Transaction: " + $r.txid)
Write-Host ("See it:      " + $r.explorer)

# 7. Watch it land, so "ready to use" means ready and not merely sent. ----
Write-Host ""
Write-Host "Waiting for the network to agree on it." -ForegroundColor Cyan
$wait = [System.Diagnostics.Stopwatch]::StartNew()
while ($true) {
    Start-Sleep -Seconds 8
    try {
        $s = Invoke-RestMethod -Uri "$Sidecar/tx-status?txid=$($r.txid)" -Method Get -TimeoutSec 40
    } catch {
        Write-Host "  (could not read the status, trying again)"
        continue
    }
    if ($s.landed) {
        $wait.Stop()
        Write-Host ""
        Write-Host ("Landed in block {0} after {1:n0} seconds, {2} confirmation(s)." -f $s.mined_height, $wait.Elapsed.TotalSeconds, $s.confirmations) -ForegroundColor Green
        Write-Host ("The {0} coins are ready. That is about {0} rounds of back-to-back play." -f $Notes) -ForegroundColor Green
        break
    }
    Write-Host ("  still landing... {0:n0}s, chain tip {1}" -f $wait.Elapsed.TotalSeconds, $s.tip)
}
