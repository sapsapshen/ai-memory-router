param($MaxPerSource=5,$TimeoutSec=10)

$ErrorActionPreference="Continue"

# Simple list of accessible RSS feeds
$feeds = @()
$feeds += @{N="Hacker News";U="https://news.ycombinator.com/rss";L="en"}
$feeds += @{N="GitHub Trending";U="https://github.com/trending/developers.rss";L="en"}
$feeds += @{N="BBC Technology";U="https://feeds.bbci.co.uk/news/technology/rss.xml";L="en"}
$feeds += @{N="36Kr";U="https://36kr.com/feed";L="zh"}
$feeds += @{N="InfoQ";U="https://www.infoq.cn/feed";L="zh"}

function GetText($v){
    if($v -eq $null){return ""}
    $t = $v.GetType().Name
    if($t -eq "XmlCDataSection"){return $v."#cdata"}
    if($t -eq "XmlElement"){return $v.InnerText}
    return [string]$v
}

$all = @()
$idx = 0

foreach($f in $feeds){
    $idx++
    Write-Host "[$idx] $($f.N)" -F Cyan
    
    try{
        $resp = Invoke-WebRequest -Uri $f.U -TimeoutSec $TimeoutSec -UseBasicParsing
        $xml = [xml]$resp.Content
        $items = $null
        
        # RSS format
        if($xml.rss -and $xml.rss.channel.item){
            $items = $xml.rss.channel.item | Select-Object -First $MaxPerSource
            Write-Host "  RSS, $($items.Count) items" -F Yellow
            
            foreach($i in $items){
                $title = GetText($i.title)
                $link = GetText($i.link)
                $desc = GetText($i.description)
                
                $all += @{
                    Title = $title.Trim()
                    Link = $link.Trim()
                    Source = $f.N
                    Lang = $f.L
                    Description = if($desc.Length -gt 150){$desc.Substring(0,150)+"..."}else{$desc}
                }
            }
        }
        # Atom format
        elseif($xml.feed -and $xml.feed.entry){
            $items = $xml.feed.entry | Select-Object -First $MaxPerSource
            Write-Host "  Atom, $($items.Count) items" -F Yellow
            
            foreach($i in $items){
                $title = GetText($i.title)
                $lk = $i.link
                if($lk -ne $null -and $lk.href -ne $null){$lk = $lk.href.ToString()}else{$lk = ""}
                $sum = $i.summary; if($sum -eq $null){$sum = $i.content}
                $sum = GetText($sum)
                
                $all += @{
                    Title = $title.Trim()
                    Link = $lk.Trim()
                    Source = $f.N
                    Lang = $f.L
                    Description = if($sum.Length -gt 150){$sum.Substring(0,150)+"..."}else{$sum}
                }
            }
        }
        else{
            Write-Host "  Unknown format" -F Red
        }
        
        if($items -ne $null){
            Write-Host "  -> $($items.Count) items" -F Green
        }
    }
    catch{
        Write-Host "  -> Error: $($_.Exception.Message)" -F Red
    }
}

Write-Host ""
Write-Host "Total: $($all.Count) items from $idx sources" -F Yellow

# Output JSON
if($all.Count -gt 0){
    $all | ConvertTo-Json -Depth 3
}
else{
    Write-Host "No data collected" -F Red
    "[]"
}