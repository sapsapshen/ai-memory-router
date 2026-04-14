param($MaxPerSource=5,$TimeoutSec=10)

$ErrorActionPreference="Continue"

# English-only RSS feeds (no encoding issues)
$feeds = @()

# International sources
$feeds += @{N="Hacker News";U="https://news.ycombinator.com/rss";L="en";Type="International";Priority=1}
$feeds += @{N="GitHub Trending";U="https://github.com/trending/developers.rss";L="en";Type="International";Priority=2}
$feeds += @{N="BBC Technology";U="https://feeds.bbci.co.uk/news/technology/rss.xml";L="en";Type="International";Priority=3}

# Domestic sources (English or simple names)
$feeds += @{N="36Kr";U="https://36kr.com/feed";L="zh";Type="Domestic";Priority=4}
$feeds += @{N="InfoQ";U="https://www.infoq.cn/feed";L="zh";Type="Domestic";Priority=5}
$feeds += @{N="CSDN Blog";U="https://blog.csdn.net/rss.html";L="zh";Type="Domestic";Priority=6}
$feeds += @{N="OSChina";U="https://www.oschina.net/news/rss";L="zh";Type="Domestic";Priority=7}
$feeds += @{N="SegmentFault";U="https://segmentfault.com/feeds/blogs";L="zh";Type="Domestic";Priority=8}
$feeds += @{N="Ifanr";U="https://www.ifanr.com/feed";L="zh";Type="Domestic";Priority=9}
$feeds += @{N="QbitAI";U="https://www.qbitai.com/rss";L="zh";Type="Domestic";Priority=10}
$feeds += @{N="TMTPost";U="https://www.tmtpost.com/rss";L="zh";Type="Domestic";Priority=11}
$feeds += @{N="Leiphone";U="https://www.leiphone.com/feed";L="zh";Type="Domestic";Priority=12}
$feeds += @{N="PingWest";U="https://www.pingwest.com/feed";L="zh";Type="Domestic";Priority=13}
$feeds += @{N="TechNode";U="https://technode.com/feed";L="en";Type="Domestic-EN";Priority=14}
$feeds += @{N="KrASIA";U="https://kr-asia.com/feed";L="en";Type="Domestic-EN";Priority=15}

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

Write-Host "Starting comprehensive news fetch..." -ForegroundColor Cyan
Write-Host "Sources: $($feeds.Count) (Int:3, Dom:12)" -ForegroundColor Yellow
Write-Host "=" * 60

foreach($f in $feeds){
    $typeColor = if($f.Type -eq "International"){"Magenta"}else{"Cyan"}
    Write-Host "[$($f.Type)] $($f.N)" -NoNewline -ForegroundColor $typeColor
    
    try{
        $resp = Invoke-WebRequest -Uri $f.U -TimeoutSec $TimeoutSec -UseBasicParsing
        $xml = [xml]$resp.Content
        $items = $null
        $count = 0
        
        # RSS format
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
        # Atom format
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
            Write-Host " - OK $count" -ForegroundColor Green
            $stats.Total++
            if($f.Type -eq "International"){$stats.International++}else{$stats.Domestic++}
        }
        else{
            Write-Host " - No data" -ForegroundColor Yellow
        }
    }
    catch{
        Write-Host " - Failed" -ForegroundColor Red
    }
    
    Start-Sleep -Milliseconds 300
}

Write-Host "=" * 60
Write-Host "Statistics:" -ForegroundColor Cyan
Write-Host "Successful: $($stats.Total)/$($feeds.Count)" -ForegroundColor Green
Write-Host "International: $($stats.International)/3" -ForegroundColor Magenta
Write-Host "Domestic: $($stats.Domestic)/12" -ForegroundColor Cyan
Write-Host "Valid links: $($stats.ValidLinks)" -ForegroundColor Green

# Sort by priority
$all = $all | Sort-Object -Property Priority

# Output JSON
if($all.Count -gt 0){
    $all | ConvertTo-Json -Depth 3
}
else{
    Write-Host "Warning: No data collected" -ForegroundColor Red
    "[]"
}