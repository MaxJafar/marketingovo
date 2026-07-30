[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$MsiPath,

  [Parameter(Mandatory = $true)]
  [string]$BaselinePath,

  [Parameter(Mandatory = $true)]
  [string]$EvidencePath,

  [Parameter(Mandatory = $true)]
  [string]$Target
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

if ($env:GITHUB_ACTIONS -ne "true" -or $env:RUNNER_OS -ne "Windows") {
  throw "The destructive installer lifecycle gate may run only on an ephemeral GitHub-hosted Windows runner."
}
if ($Target -ne "x86_64-pc-windows-msvc") {
  throw "Unsupported Windows lifecycle target: $Target"
}

$repositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$repositoryPrefix = $repositoryRoot.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
$resolvedMsi = (Resolve-Path -LiteralPath $MsiPath).Path
if ([IO.Path]::GetExtension($resolvedMsi) -ne ".msi") {
  throw "The lifecycle input is not an MSI file."
}
$resolvedBaseline = (Resolve-Path -LiteralPath $BaselinePath).Path
$resolvedEvidence = [IO.Path]::GetFullPath($EvidencePath)
$currentVersion = [string](Get-Content -LiteralPath (Join-Path $repositoryRoot "package.json") -Raw | ConvertFrom-Json).version
$baseline = Get-Content -LiteralPath $resolvedBaseline -Raw | ConvertFrom-Json
if (
  $baseline.schemaVersion -ne 1 -or
  $baseline.target -ne $Target -or
  $baseline.currentVersion -ne $currentVersion -or
  $baseline.available -isnot [bool]
) {
  throw "Upgrade baseline metadata is malformed or for another target."
}

$baselineMsi = $null
if ($baseline.available) {
  $baselineMsi = [IO.Path]::GetFullPath((Join-Path $repositoryRoot ([string]$baseline.installerPath)))
  if (
    -not $baselineMsi.StartsWith($repositoryPrefix, [StringComparison]::OrdinalIgnoreCase) -or
    [IO.Path]::GetExtension($baselineMsi) -ne ".msi" -or
    -not (Test-Path -LiteralPath $baselineMsi -PathType Leaf) -or
    (Get-FileHash -Algorithm SHA256 -LiteralPath $baselineMsi).Hash.ToLowerInvariant() -ne $baseline.installerSha256
  ) {
    throw "Upgrade baseline MSI does not match its verified metadata."
  }
}

$expectedThumbprint = ($env:AGENTSEO_WINDOWS_CERTIFICATE_THUMBPRINT -replace "\s", "").ToUpperInvariant()
if ($expectedThumbprint -notmatch "^[0-9A-F]{40}$") {
  throw "AGENTSEO_WINDOWS_CERTIFICATE_THUMBPRINT is required for lifecycle verification."
}

$runKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
$runValueName = "AGENTseo"
$healthUri = "http://127.0.0.1:3210/api/v1/health"
$projectsUri = "http://127.0.0.1:3210/api/v1/projects"
$installLog = Join-Path $env:RUNNER_TEMP "agentseo-msi-install.log"
$upgradeLog = Join-Path $env:RUNNER_TEMP "agentseo-msi-upgrade.log"
$uninstallLog = Join-Path $env:RUNNER_TEMP "agentseo-msi-uninstall.log"
$installedMsi = $null
$backgroundProcess = $null

function Get-RunValue {
  try {
    $item = Get-ItemProperty -LiteralPath $runKey -Name $runValueName -ErrorAction Stop
    return [string]$item.PSObject.Properties[$runValueName].Value
  }
  catch [System.Management.Automation.ItemNotFoundException] {
    return $null
  }
  catch [System.Management.Automation.PSArgumentException] {
    return $null
  }
}

function Invoke-Msi {
  param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("install", "uninstall")]
    [string]$Operation,
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [Parameter(Mandatory = $true)]
    [string]$LogPath
  )

  $mode = if ($Operation -eq "install") { "/i" } else { "/x" }
  $arguments = @($mode, "`"$Path`"", "/qn", "/norestart", "/L*v", "`"$LogPath`"")
  $process = Start-Process -FilePath "msiexec.exe" -ArgumentList $arguments -Wait -PassThru
  if ($process.ExitCode -ne 0) {
    throw "MSI $Operation failed with exit code $($process.ExitCode). See $LogPath."
  }
}

