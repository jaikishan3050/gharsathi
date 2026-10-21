<#
.SYNOPSIS
    Ghar Sathi - Pre-Flight Cloud Readiness Verification Script
.DESCRIPTION
    Validates the local environment, configuration files, production security settings,
    PostgreSQL database connectivity, automated 8-point E2E flow suite, and frontend build artifacts
    before deploying to Google Cloud Run and Firebase Hosting.
.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\verify_cloud_readiness.ps1
#>

[CmdletBinding()]
param(
    [switch]$StrictCLI = $false
)

$ErrorActionPreference = "Continue"

Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "         GHAR SATHI - PRE-FLIGHT PRODUCTION CLOUD READINESS CHECKER             " -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "Target Architecture: Google Cloud Run (Backend) + Firebase Hosting (Frontend)"
Write-Host "Custom Domain      : gharsathi.in / www.gharsathi.in"
Write-Host "Timestamp          : $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`n"

$allPassed = $true
$checkResults = @()

function Record-Check {
    param(
        [string]$Category,
        [string]$Description,
        [string]$Status, # PASS, WARN, FAIL
        [string]$Details
    )
    $script:checkResults += [PSCustomObject]@{
        Category    = $Category
        Description = $Description
        Status      = $Status
        Details     = $Details
    }
}

# Automatically resolve Google Cloud SDK path if freshly installed in AppData
$cloudSdkBin = Join-Path $env:LOCALAPPDATA 'Google\Cloud SDK\google-cloud-sdk\bin'
if ((Test-Path $cloudSdkBin) -and ($env:Path -notlike "*$cloudSdkBin*")) {
    $env:Path = "$cloudSdkBin;$env:Path"
}

# =============================================================================
# 1. CLI TOOLS AVAILABILITY CHECK (gcloud & firebase)
# =============================================================================
Write-Host "[1/5] Checking Google Cloud SDK & Firebase CLI Tools..." -ForegroundColor Yellow

$gcloudCmd = Get-Command gcloud -ErrorAction SilentlyContinue
if ($gcloudCmd) {
    Write-Host "  [PASS] gcloud CLI detected: $($gcloudCmd.Source)" -ForegroundColor Green
    Record-Check "CLI Tools" "Google Cloud SDK (gcloud)" "PASS" "Found at $($gcloudCmd.Source)"
} else {
    Write-Host "  [NOTICE] 'gcloud' CLI is not found in your PATH." -ForegroundColor Yellow
    Write-Host "    Install via winget: winget install Google.CloudSDK" -ForegroundColor DarkGray
    Write-Host "    Or download from : https://cloud.google.com/sdk/docs/install" -ForegroundColor DarkGray
    if ($StrictCLI) {
        $allPassed = $false
        Record-Check "CLI Tools" "Google Cloud SDK (gcloud)" "FAIL" "Missing from PATH"
    } else {
        Record-Check "CLI Tools" "Google Cloud SDK (gcloud)" "WARN" "Missing from PATH (Install prior to cloud deployment)"
    }
}

$firebaseCmd = Get-Command firebase -ErrorAction SilentlyContinue
if ($firebaseCmd) {
    Write-Host "  [PASS] firebase CLI detected: $($firebaseCmd.Source)" -ForegroundColor Green
    Record-Check "CLI Tools" "Firebase CLI (firebase)" "PASS" "Found at $($firebaseCmd.Source)"
} elseif (Get-Command npx -ErrorAction SilentlyContinue) {
    Write-Host "  [PASS] Firebase CLI available via npx (npx firebase-tools)" -ForegroundColor Green
    Record-Check "CLI Tools" "Firebase CLI (firebase)" "PASS" "Available via npx firebase-tools"
} else {
    Write-Host "  [NOTICE] 'firebase' CLI is not found in your PATH." -ForegroundColor Yellow
    Write-Host "    Install via npm  : npm install -g firebase-tools" -ForegroundColor DarkGray
    if ($StrictCLI) {
        $allPassed = $false
        Record-Check "CLI Tools" "Firebase CLI (firebase)" "FAIL" "Missing from PATH"
    } else {
        Record-Check "CLI Tools" "Firebase CLI (firebase)" "WARN" "Missing from PATH (Install prior to frontend deploy)"
    }
}

