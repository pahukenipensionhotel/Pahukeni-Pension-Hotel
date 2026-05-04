#!/usr/bin/env node
/*
  Admin migration script to ensure all `menu_items` documents conform to Firestore rules
  Usage:
    DRY RUN: node migrate-menu-items.js --dry
    APPLY:   node migrate-menu-items.js

  Requires: set GOOGLE_APPLICATION_CREDENTIALS to a service account JSON that has
  appropriate Firestore/admin privileges.
*/

const admin = require('firebase-admin');
const argv = require('minimist')(process.argv.slice(2));

async function main() {
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!keyPath) {
    console.error('Set GOOGLE_APPLICATION_CREDENTIALS to the service account JSON path.');
    process.exit(1);
  }

  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });

  const db = admin.firestore();
  const dryRun = !!argv.dry || !!argv.dryRun || argv._.includes('dry');

  console.log(`Starting menu_items migration (dryRun=${dryRun})...`);

  const snapshot = await db.collection('menu_items').get();
  console.log(`Found ${snapshot.size} menu items`);

  let changed = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const updates = {};
    // Ensure required fields and types per rules
    if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
      updates.name = data.name && String(data.name).trim().slice(0, 100) || 'Unnamed Item';
    }

    if (typeof data.price !== 'number' || Number.isNaN(data.price)) {
      updates.price = Number.isFinite(Number(data.price)) ? Number(data.price) : 0;
    }

    if (!data.category || typeof data.category !== 'string') {
      updates.category = data.category && String(data.category) || 'Uncategorized';
    }

    if (!data.type || (data.type !== 'Restaurant' && data.type !== 'Bar')) {
      // try to infer from doc or default to Restaurant
      updates.type = (data.type && String(data.type)) || 'Restaurant';
    }

    if (!data.status || (data.status !== 'Available' && data.status !== 'Out of Stock')) {
      updates.status = 'Available';
    }

    if (typeof data.costPrice !== 'number' || Number.isNaN(data.costPrice)) {
      updates.costPrice = Number.isFinite(Number(data.costPrice)) ? Number(data.costPrice) : 0;
    }

    if (typeof data.stock !== 'number' || Number.isNaN(data.stock)) {
      updates.stock = Number.isFinite(Number(data.stock)) ? Number(data.stock) : 0;
    }

    if (typeof data.minStock !== 'number' || Number.isNaN(data.minStock)) {
      updates.minStock = Number.isFinite(Number(data.minStock)) ? Number(data.minStock) : 0;
    }

    // sanitize imageUrl: keep null or string shorter than 1000
    if (data.imageUrl && typeof data.imageUrl !== 'string') {
      updates.imageUrl = null;
    } else if (typeof data.imageUrl === 'string' && data.imageUrl.length > 1000) {
      updates.imageUrl = data.imageUrl.slice(0, 1000);
    }

    // If there are updates, either print or apply
    if (Object.keys(updates).length > 0) {
      changed++;
      console.log(`Doc ${doc.id} needs updates:`, updates);
      if (!dryRun) {
        try {
          await db.collection('menu_items').doc(doc.id).set(updates, { merge: true });
          console.log(`  Applied updates to ${doc.id}`);
        } catch (err) {
          console.error(`  Failed to update ${doc.id}:`, err.message || err);
        }
      }
    }
  }

  console.log(`Migration complete. Documents modified: ${changed}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
