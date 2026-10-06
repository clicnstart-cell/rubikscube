# Dessine les icônes de l'appli (la mascotte cube) en PNG, avec GDI+ (inclus dans Windows).
#   powershell -ExecutionPolicy Bypass -File tools/make-icons.ps1
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root 'icons'
New-Item -ItemType Directory -Force $out | Out-Null

function C($hex) { [System.Drawing.ColorTranslator]::FromHtml($hex) }
$navy = C '#1b2140'

function Draw-Icon([int]$size, [string]$file, [bool]$rounded, [double]$cubeShare) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::Transparent)

  # Fond : carré arrondi (icône normale) ou plein (icône « masquable », iPhone).
  $bg = New-Object System.Drawing.SolidBrush $navy
  if ($rounded) {
    $r = $size * 0.22
    $p = New-Object System.Drawing.Drawing2D.GraphicsPath
    $p.AddArc(0, 0, 2 * $r, 2 * $r, 180, 90)
    $p.AddArc($size - 2 * $r, 0, 2 * $r, 2 * $r, 270, 90)
    $p.AddArc($size - 2 * $r, $size - 2 * $r, 2 * $r, 2 * $r, 0, 90)
    $p.AddArc(0, $size - 2 * $r, 2 * $r, 2 * $r, 90, 90)
    $p.CloseFigure()
    $g.FillPath($bg, $p)
  } else {
    $g.FillRectangle($bg, 0, 0, $size, $size)
  }

  # La mascotte est dessinée dans un repère 64×64 (comme le SVG), centrée.
  $k = $size * $cubeShare / 54.0
  $ox = $size / 2 - 32 * $k
  $oy = $size / 2 - 32 * $k
  function P($x, $y) { New-Object System.Drawing.PointF ([single]($ox + $x * $k)), ([single]($oy + $y * $k)) }

  $pen = New-Object System.Drawing.Pen $navy, ([single](2.6 * $k))
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $faces = @(
    @{ c = '#ffd21a'; pts = @((P 32 5), (P 57 18), (P 32 31), (P 7 18)) },
    @{ c = '#00a650'; pts = @((P 7 18), (P 32 31), (P 32 59), (P 7 46)) },
    @{ c = '#e3233a'; pts = @((P 32 31), (P 57 18), (P 57 46), (P 32 59)) }
  )
  foreach ($f in $faces) {
    $b = New-Object System.Drawing.SolidBrush (C $f.c)
    $g.FillPolygon($b, [System.Drawing.PointF[]]$f.pts)
    $g.DrawPolygon($pen, [System.Drawing.PointF[]]$f.pts)
  }

  $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
  $ink = New-Object System.Drawing.SolidBrush $navy
  foreach ($e in @(@(15.5, 33, 16.2, 34), @(25, 38, 25.7, 39))) {
    $g.FillEllipse($white, [single]($ox + ($e[0] - 3.2) * $k), [single]($oy + ($e[1] - 3.8) * $k), [single](6.4 * $k), [single](7.6 * $k))
    $g.FillEllipse($ink, [single]($ox + ($e[2] - 1.7) * $k), [single]($oy + ($e[3] - 1.7) * $k), [single](3.4 * $k), [single](3.4 * $k))
  }
  $smile = New-Object System.Drawing.Pen $navy, ([single](2.2 * $k))
  $smile.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $smile.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $g.DrawBezier($smile, (P 14.5 41.5), (P 17 45.1), (P 21.5 47.1), (P 25.5 47.1))

  $bmp.Save((Join-Path $out $file), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Write-Output "icons/$file"
}

Draw-Icon 192 'icon-192.png' $true 0.74
Draw-Icon 512 'icon-512.png' $true 0.74
Draw-Icon 512 'maskable-512.png' $false 0.56   # tient dans la zone sûre d'Android
Draw-Icon 180 'apple-touch-icon.png' $false 0.66
Draw-Icon 64 'favicon.png' $true 0.8
