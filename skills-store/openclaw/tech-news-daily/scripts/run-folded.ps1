# 主脚本：抓取新闻并生成折叠格式

param($MaxPerSource=20, $TimeoutSec=10)

$ErrorActionPreference = "Continue"

# 1. 抓取新闻
Write-Host "📡 开始抓取新闻..." -ForegroundColor Cyan
$rawJsonPath = "memory/news-raw-$(Get-Date -Format 'yyyy-MM-dd').json"
$foldedOutputPath = "memory/daily-tech-folded-$(Get-Date -Format 'yyyy-MM-dd').md"

# 运行抓取脚本
$newsData = powershell.exe -ExecutionPolicy Bypass -File "scripts/fetch-news.ps1" -MaxPerSource $MaxPerSource -TimeoutSec $TimeoutSec
$newsData | Out-File -FilePath $rawJsonPath -Encoding UTF8
Write-Host "✅ 原始数据已保存: $rawJsonPath" -ForegroundColor Green

# 2. 生成折叠格式
Write-Host "📝 生成折叠格式简报..." -ForegroundColor Cyan
powershell.exe -ExecutionPolicy Bypass -File "scripts/generate-folded.ps1" -JsonPath $rawJsonPath -OutputPath $foldedOutputPath

# 3. 读取并输出简报
Write-Host "📋 折叠格式简报已生成: $foldedOutputPath" -ForegroundColor Green
$foldedContent = Get-Content $foldedOutputPath -Raw
Write-Host "`n" + $foldedContent

# 4. 同时生成传统格式（兼容性）
$traditionalOutputPath = "memory/daily-tech-$(Get-Date -Format 'yyyy-MM-dd').md"
Write-Host "📄 同时生成传统格式简报..." -ForegroundColor Cyan

# 这里可以调用原来的生成脚本，或者简单复制
# 暂时先创建占位符
$traditionalContent = @"
# 科技新鲜事 · $(Get-Date -Format 'yyyy-MM-dd')

> 折叠格式简报已生成，请查看: $foldedOutputPath

---

*提示：已切换到折叠格式输出，点击类别和新闻标题可展开查看详情*
"@
$traditionalContent | Out-File -FilePath $traditionalOutputPath -Encoding UTF8

Write-Host "✅ 全部完成！" -ForegroundColor Green
Write-Host "📊 统计:"
Write-Host "  - 原始数据: $rawJsonPath"
Write-Host "  - 折叠格式: $foldedOutputPath"
Write-Host "  - 传统格式: $traditionalOutputPath"