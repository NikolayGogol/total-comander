Add-Type -AssemblyName System.Drawing

$buildDir = "D:\projects\total-comander\build"
if (-not (Test-Path $buildDir)) {
    New-Item -ItemType Directory -Path $buildDir -Force | Out-Null
}

function Create-RoundedRectanglePath {
    param(
        [System.Drawing.RectangleF]$rect,
        [float]$radius
    )
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $diameter = $radius * 2.0
    $arc = New-Object System.Drawing.RectangleF($rect.X, $rect.Y, $diameter, $diameter)
    
    # Top Left
    $path.AddArc($arc, 180, 90)
    # Top Right
    $arc.X = $rect.Right - $diameter
    $path.AddArc($arc, 270, 90)
    # Bottom Right
    $arc.Y = $rect.Bottom - $diameter
    $path.AddArc($arc, 0, 90)
    # Bottom Left
    $arc.X = $rect.Left
    $path.AddArc($arc, 90, 90)
    $path.CloseFigure()
    return $path
}

# --- 1. Generate App Icon (PNG & Multi-Size ICO) ---
function Render-AppIcon {
    param([int]$size)
    $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
    $g.Clear([System.Drawing.Color]::Transparent)

    $pad = [float]($size * 0.05)
    $rect = New-Object System.Drawing.RectangleF($pad, $pad, ($size - 2 * $pad), ($size - 2 * $pad))
    $radius = [float]($size * 0.22)
    $path = Create-RoundedRectanglePath $rect $radius

    # Squircle Background Gradient: Rich dark navy / obsidian
    $cTop = [System.Drawing.Color]::FromArgb(255, 15, 23, 42)    # #0f172a
    $cBot = [System.Drawing.Color]::FromArgb(255, 6, 11, 25)     # #060b19
    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $cTop, $cBot, [System.Drawing.Drawing2D.LinearGradientMode]::Vertical)
    $g.FillPath($bgBrush, $path)
    $bgBrush.Dispose()

    # Outer border glow (electric blue/cyan)
    $borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(220, 56, 189, 248), [Math]::Max(1.0, [float]($size * 0.025)))
    $g.DrawPath($borderPen, $path)
    $borderPen.Dispose()

    # Inner dual-pane layout illustration (if size >= 32)
    if ($size -ge 32) {
        $paneY = [float]($rect.Y + $rect.Height * 0.18)
        $paneH = [float]($rect.Height * 0.72)
        $paneW = [float]($rect.Width * 0.42)
        $gap = [float]($rect.Width * 0.06)
        $leftX = [float]($rect.X + ($rect.Width - ($paneW * 2 + $gap)) / 2.0)
        $rightX = [float]($leftX + $paneW + $gap)

        # Left Pane Card
        $lpRect = New-Object System.Drawing.RectangleF($leftX, $paneY, $paneW, $paneH)
        $lpPath = Create-RoundedRectanglePath $lpRect ([float]($size * 0.06))
        $lpBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(180, 24, 34, 53))
        $g.FillPath($lpBrush, $lpPath)
        $lpBrush.Dispose()
        $lpPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(100, 59, 130, 246), 1.0)
        $g.DrawPath($lpPen, $lpPath)
        $lpPen.Dispose()

        # Right Pane Card
        $rpRect = New-Object System.Drawing.RectangleF($rightX, $paneY, $paneW, $paneH)
        $rpPath = Create-RoundedRectanglePath $rpRect ([float]($size * 0.06))
        $rpBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(180, 24, 34, 53))
        $g.FillPath($rpBrush, $rpPath)
        $rpBrush.Dispose()
        $rpPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(100, 16, 185, 129), 1.0)
        $g.DrawPath($rpPen, $rpPath)
        $rpPen.Dispose()

        # Pane Header Pills
        $lhBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(230, 37, 99, 235))
        $g.FillRectangle($lhBrush, $leftX + 2, $paneY + 2, $paneW - 4, [float]($paneH * 0.18))
        $lhBrush.Dispose()

        $rhBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(230, 5, 150, 105))
        $g.FillRectangle($rhBrush, $rightX + 2, $paneY + 2, $paneW - 4, [float]($paneH * 0.18))
        $rhBrush.Dispose()

        # Decorative File list stripes
        $stripePen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(140, 148, 163, 184), [Math]::Max(1.0, [float]($size * 0.015)))
        for ($i = 0; $i -lt 3; $i++) {
            $sy = $paneY + ($paneH * 0.30) + ($i * $paneH * 0.20)
            if ($sy -lt ($paneY + $paneH - 4)) {
                $g.DrawLine($stripePen, $leftX + 4, $sy, $leftX + $paneW - 6, $sy)
                $g.DrawLine($stripePen, $rightX + 4, $sy, $rightX + $paneW - 6, $sy)
            }
        }
        $stripePen.Dispose()
    }

    # Center Floating "TC" Badge
    $badgeW = [float]($rect.Width * 0.58)
    $badgeH = [float]($rect.Height * 0.52)
    $badgeX = [float]($rect.X + ($rect.Width - $badgeW) / 2.0)
    $badgeY = [float]($rect.Y + ($rect.Height - $badgeH) / 2.0)
    $badgeRect = New-Object System.Drawing.RectangleF($badgeX, $badgeY, $badgeW, $badgeH)
    $badgeRadius = [float]($size * 0.14)
    $badgePath = Create-RoundedRectanglePath $badgeRect $badgeRadius

    # Badge Gradient (Royal Blue to Vibrant Cyan)
    $bTop = [System.Drawing.Color]::FromArgb(255, 37, 99, 235)   # #2563eb
    $bBot = [System.Drawing.Color]::FromArgb(255, 6, 182, 212)   # #06b6d4
    $badgeBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($badgeRect, $bTop, $bBot, [System.Drawing.Drawing2D.LinearGradientMode]::ForwardDiagonal)
    $g.FillPath($badgeBrush, $badgePath)
    $badgeBrush.Dispose()

    # Badge outer white specular border
    $bPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(240, 255, 255, 255), [Math]::Max(1.2, [float]($size * 0.02)))
    $g.DrawPath($bPen, $badgePath)
    $bPen.Dispose()

    # Draw "TC" bold text
    $fontSize = [float]($badgeH * 0.58)
    $fontFamily = New-Object System.Drawing.FontFamily("Arial")
    $font = New-Object System.Drawing.Font($fontFamily, $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center

    # Drop shadow for text
    $shadowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(120, 0, 0, 0))
    $shadowY = [float]($badgeY + [Math]::Max(1.0, [float]($size * 0.015)))
    $shadowRect = New-Object System.Drawing.RectangleF($badgeX, $shadowY, $badgeW, $badgeH)
    $g.DrawString("TC", $font, $shadowBrush, $shadowRect, $sf)
    $shadowBrush.Dispose()

    # Crisp white text
    $textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $g.DrawString("TC", $font, $textBrush, $badgeRect, $sf)
    $textBrush.Dispose()

    $font.Dispose()
    $fontFamily.Dispose()
    $sf.Dispose()
    $path.Dispose()
    $badgePath.Dispose()
    $g.Dispose()

    return $bmp
}

