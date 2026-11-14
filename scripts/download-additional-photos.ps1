$photoCandidates = (Get-Content -LiteralPath docs/images/additional-photo-candidates.json -Raw | ConvertFrom-Json).candidates
foreach ($photoCandidate in $photoCandidates) {
 $photoTarget = 'images/research/' + $photoCandidate.product_id + '-candidate.' + $photoCandidate.extension
 if (Test-Path -LiteralPath $photoTarget) { Write-Output ($photoCandidate.product_id + ': already downloaded'); continue }
 try {
  Invoke-WebRequest -Uri $photoCandidate.download_url -OutFile $photoTarget -TimeoutSec 25 -ErrorAction Stop
  Write-Output ($photoCandidate.product_id + ': downloaded')
 } catch {
  Write-Output ($photoCandidate.product_id + ': download failed; ' + $_.Exception.Message)
  if ($_.Exception.Response.StatusCode -eq 429) { Write-Output 'Rate limited. Stop and respect the source retry window.'; break }
 }
}
