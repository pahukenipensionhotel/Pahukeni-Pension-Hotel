#!/usr/bin/env node
/*
  Firestore cleanup script (admin-only).

  Usage examples:
    # Dry-run showing top-level collections and counts
    node scripts/firestore-cleanup.cjs --serviceAccount "C:\path\to\sa.json" --list

    # Dry-run for specific collections
    node scripts/firestore-cleanup.cjs --serviceAccount "C:\path\to\sa.json" --collections "orders,menu_items" --dry

    # Apply deletion for specific collections (interactive confirmation)
    node scripts/firestore-cleanup.cjs --serviceAccount "C:\path\to\sa.json" --collections "orders,menu_items" --apply

    # Apply deletion without prompt (use with extreme caution)
    node scripts/firestore-cleanup.cjs --serviceAccount "C:\path\to\sa.json" --collections "orders,menu_items" --apply --confirm yes

  Notes:
    - The script is destructive. Always run with --dry first to preview what will be deleted.
    - By default the script will NOT delete the top-level `users` collection unless explicitly requested via --collections users and you pass --confirm yes.
    - You can pass --older-than YYYY-MM-DD to only target documents with a created_at (or createdAt) earlier than that date.
    - Use a service account JSON with Firestore access and set either:
        --serviceAccount <path>
        or environment variable SERVICE_ACCOUNT_PATH or GOOGLE_APPLICATION_CREDENTIALS
*/

const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const argv = require("minimist")(process.argv.slice(2));
const fs = require("fs");
const readline = require("readline");

async function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(question, (ans) => {
      rl.close();
      resolve(ans);
    }),
  );
}

