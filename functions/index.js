const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();

exports.sendEmailNotification = onCall(
  { secrets: ["SENDGRID_API_KEY"] },
  async (request) => {

    const { parentId, title, message } = request.data ?? request;

    if (!parentId || !title || !message) {
      throw new HttpsError(
        "invalid-argument",
        "parentId, title, and message are required"
      );
    }

    // 1️⃣ Fetch user by Firebase UID
    const userDoc = await admin
      .firestore()
      .collection("users")
      .doc(parentId)
      .get();

    if (!userDoc.exists) {
      throw new HttpsError("not-found", "User not found");
    }

    const { email, fcmToken } = userDoc.data();

    let emailSent = false;
    let pushSent = false;

    /* ================= EMAIL ================= */
    if (email) {
      const sgMail = require("@sendgrid/mail");
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);

      await sgMail.send({
        to: email,
        from: "aishwaryahammigi@gmail.com", // VERIFIED sender
        subject: title,
        text: message,
      });

      emailSent = true;
    }

    /* ================= FCM ================= */
    if (fcmToken) {
      await admin.messaging().send({
        token: fcmToken,
        notification: {
          title,
          body: message,
        },
      });

      pushSent = true;
    }

    return {
      success: true,
      emailSent,
      pushSent,
    };
  }
);