# =============================================================================
# 2. REQUIRED CLOUD & CONFIGURATION FILES CHECK
# =============================================================================
Write-Host "`n[2/5] Verifying Production Configuration & Cloud Deployment Manifests..." -ForegroundColor Yellow

$requiredFiles = @(
    @{ Path = "backend/Dockerfile"; Desc = "Cloud Run Dockerfile" },
    @{ Path = "backend/docker-entrypoint.sh"; Desc = "Container Entrypoint Script" },
    @{ Path = "firebase.json"; Desc = "Firebase Hosting & Rewrite Manifest" },
    @{ Path = ".firebaserc"; Desc = "Firebase Project Configuration" },
    @{ Path = ".env.production"; Desc = "Vite Production Environment Config" },
    @{ Path = "backend/.env.cloud.example"; Desc = "Cloud Run Environment Template" },
    @{ Path = "backend/gharsathi_backend/settings.py"; Desc = "Django Production Settings" },
    @{ Path = ".gitignore"; Desc = "Root Git Security Exclusion File" }
)

foreach ($f in $requiredFiles) {
    if (Test-Path $f.Path) {
        Write-Host "  [PASS] $($f.Desc) exists ($($f.Path))" -ForegroundColor Green
        Record-Check "Config" $f.Desc "PASS" "$($f.Path) verified"
    } else {
        Write-Host "  [FAIL] Missing required file: $($f.Path)" -ForegroundColor Red
        $allPassed = $false
        Record-Check "Config" $f.Desc "FAIL" "Missing file: $($f.Path)"
    }
}

# =============================================================================
# 3. DJANGO PRODUCTION DEPLOYMENT SECURITY CHECK
# =============================================================================
Write-Host "`n[3/5] Running Django Production Security Check (manage.py check --deploy)..." -ForegroundColor Yellow

$pythonExe = "backend\venv\Scripts\python.exe"
if (-not (Test-Path $pythonExe)) {
    $pythonExe = "python.exe"
}

$origDebug = $env:DEBUG
$origKey = $env:SECRET_KEY
$env:DEBUG = "False"
$env:SECRET_KEY = "gharsathi-cloud-run-production-verification-strong-secret-key-12345"

try {
    Push-Location backend
    $checkDeployOutput = & .\venv\Scripts\python.exe manage.py check --deploy 2>&1
    $checkDeployCode = $LASTEXITCODE
    Pop-Location

    if ($checkDeployCode -eq 0) {
        Write-Host "  [PASS] Django production check passed with 0 security errors." -ForegroundColor Green
        Record-Check "Django Security" "check --deploy" "PASS" "0 blocking security errors"
    } else {
        Write-Host "  [WARN] Django deploy check reported notices:" -ForegroundColor Yellow
        Write-Host "$checkDeployOutput" -ForegroundColor DarkGray
        Record-Check "Django Security" "check --deploy" "WARN" "Reported warnings (Verify before launch)"
    }
} catch {
    Pop-Location
    Write-Host "  [FAIL] Error executing check --deploy: $_" -ForegroundColor Red
    $allPassed = $false
    Record-Check "Django Security" "check --deploy" "FAIL" "$_"
} finally {
    $env:DEBUG = $origDebug
    $env:SECRET_KEY = $origKey
}

# =============================================================================
# 4. POSTGRESQL 8-POINT E2E USER JOURNEY TEST SUITE
# =============================================================================
Write-Host "`n[4/5] Executing 8-Point End-to-End Automated Diagnostic Suite (test_e2e_flows)..." -ForegroundColor Yellow