function Get-ValidSignature {
  param([Parameter(Mandatory = $true)][string]$Path)
  $signature = Get-AuthenticodeSignature -LiteralPath $Path
  if ($signature.Status -ne "Valid" -or -not $signature.SignerCertificate) {
    throw "Authenticode verification failed for $Path`: $($signature.Status) $($signature.StatusMessage)"
  }
  if ($signature.SignerCertificate.Thumbprint -ne $expectedThumbprint) {
    throw "The Authenticode signer for $Path does not match the release certificate."
  }
  if (-not $signature.TimeStamperCertificate) {
    throw "The Authenticode signature for $Path has no trusted timestamp."
  }
  return $signature
}

function Get-Health {
  try {
    return Invoke-RestMethod -Method Get -Uri $healthUri -TimeoutSec 2
  }
  catch {
    return $null
  }
}

function Wait-ForHealthyService {
  param([Parameter(Mandatory = $true)][string]$ExpectedVersion)
  $deadline = [DateTime]::UtcNow.AddSeconds(60)
  while ([DateTime]::UtcNow -lt $deadline) {
    $health = Get-Health
    if ($health -and $health.status -eq "ok" -and $health.version -eq $ExpectedVersion) {
      return $health
    }
    Start-Sleep -Milliseconds 500
  }
  throw "The installed background launcher did not produce healthy version $ExpectedVersion within 60 seconds."
}

function Get-InstalledProcesses {
  param([Parameter(Mandatory = $true)][string]$InstallRoot)
  $rootPrefix = [IO.Path]::GetFullPath($InstallRoot).TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
  return @(Get-CimInstance -ClassName Win32_Process | Where-Object {
    if ([string]::IsNullOrWhiteSpace($_.ExecutablePath)) { return $false }
    try {
      $candidate = [IO.Path]::GetFullPath([string]$_.ExecutablePath)
      return $candidate.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)
    }
    catch {
      return $false
    }
  })
}

function Resolve-InstalledLauncher {
  $commandLine = Get-RunValue
  if (-not $commandLine -or $commandLine -notmatch '^"(?<path>[^"]+\.exe)" --background$') {
    throw "The MSI did not register the exact quoted --background login command."
  }
  $executablePath = $Matches["path"]
  if (-not (Test-Path -LiteralPath $executablePath -PathType Leaf)) {
    throw "The registered background launcher does not exist: $executablePath"
  }
  [PSCustomObject]@{
    Command = $commandLine
    Executable = $executablePath
    Root = Split-Path -Parent $executablePath
    Signature = Get-ValidSignature -Path $executablePath
  }
}

function Start-InstalledBackground {
  param(
    [Parameter(Mandatory = $true)]$Launcher,
    [Parameter(Mandatory = $true)][string]$ExpectedVersion
  )
  $process = Start-Process -FilePath $Launcher.Executable -ArgumentList "--background" -PassThru
  $serviceHealth = Wait-ForHealthyService -ExpectedVersion $ExpectedVersion
  $process.Refresh()
  if ($process.HasExited) {
    throw "The login launcher exited instead of retaining ownership of the local service."
  }
  $ownedProcesses = @(Get-InstalledProcesses -InstallRoot $Launcher.Root)
  if (-not ($ownedProcesses | Where-Object { $_.ProcessId -eq $process.Id })) {
    throw "The signed background launcher was not present in the installed process inventory."
  }
  $ownedChildren = @($ownedProcesses | Where-Object { $_.ParentProcessId -eq $process.Id })
  if ($ownedChildren.Count -lt 1) {
    throw "The background launcher has no installed child daemon to own."
  }
  [PSCustomObject]@{
    Process = $process
    Health = $serviceHealth
    OwnedProcesses = $ownedProcesses
    OwnedChildren = $ownedChildren
  }
}

