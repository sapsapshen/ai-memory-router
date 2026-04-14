$sources = @(
"MIT Tech Review|https://www.technologyreview.com/feed/|en",
"The Information|https://www.theinformation.com/feed|en",
"Stratechery|https://stratechery.com/feed/|en",
"IEEE Spectrum|https://spectrum.ieee.org/feed|en",
"Geekpark|https://www.geekpark.net/rss|zh",
"Huxiu|https://www.huxiu.com/rss/0.xml|zh",
"Jiqizhixin|https://www.jiqizhixin.com/rss|zh",
"Pinwza|https://www.pinwza.com/rss|zh",
"Qbitai|https://www.qbitai.com/rss|zh",
"Okjike|https://okjike.com/rss|zh",
"Sspai|https://sspai.com/feed|zh"
)
foreach ($line in $sources) {
    $parts = $line -split '\|'
    $name = $parts[0]
    $url = $parts[1]
    $status = "FAIL"
    try {
        $r = Invoke-WebRequest -Uri $url -Method Head -TimeoutSec 8 -UseBasicParsing 2>&1
        $status = $r.StatusCode
    } catch {}
    Write-Host "$name -> $status"
}