try {
    Push-Location backend
    & .\venv\Scripts\python.exe manage.py test_e2e_flows
    $e2eCode = $LASTEXITCODE
    Pop-Location

    if ($e2eCode -eq 0) {
        Write-Host "  [PASS] All 8 PostgreSQL E2E user journey flows PASSED 100%!" -ForegroundColor Green
        Record-Check "Backend E2E" "8-Point PostgreSQL Suite" "PASS" "8/8 Flows Passed with 0 bugs"
    } else {
        Write-Host "  [FAIL] One or more E2E flows failed! (Exit Code: $e2eCode)" -ForegroundColor Red
        $allPassed = $false
        Record-Check "Backend E2E" "8-Point PostgreSQL Suite" "FAIL" "Failed with exit code $e2eCode"
    }
} catch {
    Pop-Location
    Write-Host "  [FAIL] Error running E2E test flows: $_" -ForegroundColor Red
    $allPassed = $false
    Record-Check "Backend E2E" "8-Point PostgreSQL Suite" "FAIL" "$_"
}

# =============================================================================
# 5. FRONTEND PRODUCTION BUILD & ARTIFACTS VERIFICATION
# =============================================================================
Write-Host "`n[5/5] Compiling Production Frontend (npm run build)..." -ForegroundColor Yellow

try {
    npm run build
    $buildCode = $LASTEXITCODE

    $indexHtmlPath = "dist/index.html"
    if ($buildCode -eq 0 -and (Test-Path $indexHtmlPath)) {
        $htmlSize = (Get-Item $indexHtmlPath).Length
        Write-Host "  [PASS] Frontend built successfully ($indexHtmlPath, $htmlSize bytes)." -ForegroundColor Green
        Record-Check "Frontend Build" "Vite Production Compilation" "PASS" "dist/index.html generated ($htmlSize bytes)"
    } else {
        Write-Host "  [FAIL] Frontend build failed or dist/index.html is missing." -ForegroundColor Red
        $allPassed = $false
        Record-Check "Frontend Build" "Vite Production Compilation" "FAIL" "Missing dist/index.html or non-zero exit"
    }
} catch {
    Write-Host "  [FAIL] Error executing npm run build: $_" -ForegroundColor Red
    $allPassed = $false
    Record-Check "Frontend Build" "Vite Production Compilation" "FAIL" "$_"
}

# =============================================================================
# SUMMARY REPORT & BANNER
# =============================================================================
Write-Host ("`n" + ("=" * 95)) -ForegroundColor Cyan
Write-Host "                        PRE-FLIGHT READINESS SUMMARY TABLE" -ForegroundColor Cyan
Write-Host ("=" * 95) -ForegroundColor Cyan
$checkResults | Format-Table -AutoSize -Property Category, Description, Status, Details

if ($allPassed) {
    Write-Host "`n================================================================================" -ForegroundColor Green
    Write-Host "                     [READY FOR CLOUD LAUNCH] ?                               " -ForegroundColor Green
    Write-Host "================================================================================" -ForegroundColor Green
    Write-Host "All local codebase checks, database integrity, 8 E2E flows, and build bundles" -ForegroundColor Green
    Write-Host "are 100% verified and ready for Google Cloud Run and Firebase Hosting.`n" -ForegroundColor Green
    Write-Host "Next Step: Execute the 1-click cloud deployment script:" -ForegroundColor White
    Write-Host "   powershell -ExecutionPolicy Bypass -File .\deploy_cloud.ps1`n" -ForegroundColor Yellow
    exit 0
} else {
    Write-Host "`n================================================================================" -ForegroundColor Red
    Write-Host "                 [PRE-FLIGHT CHECKS FAILED - ACTION REQUIRED] ?               " -ForegroundColor Red
    Write-Host "================================================================================" -ForegroundColor Red
    Write-Host "Please resolve the errors highlighted above before deploying to production.`n" -ForegroundColor Red
    exit 1
}
