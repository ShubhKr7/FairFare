import admin from "../firebaseAdmin.js";

// Single user
const sendService = async (token, title, body) => {
  const payload = {
    token,
    data: {
      title,
      body,
      // image: 'https://fairfare-beta.vercel.app/newIcon-192x192.png',
      url: 'https://fairfare-beta.vercel.app'
      // badge: 'http://localhost:5173/newIconV2-512x512.png',
    },
  };

  try {
    const res = await admin.messaging().send(payload);
    console.log("Notification sent successfully");
    console.log(res)
    return res;
  } catch (error) {
    console.log(error);
    console.error("Error sending notification:", error);
    throw error;
  }
};

// Multiple users
const sendToMultiple = async (tokens, title, body) => {
  if (!Array.isArray(tokens) || tokens.length === 0) {
    throw new Error("Tokens array must not be empty");
  }

  const payload = {
    data: {
      title,
      body,
      // image: 'https://fairfare-beta.vercel.app/newIcon-192x192.png',
      url: 'https://fairfare-beta.vercel.app'
      // badge: 'http://localhost:5173/newIconV2-512x512.png',
    },
    tokens, // ✅ multiple tokens go here
  };
  console.log("inside sendtomulitple");
  try {
    const res = await admin.messaging().sendEachForMulticast(payload);
    console.log(`Notifications sent: ${res.successCount} success, ${res.failureCount} failed`);
    if (res.responses.some(r => !r.success)) {
      console.log("Failed tokens:", res.responses.filter(r => !r.success));
    }
    return res;
  } catch (error) {
    console.log(error);
    console.error("Error sending notifications to multiple users:", error);
    throw error;
  }
};

export default { sendService, sendToMultiple };
