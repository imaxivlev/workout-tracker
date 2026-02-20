$source = "d:\.gemini\.gemini\antigravity\playground\CrossFit_Tracker"
$dest = "d:\.gemini\.gemini\antigravity\playground\CrossFit_Tracker_Backup.zip"

Write-Host "Starting backup of $source to $dest..."

# Remove old backup if exists
if (Test-Path $dest) {
    Remove-Item -Path $dest -Force
    Write-Host "Removed existing backup."
}

# Get top-level items to include (excluding node_modules and .next)
# We exclude .git just in case it causes permission issues, but usually it's fine. 
# If the user wants git history, we should include it. 
# Given "nothing lost", I will INCLUDE .git if it exists, only strictly exclude excluded build artifacts.
$items = Get-ChildItem -Path $source | Where-Object { $_.Name -ne "node_modules" -and $_.Name -ne ".next" }

if ($items.Count -eq 0) {
    Write-Error "No files found to backup!"
    exit 1
}

Write-Host "Compressing files..."
$items | Compress-Archive -DestinationPath $dest -CompressionLevel Optimal

if (Test-Path $dest) {
    $size = (Get-Item $dest).Length / 1MB
    Write-Host "Backup created successfully: $dest"
    Write-Host "Size: $([math]::Round($size, 2)) MB"
} else {
    Write-Error "Failed to create backup file."
    exit 1
}
