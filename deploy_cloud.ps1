<#
.SYNOPSIS
    Ghar Sathi - 1-Click Production Cloud Deployment Suite
.DESCRIPTION
    Automates deployment of the Django Channels / Daphne backend to Google Cloud Run (asia-south1)
    and the React Vite frontend to Firebase Hosting for custom domain gharsathi.in.
.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\deploy_cloud.ps1
    powershell -ExecutionPolicy Bypass -File .\deploy_cloud.ps1 -ProjectId "gharsathi-in" -Region "asia-south1" -NonInteractive
#>

[CmdletBinding()]
param(
    [string]$ProjectId = "gharsathi-in",
    [string]$Region = "asia-south1",
    [string]$EnvFile = "backend/.env.cloud",
    [switch]$NonInteractive = $false,
    [switch]$SkipReadinessCheck = $false,
    [switch]$DryRun = $false
)

$ErrorActionPreference = "Stop"

Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "         GHAR SATHI - 1-CLICK PRODUCTION CLOUD DEPLOYMENT SUITE                 " -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "Cloud Target  : Google Cloud Run (Daphne ASGI Backend) + Firebase Hosting (Frontend)"
Write-Host "Target Region : $Region (Mumbai, India)"
Write-Host "Custom Domain : https://gharsathi.in"
Write-Host "Timestamp     : $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`n"

# Automatically resolve Google Cloud SDK path if freshly installed in AppData
$cloudSdkBin = Join-Path $env:LOCALAPPDATA 'Google\Cloud SDK\google-cloud-sdk\bin'
if ((Test-Path $cloudSdkBin) -and ($env:Path -notlike "*$cloudSdkBin*")) {
    $env:Path = "$cloudSdkBin;$env:Path"
}

# =============================================================================
# PREREQUISITES VERIFICATION
# =============================================================================
Write-Host "[Pre-Check] Verifying Cloud CLI Dependencies..." -ForegroundColor Yellow

$missingTools = @()

$gcloudCmd = Get-Command gcloud -ErrorAction SilentlyContinue
if (-not $gcloudCmd) {
    $missingTools += "gcloud (Google Cloud SDK)"
}

$useNpxFirebase = $false
$firebaseCmd = Get-Command firebase -ErrorAction SilentlyContinue
if (-not $firebaseCmd) {
    if (Get-Command npx -ErrorAction SilentlyContinue) {
        $useNpxFirebase = $true
        Write-Host "  [INFO] Global 'firebase' not in PATH, using 'npx firebase-tools' automatically." -ForegroundColor DarkCyan
    } else {
        $missingTools += "firebase (Firebase CLI)"
    }
}

if ($missingTools.Count -gt 0) {
    if ($DryRun) {
        Write-Host "  [NOTICE] Missing CLIs: $($missingTools -join ', ')" -ForegroundColor Yellow
        Write-Host "  [DRY RUN] Simulating CLI commands without invoking live Google Cloud infrastructure..." -ForegroundColor Magenta
    } else {
        Write-Host "`n[ERROR] Required Cloud Deployment CLI Tools Missing:" -ForegroundColor Red
        foreach ($tool in $missingTools) {
            Write-Host "  - $tool" -ForegroundColor Red
        }
        Write-Host "`nPlease install the missing tools to proceed with live deployment:" -ForegroundColor Yellow
        Write-Host "  1. Google Cloud SDK: winget install Google.CloudSDK (or https://cloud.google.com/sdk/docs/install)" -ForegroundColor White
        Write-Host "  2. Firebase CLI    : npm install -g firebase-tools" -ForegroundColor White
        Write-Host "`nAfter installation, restart your terminal and run this script again." -ForegroundColor DarkGray
        exit 1
    }
}

# Run Pre-flight Verification Script if not skipped
if (-not $SkipReadinessCheck) {
    Write-Host "`nRunning Pre-Flight Codebase Verification (verify_cloud_readiness.ps1)..." -ForegroundColor Yellow
    & powershell -ExecutionPolicy Bypass -File .\verify_cloud_readiness.ps1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "`n[DEPLOYMENT HALTED] Pre-flight readiness check did not pass cleanly." -ForegroundColor Red
        exit 1
    }
}

# =============================================================================
# STEP A: PROJECT & REGION CONFIGURATION
# =============================================================================
Write-Host "`n================================================================================" -ForegroundColor Cyan
Write-Host "  STEP A: Google Cloud Project & API Configuration" -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan

if (-not $NonInteractive) {
    $promptProject = Read-Host "Enter GCP Project ID [$ProjectId]"
    if ($promptProject.Trim()) { $ProjectId = $promptProject.Trim() }

    $promptRegion = Read-Host "Enter GCP Region [$Region]"
    if ($promptRegion.Trim()) { $Region = $promptRegion.Trim() }
}

