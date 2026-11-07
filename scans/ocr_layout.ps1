param([int]$Limit=0)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
[Windows.Storage.StorageFile,Windows.Storage,ContentType=WindowsRuntime] > $null
[Windows.Storage.Streams.IRandomAccessStream,Windows.Storage.Streams,ContentType=WindowsRuntime] > $null
[Windows.Graphics.Imaging.BitmapDecoder,Windows.Graphics.Imaging,ContentType=WindowsRuntime] > $null
[Windows.Graphics.Imaging.SoftwareBitmap,Windows.Graphics.Imaging,ContentType=WindowsRuntime] > $null
[Windows.Media.Ocr.OcrEngine,Windows.Foundation,ContentType=WindowsRuntime] > $null
[Windows.Media.Ocr.OcrResult,Windows.Foundation,ContentType=WindowsRuntime] > $null
[Windows.Globalization.Language,Windows.Globalization,ContentType=WindowsRuntime] > $null
$asTask=([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {$_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'})[0]
function Await($Operation,$Type) { $t=$asTask.MakeGenericMethod($Type).Invoke($null,@($Operation));$t.Wait();return $t.Result }
$out=Join-Path $PSScriptRoot 'layout'
New-Item -ItemType Directory -Force $out > $null
$engine=[Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage((New-Object Windows.Globalization.Language('ru')))
$files=@(Get-ChildItem $PSScriptRoot -Filter 'spread_????.png' | Sort-Object Name)
if($Limit -gt 0){$files=@($files | Select-Object -First $Limit)}
foreach($f in $files){
 $dest=Join-Path $out ($f.BaseName+'.json')
 if(Test-Path $dest){continue}
 $file=Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($f.FullName)) ([Windows.Storage.StorageFile])
 $stream=Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
 $decoder=Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
 $bitmap=Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
 $result=Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
 $lines=@();$i=0
 foreach($line in $result.Lines){
  $words=@($line.Words | ForEach-Object {@{text=$_.Text;x=$_.BoundingRect.X;y=$_.BoundingRect.Y;width=$_.BoundingRect.Width;height=$_.BoundingRect.Height}})
  $lines+=@{id=$i;text=$line.Text;words=$words};$i++
 }
 $data=@{source=$f.Name;width=$bitmap.PixelWidth;height=$bitmap.PixelHeight;lines=$lines}
 [IO.File]::WriteAllText($dest,($data | ConvertTo-Json -Depth 8 -Compress),(New-Object Text.UTF8Encoding($false)))
 $bitmap.Dispose();$stream.Dispose()
 Write-Output ($f.Name+' '+$lines.Count+' lines')
}
