import express from "express";
import {
  sendOtp,
  verifyOtp,
  userDetails,
  userLogin,
  inviteFriend,
  updateUserProfile,
  removeFriend,
  forgotPassword,
  verifyForgotPassword,
  updateFriendBalance,
  getUpdatedFriendBalances,
  changePassword,
  setFcmToken,
  getUsernames,
  sendFriendRequest,
  listFriendRequests,
  respondToFriendRequest,
  getTopCategoriesForUser,
  getAllExpensesForUser,
  getSubCategoriesForUser,
  getAllExpensesForASubcategory,
  removeFcmToken,
  notifyFriend,
  getFriendSuggestions,
  uploadProfilePhoto,
  getUserLastUpdatedAt,
  checkFriendRequestStatus,
  publicUserDetails,
  googleAuth,
  checkUsernameAvailability,
  getAiUsage,
} from "../controllers/user.js";
import upload from "../middleware/multer.js";
import { auth } from "../middleware/auth.js";
import { askFairFareAI } from "../controllers/ai.js";
const router = express.Router();

// Define routes

//POST routes
router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);
router.post("/login", userLogin);
router.post("/forgot-password", forgotPassword);
router.post("/verify-forgot-password", verifyForgotPassword);
router.post("/google-auth", googleAuth);
router.post("/invite", auth, inviteFriend);
router.post("/remove-friend", auth, removeFriend);
router.post("/friend-requests/send", auth, sendFriendRequest);
router.post("/friend-requests/respond", auth, respondToFriendRequest);
router.post("/update-friend-balance", auth, updateFriendBalance);
router.post("/change-password", changePassword);
router.post("/get-updated-friend-balances", auth, getUpdatedFriendBalances);
router.post("/set-fcm-token", setFcmToken);
router.post('/remove-fcm-token', removeFcmToken);
router.post("/all-expenses", auth, getAllExpensesForUser);
router.post("/top-categories", auth, getTopCategoriesForUser);
router.post("/subcategories", auth, getSubCategoriesForUser);
router.post("/expenses-by-subcategory", auth, getAllExpensesForASubcategory);
router.post("/notify", notifyFriend);
router.post("/ai", auth, askFairFareAI);

//PUT routes
router.put("/:id", auth, updateUserProfile);
router.put('/:id/photo', upload.single('profilePhoto'), uploadProfilePhoto);

//GET routes
router.get("/check-username/:username", checkUsernameAvailability);
router.get('/search', auth, getUsernames);
router.get("/friend-requests/:userId", auth, listFriendRequests);
router.get("/friend-request-status/:fromUserId/:toUserId", auth, checkFriendRequestStatus);
router.get("/last-updated-at/:id", auth, getUserLastUpdatedAt);
router.get("/ai-usage/:id", auth, getAiUsage);
router.get("/public/:id", publicUserDetails);
router.get("/friend-suggestions/:userId", auth, getFriendSuggestions);
router.get("/:id", auth, userDetails);

//DELETE routes
router.delete("/remove-friend", auth, removeFriend);

export default router;