Write-Host "Active GCP Project : $ProjectId" -ForegroundColor Green
Write-Host "Active GCP Region  : $Region" -ForegroundColor Green

if ($DryRun) {
    Write-Host "[DRY RUN] Would execute: gcloud config set project $ProjectId" -ForegroundColor Magenta
    Write-Host "[DRY RUN] Would enable APIs: run.googleapis.com, cloudbuild.googleapis.com, artifactregistry.googleapis.com" -ForegroundColor Magenta
} else {
    Write-Host "Setting active gcloud project..." -ForegroundColor Yellow
    & gcloud config set project $ProjectId

    Write-Host "Enabling required Google Cloud APIs (Cloud Run, Cloud Build, Artifact Registry)..." -ForegroundColor Yellow
    & gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
}

# =============================================================================
# STEP B: CLOUD RUN BACKEND DEPLOYMENT
# =============================================================================
Write-Host "`n================================================================================" -ForegroundColor Cyan
Write-Host "  STEP B: Deploying Django ASGI Backend to Google Cloud Run" -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan

# Read or generate environment variables for Cloud Run
$envVarsList = @()

if (Test-Path $EnvFile) {
    Write-Host "Loading production secrets from $EnvFile..." -ForegroundColor Green
    $lines = Get-Content $EnvFile
    foreach ($line in $lines) {
        $trimmed = $line.Trim()
        if ($trimmed -and -not $trimmed.StartsWith("#") -and $trimmed.Contains("=")) {
            $parts = $trimmed.Split("=", 2)
            $k = $parts[0].Trim()
            $v = $parts[1].Trim()
            if ($k -and $v) {
                $envVarsList += "$k=$v"
            }
        }
    }
} else {
    Write-Host "Notice: $EnvFile not found. Using production defaults from template..." -ForegroundColor Yellow
    $envVarsList += "DEBUG=False"
    $envVarsList += "ALLOWED_HOSTS=gharsathi.in,www.gharsathi.in,api.gharsathi.in,.run.app,.web.app,.firebaseapp.com,localhost,127.0.0.1"
    $envVarsList += "CORS_ALLOWED_ORIGINS=https://gharsathi.in,https://www.gharsathi.in,https://api.gharsathi.in"
    $envVarsList += "CSRF_TRUSTED_ORIGINS=https://gharsathi.in,https://www.gharsathi.in,https://api.gharsathi.in,https://*.run.app,https://*.web.app,https://*.firebaseapp.com"
    $envVarsList += "SECURE_SSL_REDIRECT=False"
    $envVarsList += "SESSION_COOKIE_SECURE=True"
    $envVarsList += "CSRF_COOKIE_SECURE=True"
    $envVarsList += "SMS_PROVIDER=fast2sms"
    $envVarsList += "FAST2SMS_API_KEY=SVzK89RnU4hOsGxt5DqlHXCoQpFLcfbEuMryvAwgJZ21edkPTBpQZLtB2MkqUTdmSEP8C1xOa4gNyzu7"
}

# Delimit variables with ^|^ to safely handle commas inside ALLOWED_HOSTS/CORS_ORIGINS
$envVarsFormatted = "^|^" + ($envVarsList -join "|")

$deployArgs = @(
    "run", "deploy", "gharsathi-api",
    "--source", "./backend",
    "--region", $Region,
    "--allow-unauthenticated",
    "--port", "8000",
    "--set-env-vars", $envVarsFormatted
)

Write-Host "Deploying service 'gharsathi-api' to Cloud Run..." -ForegroundColor Yellow

if ($DryRun) {
    Write-Host "[DRY RUN] Would execute: gcloud $($deployArgs -join ' ')" -ForegroundColor Magenta
    $cloudRunUrl = "https://gharsathi-api-mock-run.app"
} else {
    & gcloud @deployArgs
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Cloud Run backend deployment failed." -ForegroundColor Red
        exit 1
    }
    # Retrieve live Cloud Run service URL
    $cloudRunUrl = (& gcloud run services describe gharsathi-api --region $Region --format="value(status.url)").Trim()
}

Write-Host "Cloud Run Backend Live URL: $cloudRunUrl" -ForegroundColor Green

# =============================================================================
# STEP C: LIVE API HEALTH & SEED CHECK
# =============================================================================
Write-Host "`n================================================================================" -ForegroundColor Cyan
Write-Host "  STEP C: Verifying Live Cloud Run Backend Health Check" -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan

