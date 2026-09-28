# =============================================================================
# 3D STL Multipart Maker — pubblica-github.ps1
# Versione: 0.5.2-beta — 2026-09-28 11:47
# -----------------------------------------------------------------------------
# Pubblica il progetto su GitHub in un solo passaggio (da eseguire su Windows):
#  1. installa Git e GitHub CLI se mancano (winget);
#  2. login a GitHub nel browser (solo la prima volta);
#  3. crea il repository pubblico "3d-stl-multipart-maker" (o usa quello esistente)
#     e carica i sorgenti sul ramo main;
#  4. attiva GitHub Pages (sorgente: GitHub Actions) -> sito web;
#  5. crea il tag di versione -> il workflow compila l'exe e crea la Release.
# Uso (PowerShell nella cartella del progetto):
#   powershell -ExecutionPolicy Bypass -File .\pubblica-github.ps1
# =============================================================================
# [2026-09-28 v0.4.0] param([string]$Version = "0.4.0-beta", [string]$Repo = "3d-stl-multipart-maker")
# [2026-09-28 v0.4.1] param([string]$Version = "0.4.1-beta", [string]$Repo = "3d-stl-multipart-maker")
# [2026-09-28 v0.5.0] param([string]$Version = "0.5.0-beta", [string]$Repo = "3d-stl-multipart-maker")
# [2026-09-28 v0.5.1] param([string]$Version = "0.5.1-beta", [string]$Repo = "3d-stl-multipart-maker")
param([string]$Version = "0.5.2-beta", [string]$Repo = "3d-stl-multipart-maker")
# i comandi esterni (git, gh) segnalano gli errori con $LASTEXITCODE: controllo manuale
$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot

# ---- aggiorna il PATH dopo eventuali installazioni ---------------------------
function Update-Path { $env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User") }

# ---- 1. prerequisiti ---------------------------------------------------------
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Write-Host "Installo Git..."; winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements; Update-Path }
if (-not (Get-Command gh  -ErrorAction SilentlyContinue)) { Write-Host "Installo GitHub CLI..."; winget install --id GitHub.cli -e --source winget --accept-package-agreements --accept-source-agreements; Update-Path }

# ---- 2. login (si apre il browser, solo la prima volta) -----------------------
gh auth status 2>$null | Out-Null
# serve anche lo scope "workflow" per caricare i file .github/workflows
if ($LASTEXITCODE -ne 0) { gh auth login --hostname github.com --git-protocol https --web --scopes workflow }
elseif (-not (gh auth status 2>&1 | Select-String -Quiet "'workflow'")) { gh auth refresh --hostname github.com --scopes workflow }
gh auth setup-git | Out-Null
$user = gh api user --jq .login
Write-Host "Account GitHub: $user"

# ---- 3. workflow GitHub Actions ----------------------------------------------
# I file in .github non possono essere scritti dagli strumenti remoti: i
# workflow sono tenuti in _github\workflows e copiati qui prima del commit.
if (Test-Path "_github\workflows") {
  New-Item -ItemType Directory -Force ".github\workflows" | Out-Null
  Copy-Item "_github\workflows\*.yml" ".github\workflows\" -Force
}

# ---- repository locale e commit --------------------------------------------
if (-not (Test-Path .git)) { git init -b main | Out-Null }
if (-not (git config user.name))  { git config user.name  (gh api user --jq '.name // .login') }
if (-not (git config user.email)) { $id = gh api user --jq .id; git config user.email "$id+$user@users.noreply.github.com" }
# v0.4.1: le cartelle ignorate già caricate in passato (es. sorgenti/) vengono tolte dal repository
foreach ($d in @("sorgenti")) { if (git ls-files $d) { git rm -r --cached --quiet $d } }
git add -A
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) { git commit -m "3D STL Multipart Maker v$Version" | Out-Null }

# ---- repository remoto -------------------------------------------------------
gh repo view "$user/$Repo" 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  gh repo create $Repo --public --description "Divide modelli 3D in parti stampabili con giunti - web + Windows portable" --homepage "https://$user.github.io/$Repo/" --source . --remote origin --push
} else {
  if (-not (git remote | Select-String -Quiet "^origin$")) { git remote add origin "https://github.com/$user/$Repo.git" }
  git push -u origin main
}

# ---- 4. GitHub Pages da GitHub Actions ------------------------------------------
gh api -X POST "repos/$user/$Repo/pages" -f build_type=workflow 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) { gh api -X PUT "repos/$user/$Repo/pages" -f build_type=workflow 2>$null | Out-Null }
gh workflow run pages.yml --repo "$user/$Repo" 2>$null | Out-Null

# ---- 5. tag di versione -> Release con l'exe ----------------------------------
$tag = "v$Version"
if (-not (git tag --list $tag)) { git tag $tag }
git push origin $tag

Write-Host ""
Write-Host "Fatto. Tra 2-3 minuti saranno pronti:" -ForegroundColor Green
Write-Host "  Sito web : https://$user.github.io/$Repo/"
Write-Host "  Release  : https://github.com/$user/$Repo/releases"
Write-Host "  Stato    : https://github.com/$user/$Repo/actions"
