param(
  [ValidateSet('Copy','Verify','ClearClipboard','TestDelivery')]
  [string]$Action = 'Verify'
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Net.Http
$credentialPath = Join-Path $PSScriptRoot '..\.private\email-worker\email-worker-secret.dpapi'
if (!(Test-Path -LiteralPath $credentialPath)) { throw 'Encrypted worker credential is missing.' }
$secured = Get-Content -LiteralPath $credentialPath -Raw | ConvertTo-SecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secured)
$http = $null
try {
  $credential = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  if ($Action -eq 'Copy') {
    Set-Clipboard -Value $credential
    Write-Output 'Worker secret copied without printing it. Paste into the approved Supabase secret fields, then run ClearClipboard.'
  } elseif ($Action -eq 'ClearClipboard') {
    if (([string](Get-Clipboard -Raw)).TrimEnd("`r","`n") -eq $credential) { Set-Clipboard -Value '' }
    Write-Output 'Worker credential removed from the current clipboard if present.'
  } else {
    $http = [Net.Http.HttpClient]::new()
    $http.Timeout = [TimeSpan]::FromSeconds(30)
    $uri = 'https://roamotmagssiipntchgh.supabase.co/functions/v1/order-email'
    if ($Action -eq 'TestDelivery') {
      $evidencePath = Join-Path $PSScriptRoot '..\.private\email-worker\delivery-tests.json'
      if (Test-Path -LiteralPath $evidencePath) {
        $deliveryTests = @(Get-Content -LiteralPath $evidencePath -Raw | ConvertFrom-Json)
      } else {
        $deliveryTests = @(
          [pscustomobject]@{kind='payment_confirmed';audience='admin';request_id=[guid]::NewGuid().ToString();provider_id=$null},
          [pscustomobject]@{kind='payment_confirmed';audience='customer';request_id=[guid]::NewGuid().ToString();provider_id=$null}
        )
        $deliveryTests | ConvertTo-Json | Set-Content -LiteralPath $evidencePath
      }
      foreach ($test in $deliveryTests) {
        foreach ($attempt in @(1,2)) {
          $request = [Net.Http.HttpRequestMessage]::new([Net.Http.HttpMethod]::Post,$uri)
          $request.Headers.Authorization = [Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer',$credential)
          $payload = @{action='self_test';request_id=$test.request_id;kind=$test.kind;audience=$test.audience} | ConvertTo-Json -Compress
          $request.Content = [Net.Http.StringContent]::new($payload,[Text.Encoding]::UTF8,'application/json')
          try {
            $response = $http.SendAsync($request).GetAwaiter().GetResult()
            $status = [int]$response.StatusCode
            $result = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult() | ConvertFrom-Json
            if ($status -eq 200 -and $result.accepted -and $result.provider_id) {
              if ($test.provider_id -and $test.provider_id -ne $result.provider_id) { throw 'Provider duplicate-prevention check failed.' }
              $test.provider_id = $result.provider_id
              [pscustomobject]@{audience=$test.audience;attempt=$attempt;status=$status;accepted=$true;provider_id=$test.provider_id;same_provider_id_on_retry=($attempt -eq 2)} | ConvertTo-Json -Compress
              $deliveryTests | ConvertTo-Json | Set-Content -LiteralPath $evidencePath
            } else {
              [pscustomobject]@{audience=$test.audience;attempt=$attempt;status=$status;provider_status=$result.provider_status;accepted=$false} | ConvertTo-Json -Compress
              break
            }
          } finally { if ($response) { $response.Dispose(); $response=$null }; $request.Dispose() }
        }
      }
      foreach ($test in $deliveryTests) {
        if (!$test.provider_id) { continue }
        $request = [Net.Http.HttpRequestMessage]::new([Net.Http.HttpMethod]::Post,$uri)
        $request.Headers.Authorization = [Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer',$credential)
        $request.Content = [Net.Http.StringContent]::new((@{action='test_status';provider_id=$test.provider_id}|ConvertTo-Json -Compress),[Text.Encoding]::UTF8,'application/json')
        try {
          $response = $http.SendAsync($request).GetAwaiter().GetResult()
          $result = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult() | ConvertFrom-Json
          [pscustomobject]@{audience=$test.audience;status=[int]$response.StatusCode;provider_status=$result.provider_status;delivery_status=$result.delivery_status;provider_id=$test.provider_id}|ConvertTo-Json -Compress
        } finally { if ($response) { $response.Dispose(); $response=$null }; $request.Dispose() }
      }
      return
    }
    foreach ($check in @('correct','missing','incorrect')) {
      $request = [Net.Http.HttpRequestMessage]::new([Net.Http.HttpMethod]::Post,$uri)
      if ($check -eq 'correct') { $request.Headers.Authorization = [Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer',$credential) }
      if ($check -eq 'incorrect') { $request.Headers.Authorization = [Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer','deliberately-wrong-worker-secret') }
      $request.Content = [Net.Http.StringContent]::new('{"action":"health"}',[Text.Encoding]::UTF8,'application/json')
      try {
        $response = $http.SendAsync($request).GetAwaiter().GetResult()
        $status = [int]$response.StatusCode
        if ($check -eq 'correct' -and $status -eq 200) {
          $health = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult() | ConvertFrom-Json
          [pscustomobject]@{check=$check;status=$status;authenticated=[bool]$health.authenticated;resend_key_configured=[bool]$health.resend_key_configured;mode=$health.mode} | ConvertTo-Json -Compress
          if (!$health.authenticated) { throw 'Authenticated health check failed.' }
        } else {
          [pscustomobject]@{check=$check;status=$status} | ConvertTo-Json -Compress
          if (($check -eq 'correct' -and $status -ne 200) -or ($check -ne 'correct' -and $status -ne 401)) { throw 'Worker authentication check failed.' }
        }
      } finally { if ($response) { $response.Dispose(); $response=$null }; $request.Dispose() }
    }
  }
} catch {
  # Never include request objects, authorization headers or credential values.
  throw 'Credential operation failed. Inspect the reported HTTP status or run as the Windows user who created the encrypted file.'
} finally {
  if ($http) { $http.Dispose() }
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  $credential = $null
  $secured.Dispose()
}
