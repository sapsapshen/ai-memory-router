param($JsonPath, $OutputPath)

# Read JSON data
$json = Get-Content $JsonPath -Encoding UTF8 | ConvertFrom-Json

# Simple categories
$categories = @{
    "NASA|SpaceX|Artemis|Moon|space" = "🚀 Space & Tech"
    "AI|Claude|GPT|Anthropic|OpenAI" = "🤖 AI & Models"
    "China|Xpeng|Xiaomi|Huawei" = "🌍 China News"
}

# Initialize
$categorized = @{}
foreach ($cat in $categories.Values) {
    $categorized[$cat] = @()
}
$uncategorized = @()

# Categorize
foreach ($item in $json) {
    $title = $item.Title
    $matched = $false
    
    foreach ($pattern in $categories.Keys) {
        $keywords = $pattern -split "\|"
        foreach ($keyword in $keywords) {
            if ($title -match $keyword) {
                $categorized[$categories[$pattern]] += $item
                $matched = $true
                break
            }
        }
        if ($matched) { break }
    }
    
    if (-not $matched) {
        $uncategorized += $item
    }
}

# Generate folded markdown
$output = @()
$output += "# Tech News · $(Get-Date -Format 'yyyy-MM-dd')"
$output += ""
$output += "> Folded format | Click to expand"
$output += ""
$output += "---"
$output += ""

# Generate folded blocks
foreach ($category in $categorized.Keys) {
    $items = $categorized[$category]
    if ($items.Count -eq 0) { continue }
    
    $output += "<details>"
    $output += "<summary><strong>$category ($($items.Count) items)</strong></summary>"
    $output += ""
    
    foreach ($item in $items) {
        $output += "<details style='margin-left: 20px;'>"
        $output += "<summary>$($item.Title) <em>[$($item.Source)]</em></summary>"
        $output += ""
        $output += "**Source**: $($item.Source)"
        $output += ""
        $output += "**Link**: [$($item.Link)]($($item.Link))"
        $output += ""
        if ($item.Description -and $item.Description.Trim() -ne "") {
            $output += "**Description**: $($item.Description)"
            $output += ""
        }
        $output += "</details>"
        $output += ""
    }
    
    $output += "</details>"
    $output += ""
}

# Uncategorized
if ($uncategorized.Count -gt 0) {
    $output += "<details>"
    $output += "<summary><strong>📰 Other News ($($uncategorized.Count) items)</strong></summary>"
    $output += ""
    
    foreach ($item in $uncategorized) {
        $output += "<details style='margin-left: 20px;'>"
        $output += "<summary>$($item.Title) <em>[$($item.Source)]</em></summary>"
        $output += ""
        $output += "**Source**: $($item.Source)"
        $output += ""
        $output += "**Link**: [$($item.Link)]($($item.Link))"
        $output += ""
        if ($item.Description -and $item.Description.Trim() -ne "") {
            $output += "**Description**: $($item.Description)"
            $output += ""
        }
        $output += "</details>"
        $output += ""
    }
    
    $output += "</details>"
    $output += ""
}

$output += "---"
$output += "*Total: $($json.Count) items | Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm')*"

# Save to file
$output -join "`n" | Out-File -FilePath $OutputPath -Encoding UTF8
Write-Host "Folded format generated: $OutputPath" -ForegroundColor Green