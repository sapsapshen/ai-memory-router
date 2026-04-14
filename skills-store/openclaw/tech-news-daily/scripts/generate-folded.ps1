param($JsonPath, $OutputPath)

# 读取JSON数据
$json = Get-Content $JsonPath | ConvertFrom-Json

# 分类映射
$categories = @{
    "太空|space|NASA|SpaceX|Artemis|月球|火星|卫星|火箭" = "🚀 太空 & 前沿科技"
    "AI|人工智能|大模型|GPT|Claude|Gemini|DeepSeek|Anthropic|OpenAI|机器学习|神经网络" = "🤖 AI & 大模型"
    "苹果|iPhone|Mac|iPad|三星|小米|华为|vivo|OPPO|手机|电脑|笔记本|耳机|数码|消费电子" = "📱 数码 & 消费电子"
    "创业|投资|融资|IPO|VC|初创|融资|估值|收购|并购|DeFi|加密" = "🏢 创业 & 投资"
    "政策|法律|政府|监管|特朗普|白宫|DOJ|FDA|法院|诉讼|反垄断" = "🌐 政策 & 社会"
    "科研|健康|医学|FDA|药物|疫苗|基因|克隆|伦理|教育|学校" = "🔬 科研 & 健康"
    "生活|消费|家居|家具|椅子|耳机|音箱|酒|威士忌|阅读|Kindle" = "🏠 消费 & 生活"
    "中国|国内|字节|腾讯|阿里|百度|美团|滴滴|小鹏|理想|比亚迪|华为|小米|vivo|OPPO" = "🌍 国内动态"
}

# 初始化分类字典
$categorized = @{}
foreach ($cat in $categories.Values) {
    $categorized[$cat] = @()
}

# 未分类的新闻
$uncategorized = @()

# 分类新闻
foreach ($item in $json) {
    $title = $item.Title
    $source = $item.Source
    $link = $item.Link
    $desc = $item.Description
    
    $matched = $false
    foreach ($pattern in $categories.Keys) {
        $keywords = $pattern -split "\|"
        foreach ($keyword in $keywords) {
            if ($title -match $keyword -or $desc -match $keyword) {
                $categorized[$categories[$pattern]] += @{
                    Title = $title
                    Source = $source
                    Link = $link
                    Description = $desc
                }
                $matched = $true
                break
            }
        }
        if ($matched) { break }
    }
    
    if (-not $matched) {
        $uncategorized += @{
            Title = $title
            Source = $source
            Link = $link
            Description = $desc
        }
    }
}

# 生成折叠格式的Markdown
$output = @()
$output += "# 科技新鲜事 · $(Get-Date -Format 'yyyy-MM-dd')"
$output += ""
$output += "> 本日汇总 | 来源：The Verge / TechCrunch / Ars Technica / Wired / MIT Tech Review / Stratechery / 钛媒体 / 36氪 / 爱范儿 / 量子位"
$output += ""
$output += "---"
$output += ""

# 生成折叠格式：每个类别是一个折叠块，每条新闻也是一个折叠块
foreach ($category in $categorized.Keys) {
    $items = $categorized[$category]
    if ($items.Count -eq 0) { continue }
    
    $output += "<details>"
    $output += "<summary><strong>$category ($($items.Count)条)</strong></summary>"
    $output += ""
    
    foreach ($item in $items) {
        $output += "<details style='margin-left: 20px;'>"
        $output += "<summary>$($item.Title) <em>[$($item.Source)]</em></summary>"
        $output += ""
        $output += "**来源**: $($item.Source)"
        $output += ""
        $output += "**链接**: [$($item.Link)]($($item.Link))"
        $output += ""
        if ($item.Description -and $item.Description.Trim() -ne "") {
            $output += "**摘要**: $($item.Description)"
            $output += ""
        }
        $output += "</details>"
        $output += ""
    }
    
    $output += "</details>"
    $output += ""
}

# 如果有未分类的新闻
if ($uncategorized.Count -gt 0) {
    $output += "<details>"
    $output += "<summary><strong>📰 其他新闻 ($($uncategorized.Count)条)</strong></summary>"
    $output += ""
    
    foreach ($item in $uncategorized) {
        $output += "<details style='margin-left: 20px;'>"
        $output += "<summary>$($item.Title) <em>[$($item.Source)]</em></summary>"
        $output += ""
        $output += "**来源**: $($item.Source)"
        $output += ""
        $output += "**链接**: [$($item.Link)]($($item.Link))"
        $output += ""
        if ($item.Description -and $item.Description.Trim() -ne "") {
            $output += "**摘要**: $($item.Description)"
            $output += ""
        }
        $output += "</details>"
        $output += ""
    }
    
    $output += "</details>"
    $output += ""
}

$output += "---"
$output += "*共收录 $($json.Count) 条新闻 | 来自 11 个已验证 RSS 源 | 生成时间 $(Get-Date -Format 'yyyy-MM-dd HH:mm') CST*"
$output += "*下次自动更新：问'科技新闻'即可获取最新折叠版简报*"

# 保存到文件
$output -join "`n" | Out-File -FilePath $OutputPath -Encoding UTF8
Write-Host "折叠格式简报已生成: $OutputPath" -ForegroundColor Green