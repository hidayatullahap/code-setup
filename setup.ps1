& {
    $ErrorActionPreference = "Stop"

    $RepoUrl = "https://github.com/hidayatullahap/code-setup.git"
    $RepoBranch = "main"

    foreach ($commandName in @("git", "node")) {
        if (-not (Get-Command $commandName -ErrorAction SilentlyContinue)) {
            throw "$commandName is required but not found. Install it first and re-run setup."
        }
    }

    $cloneDir = Join-Path ([System.IO.Path]::GetTempPath()) ("code-setup-" + [System.Guid]::NewGuid())
    try {
        Write-Host "==> Cloning $RepoUrl (branch: $RepoBranch)..."
        git clone --quiet --depth 1 --branch $RepoBranch $RepoUrl $cloneDir
        if ($LASTEXITCODE -ne 0) {
            throw "failed to clone $RepoUrl (branch: $RepoBranch)"
        }
        node (Join-Path $cloneDir "setup/setup.mjs") @args
        if ($LASTEXITCODE -ne 0) {
            throw "setup failed with exit code $LASTEXITCODE"
        }
    }
    finally {
        if (Test-Path $cloneDir) {
            Remove-Item -Recurse -Force $cloneDir
        }
    }
} @args
