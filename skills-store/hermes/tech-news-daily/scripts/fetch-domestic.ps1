param($MaxPerSource=8,$TimeoutSec=12)

$ErrorActionPreference="Continue"

# 国内热点科技新闻源（通常可访问）
$feeds = @()

# 1. 技术社区类
$feeds += @{N="36氪";U="https://36kr.com/feed";L="zh";Category="创业投资"}
$feeds += @{N="InfoQ";U="https://www.infoq.cn/feed";L="zh";Category="技术实践"}
$feeds += @{N="CSDN博客";U="https://blog.csdn.net/rss.html";L="zh";Category="开发者社区"}
$feeds += @{N="OSChina";U="https://www.oschina.net/news/rss";L="zh";Category="开源技术"}
$feeds += @{N="SegmentFault";U="https://segmentfault.com/feeds/blogs";L="zh";Category="技术问答"}

# 2. 科技媒体类
$feeds += @{N="爱范儿";U="https://www.ifanr.com/feed";L="zh";Category="数码科技"}
$feeds += @{N="量子位";U="https://www.qbitai.com/rss";L="zh";Category="AI科技"}
$feeds += @{N="钛媒体";U="https://www.tmtpost.com/rss";L="zh";Category="科技媒体"}
$feeds += @{N="雷峰网";U="https://www.leiphone.com/feed";L="zh";Category="科技资讯"}
$feeds += @{N="PingWest品玩";U="https://www.pingwest.com/feed";L="zh";Category="科技文化"}

# 3. 英文国内源（面向国际）
$feeds += @{N="TechNode";U="https://technode.com/feed";L="en";Category="中国科技"}
$feeds += @{N="KrASIA";U="https://kr-asia.com/feed";L="en";Category="亚洲科技"}

# 4. 备用源
$feeds += @{N="掘金";U="https://juejin.cn/rss";L="zh";Category="技术社区"}
$feeds += @{N="少数派";U="https://sspai.com/feed";L="zh";Category="数字生活"}

function GetText($v){
    if($v -eq $null){return ""}
    $t = $v.GetType().Name
    if($t -eq "XmlCDataSection"){return $v."#cdata"}
    if($t -eq "XmlElement"){return $v.InnerText}
    return [string]$v
}

$all = @()
$successCount = 0

Write-Host "开始抓取国内热点科技新闻..." -ForegroundColor Cyan
Write-Host "=" * 50

foreach($f in $feeds){
    Write-Host "[$($f.Category)] $($f.N)" -NoNewline
    
    try{
        $resp = Invoke-WebRequest -Uri $f.U -TimeoutSec $TimeoutSec -UseBasicParsing
        $xml = [xml]$resp.Content
        $items = $null
        
        # RSS格式
        if($xml.rss -and $xml.rss.channel.item){
            $items = $xml.rss.channel.item | Select-Object -First $MaxPerSource
            Write-Host " - ✅ ($($items.Count)条)" -ForegroundColor Green
            
            foreach($i in $items){
                $title = GetText($i.title)
                $link = GetText($i.link)
                $desc = GetText($i.description)
                $pd = $i.pubDate
                
                # 确保链接有效
                if($link -and $link.Trim() -ne "" -and $link.StartsWith("http")){
                    $all += @{
                        Title = $title.Trim()
                        Link = $link.Trim()
                        PubDate = if($pd){$pd.ToString()}else{""}
                        Source = $f.N
                        Category = $f.Category
                        Lang = $f.L
                        Description = if($desc.Length -gt 120){$desc.Substring(0,120)+"..."}else{$desc}
                        IsValid = $true
                    }
                }
            }
            $successCount++
        }
        # Atom格式
        elseif($xml.feed -and $xml.feed.entry){
            $items = $xml.feed.entry | Select-Object -First $MaxPerSource
            Write-Host " - ✅ ($($items.Count)条)" -ForegroundColor Green
            
            foreach($i in $items){
                $title = GetText($i.title)
                $lk = $i.link
                if($lk -ne $null -and $lk.href -ne $null){$lk = $lk.href.ToString()}else{$lk = ""}
                $sum = $i.summary; if($sum -eq $null){$sum = $i.content}
                $sum = GetText($sum)
                $pd = if($i.published){$i.published}elseif($i.updated){$i.updated}else{""}
                
                if($lk -and $lk.Trim() -ne "" -and $lk.StartsWith("http")){
                    $all += @{
                        Title = $title.Trim()
                        Link = $lk.Trim()
                        PubDate = if($pd){$pd.ToString()}else{""}
                        Source = $f.N
                        Category = $f.Category
                        Lang = $f.L
                        Description = if($sum.Length -gt 120){$sum.Substring(0,120)+"..."}else{$sum}
                        IsValid = $true
                    }
                }
            }
            $successCount++
        }
        else{
            Write-Host " - ❌ 格式不支持" -ForegroundColor Red
        }
    }
    catch{
        Write-Host " - ❌ 抓取失败" -ForegroundColor Red
    }
}

Write-Host "=" * 50
Write-Host "抓取完成: $successCount/$($feeds.Count) 个源成功" -ForegroundColor Cyan
Write-Host "有效新闻: $($all.Count) 条" -ForegroundColor Green

# 输出JSON
if($all.Count -gt 0){
    $all | ConvertTo-Json -Depth 3
}
else{
    Write-Host "警告: 未抓取到数据" -ForegroundColor Red
    "[]"
}