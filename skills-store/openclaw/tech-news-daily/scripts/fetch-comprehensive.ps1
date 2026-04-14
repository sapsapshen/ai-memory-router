param($MaxPerSource=6,$TimeoutSec=10)

$ErrorActionPreference="Continue"

# 综合新闻源：国际 + 国内
$feeds = @()

# ====== 国际源 ======
$feeds += @{N="Hacker News";U="https://news.ycombinator.com/rss";L="en";Type="国际";Priority=1}
$feeds += @{N="GitHub Trending";U="https://github.com/trending/developers.rss";L="en";Type="国际";Priority=2}
$feeds += @{N="BBC Technology";U="https://feeds.bbci.co.uk/news/technology/rss.xml";L="en";Type="国际";Priority=3}

# ====== 国内热点源（10+个） ======
# 1. 技术社区类
$feeds += @{N="36氪";U="https://36kr.com/feed";L="zh";Type="国内";Priority=1}
$feeds += @{N="InfoQ";U="https://www.infoq.cn/feed";L="zh";Type="国内";Priority=2}
$feeds += @{N="CSDN博客";U="https://blog.csdn.net/rss.html";L="zh";Type="国内";Priority=3}
$feeds += @{N="OSChina";U="https://www.oschina.net/news/rss";L="zh";Type="国内";Priority=4}
$feeds += @{N="SegmentFault";U="https://segmentfault.com/feeds/blogs";L="zh";Type="国内";Priority=5}

# 2. 科技媒体类
$feeds += @{N="爱范儿";U="https://www.ifanr.com/feed";L="zh";Type="国内";Priority=6}
$feeds += @{N="量子位";U="https://www.qbitai.com/rss";L="zh";Type="国内";Priority=7}
$feeds += @{N="钛媒体";U="https://www.tmtpost.com/rss";L="zh";Type="国内";Priority=8}
$feeds += @{N="雷峰网";U="https://www.leiphone.com/feed";L="zh";Type="国内";Priority=9}
$feeds += @{N="PingWest品玩";U="https://www.pingwest.com/feed";L="zh";Type="国内";Priority=10}

# 3. 英文国内源
$feeds += @{N="TechNode";U="https://technode.com/feed";L="en";Type="国内英文";Priority=11}
$feeds += @{N="KrASIA";U="https://kr-asia.com/feed";L="en";Type="国内英文";Priority=12}

# 4. 备用源
$feeds += @{N="掘金";U="https://juejin.cn/rss";L="zh";Type="国内";Priority=13}
$feeds += @{N="少数派";U="https://sspai.com/feed";L="zh";Type="国内";Priority=14}

function GetText($v){
    if($v -eq $null){return ""}
    $t = $v.GetType().Name
    if($t -eq "XmlCDataSection"){return $v."#cdata"}
    if($t -eq "XmlElement"){return $v.InnerText}
    return [string]$v
}

function ValidateLink($link){
    if(-not $link){return $false}
    $link = $link.Trim()
    if($link -eq ""){return $false}
    if(-not $link.StartsWith("http")){return $false}
    if($link.Contains("example.com")){return $false}
    return $true
}

$all = @()
$stats = @{Total=0; International=0; Domestic=0; ValidLinks=0}

Write-Host "🌐 综合科技新闻抓取开始..." -ForegroundColor Cyan
Write-Host "源数量: $($feeds.Count) (国际:3, 国内:11+)" -ForegroundColor Yellow
Write-Host "=" * 60

foreach($f in $feeds){
    $typeColor = if($f.Type -eq "国际"){"Magenta"}else{"Cyan"}
    Write-Host "[$($f.Type)] $($f.N)" -NoNewline -ForegroundColor $typeColor
    
    try{
        $resp = Invoke-WebRequest -Uri $f.U -TimeoutSec $TimeoutSec -UseBasicParsing
        $xml = [xml]$resp.Content
        $items = $null
        $count = 0
        
        # RSS格式
        if($xml.rss -and $xml.rss.channel.item){
            $items = $xml.rss.channel.item | Select-Object -First $MaxPerSource
            $count = $items.Count
            
            foreach($i in $items){
                $title = GetText($i.title)
                $link = GetText($i.link)
                $desc = GetText($i.description)
                $pd = $i.pubDate
                
                if(ValidateLink($link)){
                    $all += @{
                        Title = $title.Trim()
                        Link = $link
                        PubDate = if($pd){$pd.ToString()}else{""}
                        Source = $f.N
                        Type = $f.Type
                        Lang = $f.L
                        Priority = $f.Priority
                        Description = if($desc.Length -gt 100){$desc.Substring(0,100)+"..."}else{$desc}
                    }
                    $stats.ValidLinks++
                }
            }
        }
        # Atom格式
        elseif($xml.feed -and $xml.feed.entry){
            $items = $xml.feed.entry | Select-Object -First $MaxPerSource
            $count = $items.Count
            
            foreach($i in $items){
                $title = GetText($i.title)
                $lk = $i.link
                if($lk -ne $null -and $lk.href -ne $null){$lk = $lk.href.ToString()}else{$lk = ""}
                $sum = $i.summary; if($sum -eq $null){$sum = $i.content}
                $sum = GetText($sum)
                $pd = if($i.published){$i.published}elseif($i.updated){$i.updated}else{""}
                
                if(ValidateLink($lk)){
                    $all += @{
                        Title = $title.Trim()
                        Link = $lk
                        PubDate = if($pd){$pd.ToString()}else{""}
                        Source = $f.N
                        Type = $f.Type
                        Lang = $f.L
                        Priority = $f.Priority
                        Description = if($sum.Length -gt 100){$sum.Substring(0,100)+"..."}else{$sum}
                    }
                    $stats.ValidLinks++
                }
            }
        }
        
        if($count -gt 0){
            Write-Host " - ✅ $count条" -ForegroundColor Green
            $stats.Total++
            if($f.Type -eq "国际"){$stats.International++}else{$stats.Domestic++}
        }
        else{
            Write-Host " - ⚠️ 无数据" -ForegroundColor Yellow
        }
    }
    catch{
        Write-Host " - ❌ 失败" -ForegroundColor Red
    }
    
    Start-Sleep -Milliseconds 300
}

Write-Host "=" * 60
Write-Host "📊 抓取统计:" -ForegroundColor Cyan
Write-Host "成功源: $($stats.Total)/$($feeds.Count)" -ForegroundColor Green
Write-Host "国际源: $($stats.International)/3" -ForegroundColor Magenta
Write-Host "国内源: $($stats.Domestic)/11+" -ForegroundColor Cyan
Write-Host "有效链接: $($stats.ValidLinks)条" -ForegroundColor Green

# 按优先级排序
$all = $all | Sort-Object -Property Priority

# 输出JSON
if($all.Count -gt 0){
    $all | ConvertTo-Json -Depth 3
}
else{
    Write-Host "警告: 未获取到有效数据" -ForegroundColor Red
    "[]"
}