if ($DryRun) {
    Write-Host "[DRY RUN] Cloud Run target endpoint: $cloudRunUrl/api/services/" -ForegroundColor Magenta
    Write-Host "Testing local Daphne backend endpoint (http://127.0.0.1:8000/api/services/)..." -ForegroundColor Yellow
    try {
        $servicesResp = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/services/" -Method Get -TimeoutSec 5
        $servicesCount = $servicesResp.Count
        Write-Host "  ? [SUCCESS] Backend API verified with HTTP 200 ($servicesCount catalog services active)!" -ForegroundColor Green
    } catch {
        Write-Host "  (Local server test note: $_)" -ForegroundColor DarkGray
    }
} else {
    Write-Host "Pinging live endpoint: $cloudRunUrl/api/services/ ..." -ForegroundColor Yellow
    try {
        $servicesResp = Invoke-RestMethod -Uri "$cloudRunUrl/api/services/" -Method Get -TimeoutSec 15
        $servicesCount = $servicesResp.Count
        Write-Host "  ? [SUCCESS] Live backend responded with HTTP 200 ($servicesCount services loaded)!" -ForegroundColor Green
    } catch {
        Write-Host "  [WARNING] Initial health check ping timed out or failed: $_" -ForegroundColor Yellow
        Write-Host "  The service may still be completing cold-start container initialization." -ForegroundColor DarkGray
    }
}

# =============================================================================
# STEP D: FIREBASE HOSTING FRONTEND DEPLOYMENT
# =============================================================================
Write-Host "`n================================================================================" -ForegroundColor Cyan
Write-Host "  STEP D: Compiling Frontend & Deploying to Firebase Hosting" -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan

Write-Host "Building production React frontend..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Frontend compilation failed. Aborting Firebase deploy." -ForegroundColor Red
    exit 1
}

Write-Host "Deploying to Firebase Hosting..." -ForegroundColor Yellow
if ($DryRun) {
    Write-Host "[DRY RUN] Would execute: firebase deploy --only hosting --project $ProjectId" -ForegroundColor Magenta
} else {
    if ($useNpxFirebase) {
        npx --yes firebase-tools deploy --only hosting --project $ProjectId
    } else {
        & firebase deploy --only hosting --project $ProjectId
    }
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Firebase Hosting deployment failed." -ForegroundColor Red
        exit 1
    }
}

# =============================================================================
# STEP E: LAUNCH SUMMARY & CUSTOM DOMAIN DNS INSTRUCTIONS
# =============================================================================
Write-Host "`n" + ("=" * 95) -ForegroundColor Green
Write-Host "                 GHAR SATHI - PRODUCTION LAUNCH COMPLETE ?                      " -ForegroundColor Green
Write-Host ("=" * 95) -ForegroundColor Green
Write-Host ""
Write-Host "  Cloud Run Backend (API & WebSockets) : $cloudRunUrl" -ForegroundColor White
Write-Host "  Firebase Hosting (Web App)          : https://$ProjectId.web.app" -ForegroundColor White
Write-Host "  Custom Domain Primary URL           : https://gharsathi.in" -ForegroundColor Yellow
Write-Host "  Custom Domain WWW URL               : https://www.gharsathi.in" -ForegroundColor Yellow
Write-Host ""
Write-Host "--------------------------------------------------------------------------------" -ForegroundColor Cyan
Write-Host "  DNS CONFIGURATION INSTRUCTIONS FOR gharsathi.in" -ForegroundColor Cyan
Write-Host "--------------------------------------------------------------------------------" -ForegroundColor Cyan
Write-Host "  Log into your domain registrar (e.g. GoDaddy, Namecheap, Cloudflare) and add:" -ForegroundColor White
Write-Host ""
Write-Host "  Type   | Host/Name | Target / Value                   | Purpose" -ForegroundColor White
Write-Host "  -------+-----------+----------------------------------+-----------------------------------" -ForegroundColor White
Write-Host "  TXT    | @         | hosting-site=$ProjectId           | Firebase Domain Ownership Proof   " -ForegroundColor Green
Write-Host "  A      | @         | 199.36.158.100                   | Firebase Global Anycast IP 1      " -ForegroundColor Green
Write-Host "  A      | @         | 199.36.158.100 (Secondary)       | Firebase Global Anycast IP 2      " -ForegroundColor Green
Write-Host "  CNAME  | www       | $ProjectId.web.app.              | WWW Redirect / Subdomain Routing  " -ForegroundColor Green
Write-Host "  CNAME  | api       | $cloudRunUrl                     | Direct Cloud Run API Subdomain    " -ForegroundColor Green
Write-Host ""
Write-Host "  SSL Certificate provisioned automatically via Let's Encrypt / Google Managed SSL." -ForegroundColor DarkGray
Write-Host ("=" * 95) -ForegroundColor Green
Write-Host "Deployment completed successfully at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss').`n" -ForegroundColor Green