function Stop-InstalledBackground {
  param(
    [Parameter(Mandatory = $true)]$Process,
    [Parameter(Mandatory = $true)][string]$InstallRoot
  )
  if (-not $Process.HasExited) {
    & taskkill.exe /PID $Process.Id /T /F | Out-Null
  }
  $deadline = [DateTime]::UtcNow.AddSeconds(60)
  while ([DateTime]::UtcNow -lt $deadline) {
    $processGone = -not (Get-Process -Id $Process.Id -ErrorAction SilentlyContinue)
    $installedProcessCount = @(Get-InstalledProcesses -InstallRoot $InstallRoot).Count
    $serviceGone = $null -eq (Get-Health)
    if ($processGone -and $installedProcessCount -eq 0 -and $serviceGone) {
      return
    }
    Start-Sleep -Milliseconds 500
  }
  throw "Background stop did not remove the installed process tree and loopback service within 60 seconds."
}

function Test-SingleInstanceActivation {
  param(
    [Parameter(Mandatory = $true)]$Launcher,
    [Parameter(Mandatory = $true)]$Background
  )
  $before = @(Get-InstalledProcesses -InstallRoot $Launcher.Root)
  $secondary = Start-Process -FilePath $Launcher.Executable -ArgumentList "--no-update" -PassThru
  if (-not $secondary.WaitForExit(15000)) {
    & taskkill.exe /PID $secondary.Id /T /F | Out-Null
    throw "A second desktop launch did not hand off to the existing signed launcher."
  }
  if ($secondary.ExitCode -ne 0) {
    throw "The single-instance handoff exited with code $($secondary.ExitCode)."
  }
  $deadline = [DateTime]::UtcNow.AddSeconds(30)
  while ([DateTime]::UtcNow -lt $deadline) {
    $after = @(Get-InstalledProcesses -InstallRoot $Launcher.Root)
    $primaryAlive = $null -ne (Get-Process -Id $Background.Process.Id -ErrorAction SilentlyContinue)
    $beforeIds = @($before | ForEach-Object { [int]$_.ProcessId })
    $newOwners = @($after | Where-Object {
      $beforeIds -notcontains [int]$_.ProcessId
    })
    if ($primaryAlive -and $after.Count -eq $before.Count -and $newOwners.Count -eq 0 -and (Get-Health)) {
      return
    }
    Start-Sleep -Milliseconds 500
  }
  throw "A user activation created a competing installed process instead of reusing the background launcher."
}

function Get-OwnedDataDirectory {
  param([Parameter(Mandatory = $true)][array]$Children)
  $directories = @($Children | ForEach-Object {
      $commandLine = [string]$_.CommandLine
      if ($commandLine -match '--data-dir\s+(?:"(?<quoted>[^"]+)"|(?<bare>\S+))') {
        $value = if ($Matches["quoted"]) { $Matches["quoted"] } else { $Matches["bare"] }
        [IO.Path]::GetFullPath($value)
      }
    } | Sort-Object -Unique)
  if ($directories.Count -ne 1 -or -not (Test-Path -LiteralPath $directories[0] -PathType Container)) {
    throw "Could not derive one local data directory from the owned daemon process."
  }
  return [string]$directories[0]
}

function Get-ServiceToken {
  param([Parameter(Mandatory = $true)][string]$DataDirectory)
  $tokenPath = Join-Path $DataDirectory "service-token"
  if (-not (Test-Path -LiteralPath $tokenPath -PathType Leaf)) {
    throw "Installed service token is missing from the owned data directory."
  }
  $token = (Get-Content -LiteralPath $tokenPath -Raw).Trim()
  if ($token -notmatch "^[A-Za-z0-9_-]{32,}$") {
    throw "Installed service token is malformed."
  }
  return $token
}

