$ErrorActionPreference = 'Stop'
$imageCandidates = @(
 @('dualsense-white-hd','Playstation DualSense Controller.png'),
 @('iphone-16-ultramarine-back','Back view of iPhone 16 Ultramarine.jpg'),
 @('dualsense-edge','DualSense Edge Controller.jpg'),
 @('dualsense-midnight-black','Playstation 5 DualSense controller in Midnight Black, 2026-02-07 (front).jpg'),
 @('ps5-alternative','Immagine Playstation 5.jpg'),
 @('airpods-comparison','AirPods 4 and AirPods Pro 2.jpg')
)
$imageEvidence = @()
foreach ($candidate in $imageCandidates) {
 $imageSlug = $candidate[0]
 $imageTitle = $candidate[1]
 $sourcePage = 'https://commons.wikimedia.org/wiki/File:' + [Uri]::EscapeDataString($imageTitle.Replace(' ','_'))
 try {
  $metadataUrl = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url%7Cextmetadata&titles=' + [Uri]::EscapeDataString('File:' + $imageTitle)
  $metadata = Invoke-RestMethod -Uri $metadataUrl -TimeoutSec 30
  $imageInfo = @($metadata.query.pages.PSObject.Properties.Value)[0].imageinfo[0]
  $imageLicence = $imageInfo.extmetadata.LicenseShortName.value
  if ($imageLicence -notmatch '^(CC BY(-SA)? [234]\.0|CC0|Public domain)$') { throw ('Licence needs review: ' + $imageLicence) }
  $imageExtension = [IO.Path]::GetExtension(([Uri]$imageInfo.url).AbsolutePath)
  $localImage = 'images/research/' + $imageSlug + $imageExtension
  Invoke-WebRequest -Uri $imageInfo.url -OutFile $localImage -TimeoutSec 45
  $imageEvidence += [PSCustomObject]@{slug=$imageSlug; title=$imageTitle; source=$sourcePage; download_url=$imageInfo.url; licence=$imageLicence; licence_url=$imageInfo.extmetadata.LicenseUrl.value; author_html=$imageInfo.extmetadata.Artist.value; credit_html=$imageInfo.extmetadata.Credit.value; sha256=(Get-FileHash -LiteralPath $localImage -Algorithm SHA256).Hash; original_path=$localImage; checked_on='2026-11-03'; status='awaiting_visual_review'}
  Write-Output ($imageSlug + ': downloaded; ' + $imageLicence)
 } catch {
  $imageEvidence += [PSCustomObject]@{slug=$imageSlug;title=$imageTitle;source=$sourcePage;status='blocked';reason=$_.Exception.Message}
  Write-Output ($imageSlug + ': ' + $_.Exception.Message)
 }
}
$imageEvidence | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath docs/images/download-review.json -Encoding utf8