Write-Output "Rendering high-res icons..."
$sizes = @(16, 24, 32, 48, 64, 128, 256)
$bitmaps = @()
$pngByteArrays = @()

foreach ($sz in $sizes) {
    $bmp = Render-AppIcon $sz
    $bitmaps += $bmp

    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $pngByteArrays += ,$ms.ToArray()
    $ms.Dispose()
}

# Save Master 512x512 and 256x256 PNGs
$bmp512 = Render-AppIcon 512
$bmp512.Save("$buildDir\icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bmp512.Save("$buildDir\icon-512x512.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bmp512.Dispose()

$bmp256 = Render-AppIcon 256
$bmp256.Save("$buildDir\icon-256x256.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bmp256.Dispose()

# Save Multi-Size ICO file (Standard Windows Vista-11 PNG-frame ICO)
$icoStream = New-Object System.IO.FileStream("$buildDir\icon.ico", [System.IO.FileMode]::Create)
$bw = New-Object System.IO.BinaryWriter($icoStream)

# ICONDIR header
$bw.Write([uint16]0)              # Reserved
$bw.Write([uint16]1)              # 1 = ICO
$bw.Write([uint16]$sizes.Count)   # Count

# Calculate offsets
# Header (6) + Entries (16 * count)
$offset = 6 + (16 * $sizes.Count)

for ($i = 0; $i -lt $sizes.Count; $i++) {
    $sz = $sizes[$i]
    $w = if ($sz -ge 256) { [byte]0 } else { [byte]$sz }
    $h = if ($sz -ge 256) { [byte]0 } else { [byte]$sz }
    $data = $pngByteArrays[$i]

    $bw.Write([byte]$w)           # Width
    $bw.Write([byte]$h)           # Height
    $bw.Write([byte]0)            # Color count (0 = >=8bpp)
    $bw.Write([byte]0)            # Reserved
    $bw.Write([uint16]1)          # Planes
    $bw.Write([uint16]32)         # BitCount
    $bw.Write([uint32]$data.Length) # Image Size
    $bw.Write([uint32]$offset)    # Image Offset

    $offset += $data.Length
}

# Write Image Payloads
for ($i = 0; $i -lt $sizes.Count; $i++) {
    $data = $pngByteArrays[$i]
    $bw.Write($data, 0, $data.Length)
}

$bw.Flush()
$bw.Close()
$icoStream.Dispose()

# Also save installerIcon.ico and uninstallerIcon.ico
Copy-Item "$buildDir\icon.ico" "$buildDir\installerIcon.ico" -Force
Copy-Item "$buildDir\icon.ico" "$buildDir\uninstallerIcon.ico" -Force

Write-Output "Generated icon.png, icon.ico, installerIcon.ico"

# Clean up bitmaps
foreach ($b in $bitmaps) { $b.Dispose() }

# --- 2. Generate NSIS installerSidebar.bmp (164 x 314, 24-bit BMP) ---
function Render-SidebarBitmap {
    param([string]$path, [bool]$isUninstall = $false)
    $w = 164
    $h = 314
    $bmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

    # Dark cyber gradient background
    $rect = New-Object System.Drawing.Rectangle(0, 0, $w, $h)
    $cTop = [System.Drawing.Color]::FromArgb(255, 12, 16, 28)    # #0c101c
    $cBot = [System.Drawing.Color]::FromArgb(255, 20, 29, 47)    # #141d2f
    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $cTop, $cBot, [System.Drawing.Drawing2D.LinearGradientMode]::Vertical)
    $g.FillRectangle($bgBrush, $rect)
    $bgBrush.Dispose()

    # Subtle cyan grid line at top and right
    $accentPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(80, 56, 189, 248), 1.0)
    $g.DrawLine($accentPen, 0, 0, $w, 0)
    $g.DrawLine($accentPen, $w - 1, 0, $w - 1, $h)
    $accentPen.Dispose()

    # Top Brand Logo Badge
    $badgeBmp = Render-AppIcon 64
    $g.DrawImage($badgeBmp, [int](($w - 64) / 2), 24, 64, 64)
    $badgeBmp.Dispose()

    # Titles
    $fontTitle = New-Object System.Drawing.Font("Segoe UI", 11, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $fontSubtitle = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
    $fontFeature = New-Object System.Drawing.Font("Segoe UI", 8.5, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
    $fontVersion = New-Object System.Drawing.Font("Segoe UI", 8, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
    
    $sfCenter = New-Object System.Drawing.StringFormat
    $sfCenter.Alignment = [System.Drawing.StringAlignment]::Center

    $whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $cyanBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 56, 189, 248))
    $grayBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 148, 163, 184))

    # App Name
    $g.DrawString("TOTAL COMMANDER", $fontTitle, $whiteBrush, [float]($w / 2.0), 98.0, $sfCenter)
    $subtitleText = if ($isUninstall) { "Uninstaller" } else { "Windows Edition" }
    $g.DrawString($subtitleText, $fontSubtitle, $cyanBrush, [float]($w / 2.0), 114.0, $sfCenter)

    # Decorative separator line
    $sepPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(60, 56, 189, 248), 1.0)
    $g.DrawLine($sepPen, 20, 134, $w - 20, 134)
    $sepPen.Dispose()

    # Graphical Two-Pane Mini-Illustration
    $paneY = 146
    $paneW = 56
    $paneH = 70
    $pLeftX = 20
    $pRightX = 88

    # Left Mini Pane
    $lpRect = New-Object System.Drawing.RectangleF($pLeftX, $paneY, $paneW, $paneH)
    $lpPath = Create-RoundedRectanglePath $lpRect ([float]4.0)
    $lpBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 24, 34, 53))
    $g.FillPath($lpBrush, $lpPath)
    $lpBrush.Dispose()
    $bluePen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 37, 99, 235), 1.0)
    $g.DrawPath($bluePen, $lpPath)
    $bluePen.Dispose()

    # Right Mini Pane
    $rpRect = New-Object System.Drawing.RectangleF($pRightX, $paneY, $paneW, $paneH)
    $rpPath = Create-RoundedRectanglePath $rpRect ([float]4.0)
    $rpBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 24, 34, 53))
    $g.FillPath($rpBrush, $rpPath)
    $rpBrush.Dispose()
    $greenPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 16, 185, 129), 1.0)
    $g.DrawPath($greenPen, $rpPath)
    $greenPen.Dispose()

    # Mini Transfer Arrow in middle
    $arrowFont = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $g.DrawString("<->", $arrowFont, $cyanBrush, [float]($w / 2.0), [float]($paneY + $paneH / 2.0 - 6), $sfCenter)
    $arrowFont.Dispose()

    # Mini stripes in panes
    $mPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(100, 148, 163, 184), 1.0)
    for ($i = 0; $i -lt 4; $i++) {
        $sy = $paneY + 12 + ($i * 12)
        $g.DrawLine($mPen, $pLeftX + 5, $sy, $pLeftX + $paneW - 6, $sy)
        $g.DrawLine($mPen, $pRightX + 5, $sy, $pRightX + $paneW - 6, $sy)
    }
    $mPen.Dispose()

    # Feature Bullet Points
    $sfLeft = New-Object System.Drawing.StringFormat
    $sfLeft.Alignment = [System.Drawing.StringAlignment]::Near

    $bulletY = 230
    if (-not $isUninstall) {
        $g.DrawString("> Orthodox Two-Pane", $fontFeature, $whiteBrush, 20.0, [float]$bulletY, $sfLeft)
        $g.DrawString("> Tabbed Navigation", $fontFeature, $whiteBrush, 20.0, [float]($bulletY + 17), $sfLeft)
        $g.DrawString("> Explorer Integration", $fontFeature, $whiteBrush, 20.0, [float]($bulletY + 34), $sfLeft)
    } else {
        $g.DrawString("> Remove App Files", $fontFeature, $whiteBrush, 20.0, [float]$bulletY, $sfLeft)
        $g.DrawString("> Clear Settings", $fontFeature, $whiteBrush, 20.0, [float]($bulletY + 17), $sfLeft)
        $g.DrawString("> Safe Uninstall", $fontFeature, $whiteBrush, 20.0, [float]($bulletY + 34), $sfLeft)
    }

    # Version / Tag at bottom
    $g.DrawString("v1.0.0 - x64 Edition", $fontVersion, $grayBrush, [float]($w / 2.0), [float]($h - 20), $sfCenter)

    $fontTitle.Dispose()
    $fontSubtitle.Dispose()
    $fontFeature.Dispose()
    $fontVersion.Dispose()
    $sfCenter.Dispose()
    $sfLeft.Dispose()
    $whiteBrush.Dispose()
    $cyanBrush.Dispose()
    $grayBrush.Dispose()
    $lpPath.Dispose()
    $rpPath.Dispose()
    $g.Dispose()

    # Save as 24-bit uncompressed BMP
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Bmp)
    $bmp.Dispose()
}

Write-Output "Rendering installerSidebar.bmp and uninstallerSidebar.bmp..."
Render-SidebarBitmap "$buildDir\installerSidebar.bmp" $false
Render-SidebarBitmap "$buildDir\uninstallerSidebar.bmp" $true

# --- 3. Generate NSIS installerHeader.bmp (150 x 57, 24-bit BMP) ---
function Render-HeaderBitmap {
    param([string]$path)
    $w = 150
    $h = 57
    $bmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

    # Header Background: Crisp clean white/off-white (standard NSIS header) or subtle dark
    $rect = New-Object System.Drawing.Rectangle(0, 0, $w, $h)
    $bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $g.FillRectangle($bgBrush, $rect)
    $bgBrush.Dispose()

    # Brand Icon on the right
    $iconBmp = Render-AppIcon 44
    $g.DrawImage($iconBmp, [int]($w - 48), [int](($h - 44) / 2), 44, 44)
    $iconBmp.Dispose()

    $g.Dispose()
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Bmp)
    $bmp.Dispose()
}

Write-Output "Rendering installerHeader.bmp..."
Render-HeaderBitmap "$buildDir\installerHeader.bmp"

Write-Output "All branded assets successfully generated in $buildDir!"
