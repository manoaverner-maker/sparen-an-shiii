# =====================================================================
# serve.ps1  ·  Mini-Webserver zum lokalen Testen von Sparkurs
# =====================================================================
# Startet einen kleinen Webserver im aktuellen Ordner. Noetig, damit der
# Service Worker (Offline-Funktion) und die PWA-Installation funktionieren –
# ueber file:// (Doppelklick) gehen diese naemlich nicht.
#
# Aufruf (in PowerShell, im Projektordner):
#     powershell -ExecutionPolicy Bypass -File .\serve.ps1
# Danach im Browser oeffnen:  http://localhost:8200/
# Beenden mit  Strg + C .
# =====================================================================

param([int]$Port = 8200)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$prefix = "http://localhost:$Port/"

# MIME-Typen, damit der Browser die Dateien richtig versteht
$mime = @{
  '.html'='text/html; charset=utf-8'; '.js'='text/javascript; charset=utf-8';
  '.css'='text/css; charset=utf-8'; '.json'='application/json; charset=utf-8';
  '.svg'='image/svg+xml'; '.png'='image/png'; '.ico'='image/x-icon';
  '.webmanifest'='application/manifest+json'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
try { $listener.Start() }
catch { Write-Host "Konnte Port $Port nicht oeffnen. Laeuft schon ein Server?" -ForegroundColor Red; exit 1 }

Write-Host "Sparkurs laeuft auf  $prefix" -ForegroundColor Green
Write-Host "Ordner: $root" -ForegroundColor DarkGray
Write-Host "Beenden mit Strg + C." -ForegroundColor DarkGray

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
    if ([string]::IsNullOrWhiteSpace($rel)) { $rel = 'index.html' }
    $path = Join-Path $root $rel
    if (Test-Path $path -PathType Leaf) {
      $bytes = [IO.File]::ReadAllBytes($path)
      $ext = [IO.Path]::GetExtension($path).ToLower()
      if ($mime.ContainsKey($ext)) { $ctx.Response.ContentType = $mime[$ext] }
      $ctx.Response.Headers.Add('Cache-Control','no-cache')
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $ctx.Response.StatusCode = 404
      $msg = [Text.Encoding]::UTF8.GetBytes('404 - nicht gefunden: ' + $rel)
      $ctx.Response.OutputStream.Write($msg, 0, $msg.Length)
    }
    $ctx.Response.OutputStream.Close()
  } catch { }
}
