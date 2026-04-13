Param(
  [string]$ProjectId = "",
  [string]$ServiceAccount = "",
  [string]$TestUserUid = "",
  [string]$TestFcmToken = "",
  [string]$TestTopic = ""
)

$ErrorActionPreference = 'Stop'

Write-Host "Starting deploy_notify.ps1"

# Ensure Node/npm available
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error "Node not found. Install Node.js and retry."; exit 1
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Error "npm not found. Install Node.js/npm and retry."; exit 1
}
if (-not (Get-Command firebase -ErrorAction SilentlyContinue)) {
  Write-Host "firebase-tools not found. Installing globally...";
  npm install -g firebase-tools
}

# Build functions
Write-Host "Preparing functions package..."
if (-not (Test-Path .\functions\src\index.ts)) {
  Write-Error "functions\src\index.ts not found. Ensure the skeleton is copied into functions/src/index.ts"; exit 1
}

Push-Location .\functions
Write-Host "Installing function dependencies (this may take a minute)..."
npm install
Write-Host "Building functions..."
npm run build
if (-not (Test-Path .\lib\index.js)) { Write-Error "Build failed: lib\index.js not found"; Pop-Location; exit 1 }
Pop-Location

# Firebase login & project selection
if ([string]::IsNullOrWhiteSpace($ProjectId)) {
  Write-Host "No ProjectId provided. Running interactive login and project selection..."
  firebase login
  Write-Host "Select the Firebase project for this repo (interactive):"
  firebase use --add
} else {
  Write-Host "Logging in (interactive) and selecting project: $ProjectId"
  firebase login
  firebase use $ProjectId
}

# Deploy function
Write-Host "Deploying function: notifyOnCreate..."
$deployCmd = "firebase deploy --only functions:notifyOnCreate"
Invoke-Expression $deployCmd

Write-Host "Deployment finished. Tail logs with: firebase functions:log --only notifyOnCreate"

# Optional: create test device and notification docs using service account
if (-not [string]::IsNullOrWhiteSpace($ServiceAccount) -and -not [string]::IsNullOrWhiteSpace($TestUserUid) -and -not [string]::IsNullOrWhiteSpace($TestFcmToken)) {
  Write-Host "Creating test device and notification using helper script..."
  $scriptDir = Join-Path $PSScriptRoot 'functions\scripts'
  if (-not (Test-Path $scriptDir)) { New-Item -ItemType Directory -Force -Path $scriptDir | Out-Null }
  $helperPath = Join-Path $scriptDir 'create_test_docs.js'
  if (-not (Test-Path $helperPath)) {
    Write-Host "Writing helper script to $helperPath"
    @'
/*
Usage:
  node create_test_docs.js --serviceAccount "./sa.json" --projectId "my-project" --userUid "test-uid" --fcmToken "abc" [--topic "all"]
*/
const admin = require('firebase-admin');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

(async () => {
  const argv = yargs(hideBin(process.argv)).options({
    serviceAccount: { type: 'string', demandOption: true },
    projectId: { type: 'string', demandOption: true },
    userUid: { type: 'string', demandOption: true },
    fcmToken: { type: 'string', demandOption: true },
    topic: { type: 'string' }
  }).argv;

  const sa = require(require('path').resolve(argv.serviceAccount));
  admin.initializeApp({ credential: admin.credential.cert(sa), projectId: argv.projectId });
  const db = admin.firestore();

  // create device doc
  const devRef = db.collection('devices').doc();
  await devRef.set({
    owner: argv.userUid,
    token: argv.fcmToken,
    platform: 'web',
    role: 'Customer',
    created_at: new Date().toISOString()
  });
  console.log('Device doc created:', devRef.id);

  // create notification doc
  const notifRef = db.collection('notifications').doc();
  const notif = {
    title: 'Test Push',
    message: 'Hello from notifyOnCreate (test)',
    created_at: new Date().toISOString(),
    type: 'system'
  };
  notif.userId = argv.userUid;
  if (argv.topic) notif.topic = argv.topic;
  await notifRef.set(notif);
  console.log('Notification created:', notifRef.id);
  process.exit(0);
})();
'@ | Out-File -FilePath $helperPath -Encoding utf8
  }

  Push-Location .\functions
  npm install yargs
  Write-Host "Running helper to create test documents..."
  node .\scripts\create_test_docs.js --serviceAccount $ServiceAccount --projectId $ProjectId --userUid $TestUserUid --fcmToken $TestFcmToken --topic $TestTopic
  Pop-Location
  Write-Host "Test docs created. Check Function logs for FCM send activity."
}

Write-Host "deploy_notify.ps1 complete."