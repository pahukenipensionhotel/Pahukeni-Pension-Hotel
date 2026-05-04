#!/usr/bin/env node
/*
  Usage: node set-user-claims.js --email user@example.com --role Waiter --staff
  Requires: GOOGLE_APPLICATION_CREDENTIALS env var pointing to a service account JSON
*/

const admin = require("firebase-admin");
const argv = require("minimist")(process.argv.slice(2));

async function main() {
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!keyPath) {
    console.error("Set GOOGLE_APPLICATION_CREDENTIALS to the service account JSON path.");
    process.exit(1);
  }

  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });

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
