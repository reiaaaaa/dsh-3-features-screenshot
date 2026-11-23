/**
 * The Windows half of the snipper, kept apart so the script can be inspected
 * and syntax-checked without running a capture.
 *
 * The system snipping overlay (`ms-screenclip:`) is bound to one display on some
 * setups and always leaves the picture in the clipboard. This script draws its
 * own selection layer across the whole virtual screen instead — the desktop keeps
 * running behind a light veil, any monitor can be used, a cancel is reported
 * immediately, and the selected rectangle is copied straight into the PNG.
 */

/**
 * Build the PowerShell script that writes the picked PNG to `destination`.
 * @param destination - absolute path of the PNG to create.
 * @param deadlineSeconds - how long the user may take.
 * @returns the script text.
 */
export function windowsScript(destination, deadlineSeconds = 90) {
  return [
    "$ErrorActionPreference = 'Stop'",
    'Add-Type -AssemblyName System.Windows.Forms',
    'Add-Type -AssemblyName System.Drawing',
    "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class DshShotDpi { [DllImport(\"user32.dll\")] public static extern bool SetProcessDPIAware(); }'",
    'try { [DshShotDpi]::SetProcessDPIAware() | Out-Null } catch { }',
    '$screen = [System.Windows.Forms.SystemInformation]::VirtualScreen',
    '$script:area = $null',
    '$script:dragging = $false',
    '$script:origin = New-Object System.Drawing.Point -ArgumentList 0, 0',
    '$script:current = New-Object System.Drawing.Point -ArgumentList 0, 0',
    `$script:deadline = (Get-Date).AddSeconds(${Math.max(5, Math.trunc(deadlineSeconds))})`,
    '$script:expired = $false',
    '',
    '$form = New-Object System.Windows.Forms.Form',
    '$form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::None',
    '$form.StartPosition = [System.Windows.Forms.FormStartPosition]::Manual',
    '$form.Bounds = $screen',
    '$form.TopMost = $true',
    '$form.ShowInTaskbar = $false',
    '$form.BackColor = [System.Drawing.Color]::Black',
    '$form.Opacity = 0.35',
    '$form.Cursor = [System.Windows.Forms.Cursors]::Cross',
    '$form.KeyPreview = $true',
    '$script:form = $form',
    '$script:hole = $null',
    '$script:fullRect = New-Object System.Drawing.Rectangle -ArgumentList $screen.X, $screen.Y, $screen.Width, $screen.Height',
    '',
    'function Update-Hole([int]$left, [int]$top, [int]$width, [int]$height) {',
    '  $region = New-Object System.Drawing.Region -ArgumentList $script:fullRect',
    '  if ($width -ge 2 -and $height -ge 2) {',
    '    $cut = New-Object System.Drawing.Rectangle -ArgumentList $left, $top, $width, $height',
    '    $region.Exclude($cut)',
    '  }',
    '  if ($null -ne $script:hole) { $script:hole.Dispose() }',
    '  $script:hole = $region',
    '  $script:form.Region = $region',
    '}',
    '',
    '$form.Add_Paint({',
    '  if (-not $script:dragging) { return }',
    '  $graphics = $_.Graphics',
    '  $left = [Math]::Min($script:origin.X, $script:current.X)',
    '  $top = [Math]::Min($script:origin.Y, $script:current.Y)',
    '  $width = [Math]::Abs($script:current.X - $script:origin.X)',
    '  $height = [Math]::Abs($script:current.Y - $script:origin.Y)',
    '  if ($width -lt 2 -or $height -lt 2) { return }',
    '  $pen = New-Object System.Drawing.Pen -ArgumentList ([System.Drawing.Color]::FromArgb(61, 90, 254)), 2',
    '  $graphics.DrawRectangle($pen, ($left - 2), ($top - 2), ($width + 4), ($height + 4))',
    '  $pen.Dispose()',
    '  $label = (\'{0} x {1}\' -f $width, $height)',
    '  $font = New-Object System.Drawing.Font -ArgumentList \'Segoe UI\', 11',
    '  $textSize = $graphics.MeasureString($label, $font)',
    '  $badge = New-Object System.Drawing.SolidBrush -ArgumentList ([System.Drawing.Color]::FromArgb(61, 90, 254))',
    '  $badgeY = if ($top -ge 32) { $top - 30 } else { $top + $height + 8 }',
    '  $graphics.FillRectangle($badge, $left, $badgeY, ($textSize.Width + 10), ($textSize.Height + 4))',
    '  $graphics.DrawString($label, $font, [System.Drawing.Brushes]::White, ($left + 5), ($badgeY + 2))',
    '  $badge.Dispose()',
    '  $font.Dispose()',
    '})',
    '',
    '$form.Add_MouseDown({',
    '  if ($_.Button -eq [System.Windows.Forms.MouseButtons]::Right) { $script:area = $null; $script:form.Close(); return }',
    '  if ($_.Button -ne [System.Windows.Forms.MouseButtons]::Left) { return }',
    '  $script:dragging = $true',
    '  $script:origin = $_.Location',
    '  $script:current = $_.Location',
    '  Update-Hole 0 0 0 0',
    '})',
    '',
    '$form.Add_MouseMove({',
    '  if (-not $script:dragging) { return }',
    '  $script:current = $_.Location',
    '  $left = [Math]::Min($script:origin.X, $script:current.X)',
    '  $top = [Math]::Min($script:origin.Y, $script:current.Y)',
    '  $width = [Math]::Abs($script:current.X - $script:origin.X)',
    '  $height = [Math]::Abs($script:current.Y - $script:origin.Y)',
    '  Update-Hole $left $top $width $height',
    '  $script:form.Invalidate()',
    '})',
    '',
    '$form.Add_MouseUp({',
    '  if (-not $script:dragging) { return }',
    '  $script:dragging = $false',
    '  $script:current = $_.Location',
    '  $left = [Math]::Min($script:origin.X, $script:current.X)',
    '  $top = [Math]::Min($script:origin.Y, $script:current.Y)',
    '  $width = [Math]::Abs($script:current.X - $script:origin.X)',
    '  $height = [Math]::Abs($script:current.Y - $script:origin.Y)',
    '  if ($width -lt 4 -or $height -lt 4) { Update-Hole 0 0 0 0; $script:form.Invalidate(); return }',
    '  $script:area = New-Object System.Drawing.Rectangle -ArgumentList ($left + $script:screen.X), ($top + $script:screen.Y), $width, $height',
    '  $script:form.Close()',
    '})',
    '',
    '$form.Add_KeyDown({',
    '  if ($_.KeyCode -eq [System.Windows.Forms.Keys]::Escape) { $script:area = $null; $script:form.Close() }',
    '})',
    '',
    '$timer = New-Object System.Windows.Forms.Timer',
    '$timer.Interval = 1000',
    '$script:timer = $timer',
    '$timer.Add_Tick({',
    '  if ((Get-Date) -lt $script:deadline) { return }',
    '  $script:expired = $true',
    '  $script:timer.Stop()',
    '  $script:area = $null',
    '  $script:form.Close()',
    '})',
    '$timer.Start()',
    '',
    '[System.Windows.Forms.Application]::Run($form)',
    '$timer.Stop()',
    'if ($null -eq $script:area) {',
    '  if ($script:expired) { [Console]::Error.WriteLine(\'no screen snip arrived\'); exit 3 }',
    "  [Console]::Error.WriteLine('the screen snip was cancelled'); exit 2",
    '}',
    'Start-Sleep -Milliseconds 200',
    '$bitmap = New-Object System.Drawing.Bitmap -ArgumentList $script:area.Width, $script:area.Height',
    '$graphics = [System.Drawing.Graphics]::FromImage($bitmap)',
    '$graphics.CopyFromScreen($script:area.X, $script:area.Y, 0, 0, $bitmap.Size)',
    '$graphics.Dispose()',
    `$bitmap.Save('${escapeSingleQuotes(destination)}', [System.Drawing.Imaging.ImageFormat]::Png)`,
    '$bitmap.Dispose()',
    "[Console]::Out.WriteLine('captured')",
  ].join('\n')
}

/**
 * PowerShell reads its script from one base64 UTF-16LE argument, so no quoting
 * rule of cmd.exe, no temporary script file, and no console window apply.
 * @param script - the snip script.
 * @returns the command-line argument.
 */
export function encodeWindowsScript(script) {
  return Buffer.from(script, 'utf16le').toString('base64')
}

/**
 * Quote a path for a PowerShell single-quoted string.
 * @param value - path text.
 * @returns the escaped text.
 */
function escapeSingleQuotes(value) {
  return value.replaceAll("'", "''")
}
