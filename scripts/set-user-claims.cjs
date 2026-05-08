#!/usr/bin/env node
/*
  Usage: node set-user-claims.cjs --email user@example.com --role Waiter --staff
  Requires: either SERVICE_ACCOUNT_PATH or GOOGLE_APPLICATION_CREDENTIALS env var pointing to a service account JSON
  or pass --serviceAccount "C:\path\to\serviceAccountKey.json"
*/

const admin = require("firebase-admin");
const argv = require("minimist")(process.argv.slice(2));
const fs = require("fs");

async function main() {
  const serviceAccountPath =
    argv.serviceAccount ||
    process.env.SERVICE_ACCOUNT_PATH ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const databaseURL =
    argv.databaseURL ||
    process.env.FIREBASE_DATABASE_URL ||
    "https://ai-studio-applet-webapp-a6a81-default-rtdb.firebaseio.com";

  if (serviceAccountPath) {
    let serviceAccount;
    try {
      serviceAccount = require(serviceAccountPath);
    } catch (err) {
      try {
        const raw = fs.readFileSync(serviceAccountPath, "utf8");
        serviceAccount = JSON.parse(raw);
      } catch (e) {
        console.error(
          "Failed to read service account from",
          serviceAccountPath,
          e.message || e,
        );
        process.exit(1);
      }
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL,
    });
  } else {
    console.warn(
      "SERVICE_ACCOUNT_PATH / GOOGLE_APPLICATION_CREDENTIALS not set; falling back to Application Default Credentials.",
    );
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      databaseURL,
    });
  }

  try {
    let uid = argv.uid;
    if (!uid && argv.email) {
      const user = await admin.auth().getUserByEmail(argv.email);
      uid = user.uid;
    }

    if (!uid) {
      console.error("Provide --uid or --email");
      process.exit(1);
    }

    const claims = {};
    if (argv.staff) claims.staff = true;
    if (argv.role) claims.role = argv.role;

    if (Object.keys(claims).length === 0) {
      console.error("No claims specified. Use --staff and/or --role <Role>");
      process.exit(1);
    }

    await admin.auth().setCustomUserClaims(uid, claims);
    console.log(`Custom claims set for uid=${uid}:`, claims);
    process.exit(0);
  } catch (err) {
    console.error("Failed to set claims:", err);
    process.exit(1);
  }
}

main();
