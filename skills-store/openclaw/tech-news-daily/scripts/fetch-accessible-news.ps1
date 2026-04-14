param($MaxPerSource=10,$TimeoutSec=15)

$ErrorActionPreference="Continue"

# 使用确认可访问的RSS源（基于测试结果）
$feeds=@(
    # 国际英文源（确认可访问）
    @{N="Hacker News";U="https://news.ycombinator.com/rss";L="en"},
    @{N="GitHub Trending";U="https://github.com/trending/developers.rss";L="en"},
    @{N="BBC Technology";U="https://feeds.bbci.co.uk/news/technology/rss.xml";L="en"},
    @{N="The Verge";U="https://www.theverge.com/rss/index.xml";L="en"},
    @{N="TechCrunch";U="https://techcrunch.com/feed/";L="en"},
    
    # 备用源（如果上述不可用）
    @{N="Stack Overflow Blog";U="https://stackoverflow.blog/feed/";L="en"},
    @{N="IEEE Spectrum";U="https://spectrum.ieee.org/feed";L="en"},
    
    # 国内中文源（通常可访问）
    @{N="36Kr";U="https://36kr.com/feed";L="zh"},
    @{N="InfoQ";U="https://www.infoq.cn/feed";L="zh"},
    @{N="CSDN Blog";U="https://blog.csdn.net/rss.html";L="zh"}
)

function Get-TextValue($v){
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
    Write-Host "[$idx] $($f.N) -> $($f.U)" -F Cyan
    try{
        $resp = Invoke-WebRequest -Uri $f.U -TimeoutSec $TimeoutSec -UseBasicParsing
        $xml = [xml]$resp.Content
        $items = $null
        
        # RSS格式
        if($xml.rss -and $xml.rss.channel.item){
            $items = $xml.rss.channel.item | Select-Object -First $MaxPerSource
            Write-Host "  RSS format, $($items.Count) items" -F Yellow
            foreach($i in $items){
                $title = Get-TextValue($i.title)
                $link = Get-TextValue($i.link)
                $desc = Get-TextValue($i.description)
                $pd = $i.pubDate
                $all += @{
                    Title = $title.Trim()
                    Link = $link.Trim()
                    PubDate = if($pd){$pd.ToString()}else{""}
                    Source = $f.N
                    Lang = $f.L
                    Description = if($desc.Length -gt 200){$desc.Substring(0,200)+"..."}else{$desc}
                }
            }
        }
        # Atom格式
        elseif($xml.feed -and $xml.feed.entry){
            $items = $xml.feed.entry | Select-Object -First $MaxPerSource
            Write-Host "  Atom format, $($items.Count) items" -F Yellow
            foreach($i in $items){
                $title = Get-TextValue($i.title)
                $lk = $i.link
                if($lk -ne $null -and $lk.href -ne $null){$lk = $lk.href.ToString()}else{$lk = ""}
                $sum = $i.summary; if($sum -eq $null){$sum = $i.content}
                $sum = Get-TextValue($sum)
                $pd = if($i.published){$i.published}elseif($i.updated){$i.updated}else{""}
                $all += @{
                    Title = $title.Trim()
                    Link = $lk.Trim()
                    PubDate = if($pd){$pd.ToString()}else{""}
                    Source = $f.N
                    Lang = $f.L
                    Description = if($sum.Length -gt 200){$sum.Substring(0,200)+"..."}else{$sum}
                }
            }
        }
        else{
            Write-Host "  Unknown XML structure" -F Red
        }
        
        if($items -ne $null){
            Write-Host "  -> $($items.Count) items" -F Green
        }
    }
    catch{
        Write-Host "  -> FAILED: $($_.Exception.Message)" -F Red
    }
}

Write-Host ""
Write-Host "[Total] $($all.Count) items from $idx sources" -F Yellow

# 输出JSON
if($all.Count -gt 0){
    $all | ConvertTo-Json -Depth 5
}
else{
    Write-Host "No items collected. Check network connectivity." -F Red
    "[]"
}