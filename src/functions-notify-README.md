notifyOnCreate Cloud Function (skeleton)

What this file is
- A portable TypeScript Cloud Function skeleton that triggers on Firestore document creation at /notifications/{notificationId}.
- It queries the devices collection to find FCM tokens for specific users (userId) or roles, and sends push notifications via the Firebase Admin SDK.

How to use
1. Create a Cloud Functions package (recommended path: ./functions)
2. Copy src/functions-notify-skeleton.ts into functions/src/index.ts
3. In functions/package.json add dependencies: firebase-admin, firebase-functions and a build script (tsc)
4. Run: cd functions && npm install && npm run build
5. Deploy: firebase deploy --only functions:notifyOnCreate

Notes
- The repo's `firestore.rules` already contains a `devices` collection rule that allows authenticated users to register their device tokens.
- For production, add robust error handling, logging, metrics, and token cleanup (remove invalid tokens when FCM returns errors).
- Role-based broadcasts chunk user lists to respect Firestore 'in' query limits.