function New-UpgradeCanary {
  param([Parameter(Mandatory = $true)][string]$DataDirectory)
  $token = Get-ServiceToken -DataDirectory $DataDirectory
  $headers = @{ Authorization = "Bearer $token" }
  $body = @{ name = "Native upgrade canary"; canonicalUrl = "https://example.com" } | ConvertTo-Json -Compress
  $project = Invoke-RestMethod -Method Post -Uri $projectsUri -Headers $headers -ContentType "application/json" -Body $body -TimeoutSec 10
  if (-not $project.id -or $project.name -ne "Native upgrade canary") {
    throw "Could not create the pre-upgrade project canary."
  }
  return [string]$project.id
}

function Test-UpgradeCanary {
  param(
    [Parameter(Mandatory = $true)][string]$ProjectId,
    [Parameter(Mandatory = $true)][string]$DataDirectory
  )
  $token = Get-ServiceToken -DataDirectory $DataDirectory
  $projects = @(Invoke-RestMethod -Method Get -Uri $projectsUri -Headers @{ Authorization = "Bearer $token" } -TimeoutSec 10)
  if (-not ($projects | Where-Object { $_.id -eq $ProjectId -and $_.name -eq "Native upgrade canary" })) {
    throw "Project data did not survive the MSI upgrade."
  }
}

function Wait-ForUninstall {
  param(
    [Parameter(Mandatory = $true)][string]$InstallRoot,
    [Parameter(Mandatory = $true)][string]$ExecutablePath
  )
  $deadline = [DateTime]::UtcNow.AddSeconds(60)
  while ([DateTime]::UtcNow -lt $deadline) {
    $installedProcessCount = @(Get-InstalledProcesses -InstallRoot $InstallRoot).Count
    $registrationGone = $null -eq (Get-RunValue)
    $serviceGone = $null -eq (Get-Health)
    $executableGone = -not (Test-Path -LiteralPath $ExecutablePath)
    if ($installedProcessCount -eq 0 -and $registrationGone -and $serviceGone -and $executableGone) {
      return
    }
    Start-Sleep -Milliseconds 500
  }
  throw "Uninstall did not remove registration, executable, process tree and service within 60 seconds."
}

if (Get-RunValue) {
  throw "The ephemeral runner already contains a AGENTseo login registration."
}
if (Get-Health) {
  throw "The ephemeral runner already has a service listening on the AGENTseo port."
}