function parseCsv(arg) {
  return arg
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseDate(arg) {
  if (!arg) return null;
  const d = new Date(arg);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

async function initAdmin() {
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
      projectId: serviceAccount.project_id || undefined,
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
}

function docCreatedAt(data) {
  if (!data) return null;
  const candidates = [
    "created_at",
    "createdAt",
    "created",
    "timestamp",
    "added_at",
  ];
  for (const c of candidates) {
    if (data[c]) return new Date(data[c]);
    // some stores may keep timestamps in nested objects
  }
  return null;
}

async function listTopLevelCollections(db) {
  const cols = await db.listCollections();
  return cols.map((c) => c.id);
}

async function sampleDocs(db, col, limit = 5) {
  const snap = await db.collection(col).limit(limit).get();
  return snap.docs.map((d) => ({ id: d.id, data: d.data() }));
}

async function countDocs(db, col, olderThanDate = null) {
  // Note: Counting by retrieving may be slow for very large collections.
  // Suitable for small-to-medium test databases.
  let q = db.collection(col);
  const snapshot = await q.get();
  if (!olderThanDate) return snapshot.size;
  let count = 0;
  snapshot.docs.forEach((d) => {
    const dcreated = docCreatedAt(d.data());
    if (dcreated && dcreated.getTime() < olderThanDate.getTime()) count++;
  });
  return count;
}

async function deleteCollection(db, col, opts) {
  const {
    batchSize = 500,
    dry = true,
    olderThanDate = null,
    preserveUsers = true,
  } = opts;

  if (preserveUsers && col === "users") {
    console.log(
      "Skipping users collection (preserveUsers=true). To delete users explicitly pass --collections users and --confirm yes",
    );
    return { deleted: 0, scanned: 0 };
  }

  let scanned = 0;
  let deleted = 0;
  let lastDoc = null;
  while (true) {
    let q = db.collection(col).orderBy("__name__").limit(batchSize);
    if (lastDoc) q = q.startAfter(lastDoc);
    const snap = await q.get();
    if (snap.empty) break;
    lastDoc = snap.docs[snap.docs.length - 1];
    scanned += snap.size;

    const toDelete = [];
    snap.docs.forEach((doc) => {
      const d = doc.data();
      if (olderThanDate) {
        const dcreated = docCreatedAt(d);
        if (!dcreated) return; // skip docs without created date
        if (dcreated.getTime() >= olderThanDate.getTime()) return; // skip newer
      }
      toDelete.push(doc.ref);
    });

    if (toDelete.length === 0) {
      // nothing in this page to delete
      if (snap.size < batchSize) break; // end
      continue;
    }

    if (dry) {
      deleted += toDelete.length; // report potential deletions
    } else {
      // commit in sub-batches of 500
      for (let i = 0; i < toDelete.length; i += 500) {
        const batch = db.batch();
        toDelete.slice(i, i + 500).forEach((ref) => batch.delete(ref));
        await batch.commit();
        deleted += Math.min(500, toDelete.length - i);
      }
    }

    // If we fetched fewer than batchSize and processed them, probably end
    if (snap.size < batchSize) break;
  }

  return { deleted, scanned };
}

(async function () {
  try {
    await initAdmin();
    const databaseId = argv.databaseId || argv.db;
    const db = databaseId ? getFirestore(databaseId) : getFirestore();

    const listFlag = !!argv.list;
    const dry = !!argv.dry || !argv.apply;
    const apply = !!argv.apply;
    const confirm = argv.confirm === "yes" || argv.confirm === "y";
    const preserveUsers = argv.preserveUsers !== "false";
    const batchSize = argv.batch ? parseInt(argv.batch, 10) : 500;
    const olderThanStr = argv["older-than"] || argv.olderThan || argv.older;
    const olderThanDate = parseDate(olderThanStr);

    // debug
    const projectId =
      admin.apps &&
      admin.apps[0] &&
      admin.apps[0].options &&
      admin.apps[0].options.projectId;
    console.log("Admin SDK projectId:", projectId);

    if (listFlag) {
      const cols = await listTopLevelCollections(db);
      console.log("Top-level collections:", cols.join(", "));
      process.exit(0);
    }

    let collections = [];
    if (argv.collections) collections = parseCsv(argv.collections || argv.c);
    if (collections.length === 0) {
      console.log("No --collections specified. Listing top-level collections:");
      const cols = await listTopLevelCollections(db);
      console.log(cols.join("\n"));
      console.log(
        '\nSpecify which collections to target with --collections "col1,col2"',
      );
      process.exit(0);
    }

    console.log("Collections target:", collections.join(", "));
    console.log("Dry run:", dry);
    if (olderThanDate) console.log("Older than:", olderThanDate.toISOString());
    console.log("Preserve users collection by default:", preserveUsers);

    // Gather stats
    const stats = {};
    for (const col of collections) {
      try {
        const count = await countDocs(db, col, olderThanDate);
        const sample = await sampleDocs(db, col, 5);
        stats[col] = { count, sample };
      } catch (err) {
        console.error(
          `Failed to inspect collection ${col}:`,
          err.message || err,
        );
        stats[col] = {
          count: null,
          sample: null,
          error: err.message || String(err),
        };
      }
    }

    console.log("\nCollection inspection results:");
    for (const [col, info] of Object.entries(stats)) {
      console.log(`- ${col}: count=${info.count}`);
      if (info.sample)
        console.log("  sample ids:", info.sample.map((s) => s.id).join(", "));
      if (info.error) console.log("  error:", info.error);
    }

    if (dry) {
      console.log("\nDry run completed. No documents were deleted.");
      process.exit(0);
    }

    // Apply deletion (interactive)
    if (!confirm) {
      const ans = await prompt(
        "\nThis will DELETE documents in the specified collections. Type YES to proceed: ",
      );
      if (ans.trim().toUpperCase() !== "YES") {
        console.log("Aborting. No changes made.");
        process.exit(0);
      }
    }

    for (const col of collections) {
      console.log(`\nProcessing collection ${col} ...`);
      try {
        const res = await deleteCollection(db, col, {
          batchSize,
          dry: false,
          olderThanDate,
          preserveUsers,
        });
        console.log(
          `Collection ${col}: scanned=${res.scanned}, deleted=${res.deleted}`,
        );
      } catch (err) {
        console.error(
          `Failed to delete collection ${col}:`,
          err.message || err,
        );
      }
    }

    console.log("\nCleanup complete.");
    process.exit(0);
  } catch (err) {
    console.error("Cleanup failed:", err);
    process.exit(1);
  }
})();
