param(
  [Parameter(Mandatory = $true)][string]$BucketName,
  [Parameter(Mandatory = $true)][string]$DistributionId
)

$ErrorActionPreference = 'Stop'
$AppDirectory = Join-Path $PSScriptRoot '..\app'
$ConfigFile = Join-Path $AppDirectory 'config.js'

if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
  throw 'AWS CLI was not found. Install and configure AWS CLI v2, then retry.'
}
if (-not (Test-Path -LiteralPath $ConfigFile)) {
  throw 'app/config.js is missing. Copy config.example.js and fill in the stack outputs first.'
}

aws s3 sync $AppDirectory "s3://$BucketName/" --exclude 'config.example.js'
if ($LASTEXITCODE -ne 0) { throw 'S3 upload failed.' }

aws cloudfront create-invalidation --distribution-id $DistributionId --paths '/*'
if ($LASTEXITCODE -ne 0) { throw 'CloudFront invalidation could not be created.' }

Write-Host 'Site files uploaded. CloudFront invalidation submitted.'
