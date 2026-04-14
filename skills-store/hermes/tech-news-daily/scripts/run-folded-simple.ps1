# 简单版折叠格式生成脚本

param($MaxPerSource=5, $TimeoutSec=10)

$ErrorActionPreference = "Continue"

# 定义日期
$today = Get-Date -Format "yyyy-MM-dd"
$rawJsonPath = "memory/news-raw-$today.json"
$foldedOutputPath = "memory/daily-tech-folded-$today.md"
$traditionalOutputPath = "memory/daily-tech-$today.md"

Write-Host "📡 开始抓取新闻..." -ForegroundColor Cyan

# 1. 抓取新闻
try {
    $newsData = powershell.exe -ExecutionPolicy Bypass -File "scripts/fetch-news.ps1" -MaxPerSource $MaxPerSource -TimeoutSec $TimeoutSec
    $newsData | Out-File -FilePath $rawJsonPath -Encoding UTF8
    Write-Host "✅ 原始数据已保存: $rawJsonPath" -ForegroundColor Green
} catch {
    Write-Host "❌ 抓取失败: $_" -ForegroundColor Red
    exit 1
}

# 2. 生成折叠格式
Write-Host "📝 生成折叠格式简报..." -ForegroundColor Cyan
try {
    powershell.exe -ExecutionPolicy Bypass -File "scripts/generate-folded.ps1" -JsonPath $rawJsonPath -OutputPath $foldedOutputPath
    Write-Host "✅ 折叠格式简报已生成: $foldedOutputPath" -ForegroundColor Green
} catch {
    Write-Host "❌ 折叠格式生成失败: $_" -ForegroundColor Red
}

# 3. 创建传统格式占位符
Write-Host "📄 创建传统格式简报..." -ForegroundColor Cyan
$traditionalContent = @"
# 科技新鲜事 · $today

> 折叠格式简报已生成，请查看: $foldedOutputPath

---

*提示：已切换到折叠格式输出，点击类别和新闻标题可展开查看详情*
"@

$traditionalContent | Out-File -FilePath $traditionalOutputPath -Encoding UTF8
Write-Host "✅ 传统格式简报已创建: $traditionalOutputPath" -ForegroundColor Green

# 4. 显示统计
Write-Host "`n📊 统计:" -ForegroundColor Cyan
Write-Host "  - 原始数据: $rawJsonPath"
Write-Host "  - 折叠格式: $foldedOutputPath"
Write-Host "  - 传统格式: $traditionalOutputPath"

Write-Host "`n✅ 全部完成！" -ForegroundColor Green