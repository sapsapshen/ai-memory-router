# Simple folded format generator

param($MaxPerSource=3, $TimeoutSec=10)

$ErrorActionPreference = "Continue"

# Define paths
$today = Get-Date -Format "yyyy-MM-dd"
$rawJsonPath = "memory/news-raw-$today.json"
$foldedOutputPath = "memory/daily-tech-folded-$today.md"
$traditionalOutputPath = "memory/daily-tech-$today.md"

Write-Host "Starting news fetch..." -ForegroundColor Cyan

# 1. Fetch news
try {
    $newsData = powershell.exe -ExecutionPolicy Bypass -File "scripts/fetch-news.ps1" -MaxPerSource $MaxPerSource -TimeoutSec $TimeoutSec
    $newsData | Out-File -FilePath $rawJsonPath -Encoding UTF8
    Write-Host "Raw data saved: $rawJsonPath" -ForegroundColor Green
} catch {
    Write-Host "Fetch failed: $_" -ForegroundColor Red
    exit 1
}

# 2. Generate folded format
Write-Host "Generating folded format..." -ForegroundColor Cyan
try {
    powershell.exe -ExecutionPolicy Bypass -File "scripts/generate-folded.ps1" -JsonPath $rawJsonPath -OutputPath $foldedOutputPath
    Write-Host "Folded format generated: $foldedOutputPath" -ForegroundColor Green
} catch {
    Write-Host "Folded format generation failed: $_" -ForegroundColor Red
}

# 3. Create traditional format placeholder
Write-Host "Creating traditional format..." -ForegroundColor Cyan
$traditionalContent = @"
# Tech News · $today

> Folded format report generated, please check: $foldedOutputPath

---

*Note: Switched to folded format output, click category and news titles to expand*
"@

$traditionalContent | Out-File -FilePath $traditionalOutputPath -Encoding UTF8
Write-Host "Traditional format created: $traditionalOutputPath" -ForegroundColor Green

# 4. Show statistics
Write-Host "`nStatistics:" -ForegroundColor Cyan
Write-Host "  - Raw data: $rawJsonPath"
Write-Host "  - Folded format: $foldedOutputPath"
Write-Host "  - Traditional format: $traditionalOutputPath"

Write-Host "`nAll done!" -ForegroundColor Green