try {
  $currentMsiSignature = Get-ValidSignature -Path $resolvedMsi
  $initialMsi = if ($baseline.available) { $baselineMsi } else { $resolvedMsi }
  $initialMsiSignature = Get-ValidSignature -Path $initialMsi
  Invoke-Msi -Operation install -Path $initialMsi -LogPath $installLog
  $installedMsi = $initialMsi

  $initialLauncher = Resolve-InstalledLauncher
  $initialVersion = if ($baseline.available) { [string]$baseline.version } else { $currentVersion }
  $initialBackground = Start-InstalledBackground -Launcher $initialLauncher -ExpectedVersion $initialVersion
  $backgroundProcess = $initialBackground.Process
  $dataDirectoryPath = Get-OwnedDataDirectory -Children $initialBackground.OwnedChildren
  $canaryProjectId = New-UpgradeCanary -DataDirectory $dataDirectoryPath

  $currentLauncher = $initialLauncher
  $currentBackground = $initialBackground
  $upgradeStatus = "not-tested-prerelease"
  $dataSurvivedUpgrade = "not-applicable"
  $healthAfterUpgrade = $null
  $versionAfterUpgrade = $null

  if ($baseline.available) {
    Stop-InstalledBackground -Process $initialBackground.Process -InstallRoot $initialLauncher.Root
    $backgroundProcess = $null
    Invoke-Msi -Operation install -Path $resolvedMsi -LogPath $upgradeLog
    $installedMsi = $resolvedMsi
    $currentLauncher = Resolve-InstalledLauncher
    $currentBackground = Start-InstalledBackground -Launcher $currentLauncher -ExpectedVersion $currentVersion
    $backgroundProcess = $currentBackground.Process
    $upgradedDataDirectory = Get-OwnedDataDirectory -Children $currentBackground.OwnedChildren
    if ($upgradedDataDirectory -ne $dataDirectoryPath) {
      throw "MSI upgrade changed the local data directory."
    }
    Test-UpgradeCanary -ProjectId $canaryProjectId -DataDirectory $dataDirectoryPath
    $upgradeStatus = "verified"
    $dataSurvivedUpgrade = "verified"
    $healthAfterUpgrade = $currentBackground.Health
    $versionAfterUpgrade = [string]$currentBackground.Health.version
  }

  Test-SingleInstanceActivation -Launcher $currentLauncher -Background $currentBackground

  Stop-InstalledBackground -Process $currentBackground.Process -InstallRoot $currentLauncher.Root
  $backgroundProcess = $null
  Invoke-Msi -Operation uninstall -Path $resolvedMsi -LogPath $uninstallLog
  $installedMsi = $null
  Wait-ForUninstall -InstallRoot $currentLauncher.Root -ExecutablePath $currentLauncher.Executable
  if (-not (Test-Path -LiteralPath (Join-Path $dataDirectoryPath "agentseo.db") -PathType Leaf)) {
    throw "Uninstall unexpectedly removed the user's local project database."
  }

  $evidenceDirectory = Split-Path -Parent $resolvedEvidence
  New-Item -ItemType Directory -Path $evidenceDirectory -Force | Out-Null
  $evidence = [ordered]@{
    schemaVersion = 2
    target = $Target
    platform = "windows"
    version = $currentVersion
    verifiedAt = [DateTime]::UtcNow.ToString("o")
    installerSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $resolvedMsi).Hash.ToLowerInvariant()
    signerThumbprint = $currentMsiSignature.SignerCertificate.Thumbprint
    executableSignerThumbprint = $currentLauncher.Signature.SignerCertificate.Thumbprint
    install = "verified"
    loginRegistration = "created"
    loginCommand = "quoted-executable --background"
    processTreeOwnership = "verified"
    singleInstanceActivation = "verified"
    installedProcessCount = [Math]::Max($initialBackground.OwnedProcesses.Count, $currentBackground.OwnedProcesses.Count)
    ownedChildProcessCount = [Math]::Max($initialBackground.OwnedChildren.Count, $currentBackground.OwnedChildren.Count)
    backgroundHealth = [ordered]@{
      status = [string]$initialBackground.Health.status
      database = [string]$initialBackground.Health.database
      queue = [string]$initialBackground.Health.queue
      version = [string]$initialBackground.Health.version
    }
    stop = "verified"
    upgrade = $upgradeStatus
    baselineVersion = if ($baseline.available) { [string]$baseline.version } else { $null }
    baselineInstallerSha256 = if ($baseline.available) { [string]$baseline.installerSha256 } else { $null }
    baselineSignerThumbprint = if ($baseline.available) { $initialMsiSignature.SignerCertificate.Thumbprint } else { $null }
    healthAfterUpgrade = $healthAfterUpgrade
    versionAfterUpgrade = $versionAfterUpgrade
    dataSurvivedUpgrade = $dataSurvivedUpgrade
    uninstall = "verified"
    loginRegistrationAfterUninstall = "removed"
    backgroundServiceAfterUninstall = "stopped"
    installedProcessesAfterUninstall = "removed"
    executableAfterUninstall = "removed"
    userDataAfterUninstall = "retained"
  }
  $evidence | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $resolvedEvidence -Encoding utf8NoBOM
  Get-Content -LiteralPath $resolvedEvidence -Raw | ConvertFrom-Json | Out-Null
  Write-Host "Verified signed MSI install, login startup, stop, $($baseline.available ? 'upgrade, ' : '')data continuity and clean uninstall."
}
finally {
  if ($backgroundProcess -and -not $backgroundProcess.HasExited) {
    & taskkill.exe /PID $backgroundProcess.Id /T /F | Out-Null
  }
  if ($installedMsi) {
    try { Invoke-Msi -Operation uninstall -Path $installedMsi -LogPath $uninstallLog } catch { Write-Warning $_ }
  }
}
