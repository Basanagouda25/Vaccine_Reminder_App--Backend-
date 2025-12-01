const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Initialize the Firebase Admin SDK. This gives our code access to Firebase services.
admin.initializeApp();

/**
 * This is the Cloud Function that your Android app calls.
 * Its name, "sendPushNotification", MUST match the name in your Android code.
 *
 * It receives `parentId`, `title`, and `message` from your app.
 */
exports.sendPushNotification = functions.https.onCall(async (data, context) => {
  const parentId = data.parentId;
  const title = data.title;
  const message = data.message;

  // Log the data we received from the app for debugging purposes.
  // You can view these logs in the Firebase Console -> Functions -> Logs.
  console.log(`Function triggered for parentId: ${parentId} with title: "${title}"`);

  // --- Security Check (Optional but Recommended) ---
  // You might want to check if the user calling this function is a logged-in provider.
  // For now, we will skip this to keep it simple.

  if (!parentId || !title || !message) {
    // If any required data is missing, log an error and inform the app.
    console.error("Missing data: parentId, title, or message.");
    throw new functions.https.HttpsError(
      "invalid-argument",
      "The function must be called with 'parentId', 'title', and 'message' arguments."
    );
  }

  try {
    // --- Step 1: Get the Parent's FCM Token ---
    // We need to look up the parent in our database to find their device token.
    // This code assumes you have a collection in Firestore named "users".
    // The document ID in that collection should match the parentId.
    const userDoc = await admin.firestore().collection("users").doc(String(parentId)).get();

    if (!userDoc.exists) {
      console.error(`No user found with parentId: ${parentId}`);
      throw new functions.https.HttpsError("not-found", "User document not found.");
    }

    // Get the `fcmToken` field from the user's document.
    const fcmToken = userDoc.data().fcmToken;

    if (!fcmToken) {
      // If the user exists but has no token, we can't send a notification.
      console.error(`User ${parentId} does not have an fcmToken.`);
      throw new functions.https.HttpsError("failed-precondition", "FCM token is missing for this user.");
    }

    // --- Step 2: Construct the Notification Payload ---
    const payload = {
      notification: {
        title: title,
        body: message,
      },
      token: fcmToken, // This tells FCM which specific device to send to.
    };

    // --- Step 3: Send the Notification ---
    console.log(`Attempting to send notification to token: ${fcmToken}`);
    const response = await admin.messaging().send(payload);
    console.log("Successfully sent message:", response);

    // Return a success message back to the Android app.
    return { success: true, messageId: response };

  } catch (error) {
    // If any part of the process fails, log the detailed error and inform the app.
    console.error("Error sending notification:", error);
    throw new functions.https.HttpsError("internal", error.message, error);
  }
});
