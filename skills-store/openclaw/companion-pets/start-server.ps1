$ErrorActionPreference = 'SilentlyContinue'
$proc = Start-Process -FilePath 'node' -ArgumentList 'server.js' -WorkingDirectory 'C:\Users\sap\.openclaw\workspace\skills\companion-pets' -PassThru -WindowStyle Hidden
Start-Sleep 3
try {
    $resp = Invoke-RestMethod http://localhost:3000/pet/info -TimeoutSec 5
    Write-Host "Server running! Pet: $($resp.emoji) $($resp.name)"
} catch {
    if ($proc -and !$proc.HasExited) {
        Write-Host "Server process exists but not responding"
    } else {
        Write-Host "Server failed to start"
    }
}
