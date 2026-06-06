import { User, Group, Expense, Terms, FriendRequest, Notification } from "../models/schema.js";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import {
  sendOneNotification,
  sendMultipleNotifications,
} from "../controllers/Notifications.js";

import dotenv from "dotenv";
dotenv.config();

// Allowlist of trusted email providers
const allowedEmailDomains = new Set([
  // Google
  "gmail.com", "googlemail.com",
  // Microsoft
  "outlook.com", "hotmail.com", "live.com", "msn.com",
  // Yahoo
  "yahoo.com", "yahoo.co.in", "yahoo.co.uk", "ymail.com",
  // Apple
  "icloud.com", "me.com", "mac.com",
  // Proton
  "protonmail.com", "proton.me", "pm.me",
  // Others
  "aol.com", "zoho.com", "zohomail.in",
  "rediffmail.com",
  "mail.com", "email.com",
  "gmx.com", "gmx.net",
  // India-specific
  "yandex.com", "yandex.ru",
]);
import streamifier from "streamifier";
import cloudinary from "../config/cloudinary.js";
import { signAccessToken } from "../utils/jwt.js";
import { sendMail } from "../utils/mailService.js";

/**
 * Helper: upload buffer to Cloudinary
 */
const uploadFromBuffer = (buffer, folder = "profile_photos") =>
  new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        transformation: [{ width: 500, height: 500, crop: "fill" }],
      },
      (error, result) => (error ? reject(error) : resolve(result))
    );
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });

// Send OTP to email

const sendOtp = async (req, res) => {
  const { email, username } = req.body;
  console.log("send otp controller called");

  if (!email || !username)
    return res.status(400).json({ message: "Incomplete data received" });

  // Only allow trusted email providers
  const emailDomain = email.split("@")[1]?.toLowerCase();
  if (!emailDomain || !allowedEmailDomains.has(emailDomain)) {
    return res.status(400).json({ message: "Please use a genuine email provider (e.g., Gmail, Outlook, Yahoo)." });
  }

  const existingUser = await User.findOne({ email });
  const existingUsername = await User.findOne({ username });

  if (existingUsername) {
    return res.status(400).json({ message: "Username already taken" });
  }

  if (existingUser) {
    return res.status(410).json({ message: "Email already taken" });
  }

  const otp = Math.floor(100000 + Math.random() * 900000);
  const hashedOtp = await bcrypt.hash(String(otp), 10);

  try {
    // 🔥 Send email via our Next.js mail microservice
    await sendMail({
      to: email,
      subject: `Welcome Onboard ${username}`,
      html: `
        <h1>Hi ${username},</h1>
        <p>Your OTP for signup is:</p>
        <h2><strong>${otp}</strong></h2>
        <p>This code is valid for 5 minutes.</p>
        <p>Thanks, FairFare Team</p>
      `,
    });

    return res.status(200).json({
      message: "OTP sent to email",
      otp: hashedOtp, // you were already returning this (same output)
    });
  } catch (error) {
    console.error("Mail service error:", error);
    return res.status(500).json({ message: "Failed to send OTP email" });
  }
};

// Verify OTP and create user
const verifyOtp = async (req, res) => {
  let { otp, username, email, password, otpGenerated, referId } = req.body;
  username = username.trim();
  email = email.trim();
  password = password.trim();
  otp = otp.trim();
  otpGenerated = otpGenerated.trim();
  referId = referId != null ? referId.trim() : null;

  if (!otp || !email || !otpGenerated || !username || !password) {
    return res.status(400).json({ message: "Incomplete data received" });
  }

  const isOtpValid = await bcrypt.compare(otp, otpGenerated);
  if (!isOtpValid) {
    return res.status(400).json({ message: "Invalid OTP" });
  }

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        message: "User with this email already exists. Please login instead."
      });
    }

    // Check if username is already taken
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(409).json({
        message: "Username already taken. Please choose a different username."
      });
    }

    // Clean the password
    const cleanPassword = String(password).trim();

    // Clean the username
    const cleanUsername = String(username).trim();

    // Create user in MongoDB
    const newUser = await User.create({
      username: cleanUsername,
      email,
      password: cleanPassword, // schema middleware handles hashing
    });

    if (referId) {
      const referUser = await User.findById(referId);
      if (!referUser) {
        return res.status(400).json({ message: "Invalid referral ID" });
      }
      // Add new user to referer's friends list
      await User.updateOne(
        { _id: referId },
        { $push: { friends: { friend: newUser._id, balance: 0 } } }
      );

      await User.updateOne(
        { _id: newUser._id },
        { $push: { friends: { friend: referId, balance: 0 } } }
      );
    }

    // Automatically record agreement to all active legal documents
    const activeTerms = await Terms.find({ isActive: true });
    const legalAgreements = activeTerms.map(term => ({
      version: term.version,
      documentId: term._id,
      agreedAt: new Date(),
    }));

    if (legalAgreements.length > 0) {
      await User.findByIdAndUpdate(newUser._id, {
        $set: { legalAgreements }
      });
    }

    const token = signAccessToken(newUser._id);

    return res.status(200).json({ id: newUser._id, token });
  } catch (error) {
    console.error("Error during user creation:", error);
    return res
      .status(500)
      .json({ message: "Server error while creating user" });
  }
};

// User login
const userLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    // console.log("email and password ", email, password);

    if (!email || !password) {
      return res.status(400).json({ message: "Incomplete data received" });
    }

    // Find user and explicitly select the password field
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    const cleanPassword = String(password).trim();

    // Use the schema's comparePassword method
    const isPasswordValid = await user.comparePassword(cleanPassword);
    // console.log("Password comparison result: ", isPasswordValid);

    if (!isPasswordValid) {
      return res.status(400).json({
        message: "Password is not correct",
      });
    }

    // Remove password from user object before sending response
    const userWithoutPassword = { ...user.toObject() };
    delete userWithoutPassword.password;
    const token = signAccessToken(user._id);

    return res.status(200).json({
      message: "Access Granted",
      user: userWithoutPassword,
      token,
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      message: "Internal server error during login",
      error: error.message,
    });
  }
};

//Get all expenses for a user (cursor-based pagination + search + filters)
const getAllExpensesForUser = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const limit = Math.min(parseInt(req.query.limit || "20", 10), 50);
    const cursor = req.query.cursor ? new Date(req.query.cursor) : null;
    const search = req.query.search ? req.query.search.trim() : "";
    const filter = req.query.filter || ""; // "personal" or ""
    const groupIds = req.query.groupIds ? req.query.groupIds.split(",").filter(Boolean) : [];

    const baseFilter = {
      $or: [{ paidBy: userId }, { "owedBy.user": userId }],
    };

    // Filter: personal expenses only (no owedBy entries)
    if (filter === "personal") {
      baseFilter.owedBy = { $size: 0 };
      baseFilter.$or = [{ paidBy: userId }];
    }

    // Filter: specific groups/trips
    if (groupIds.length > 0) {
      baseFilter.group = { $in: groupIds };
    }

    // Add search filter if provided
    if (search) {
      const searchRegex = new RegExp(search, "i");
      baseFilter.$and = [
        { $or: [{ title: searchRegex }, { category: searchRegex }] },
      ];
    }

    const query = { ...baseFilter };
    if (cursor) query.createdAt = { $lt: cursor };

    // Count total only on the first request (no cursor)
    const totalCountPromise = !cursor
      ? Expense.countDocuments(baseFilter)
      : Promise.resolve(undefined);

    const [expenses, totalCount] = await Promise.all([
      Expense.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate({ path: "paidBy", select: "username" })
        .populate({ path: "owedBy.user", select: "username" })
        .populate({ path: "group", select: "name" })
        .lean(),
      totalCountPromise,
    ]);

    const nextCursor = expenses.length === limit ? expenses[expenses.length - 1].createdAt : null;

    const response = {
      expenses,
      nextCursor
    };
    if (totalCount !== undefined) response.totalCount = totalCount;

    res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching expenses:", error);
    res.status(500).json({ message: "Server error" });
  }
};

//Get top categories for a user
const getTopCategoriesForUser = async (req, res) => {
  try {
    const { userId, startDate, endDate } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Base match condition
    const matchConditions = { "owedBy.user": userObjectId };

    // Add date filter if provided
    if (startDate || endDate) {
      matchConditions.createdAt = {};
      if (startDate) matchConditions.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const adjustedEnd = new Date(endDate);
        adjustedEnd.setHours(23, 59, 59, 999);
        matchConditions.createdAt.$lte = adjustedEnd;
      }
    }

    const categories = await Expense.aggregate([
      // Match only expenses that include the user in owedBy
      { $match: matchConditions },

      // Unwind owedBy so each owedBy entry is treated separately
      { $unwind: "$owedBy" },

      // Match again to ensure we only include entries for this specific user
      { $match: { "owedBy.user": userObjectId } },

      // Group by category and sum the owedBy.amount
      {
        $group: {
          _id: "$category",
          total: { $sum: "$owedBy.amount" },
        },
      },

      { $sort: { total: -1 } },
      // { $limit: 4 } // you can uncomment this if you want only top 4
    ]);

    const formattedCategories = categories.map((cat) => ({
      name: cat._id,
      total: cat.total,
    }));

    res.status(200).json({ categories: formattedCategories });
  } catch (error) {
    console.error("Error fetching top categories:", error);
    res.status(500).json({ message: "Server error" });
  }
};

//Get subcategories for a user within a category
// const getSubCategoriesForUser = async (req, res) => {
//   try {
//     const { userId, category } = req.body;

//     if (!userId) {
//       return res.status(400).json({ message: "User ID is required" });
//     }

//     const userObjectId = new mongoose.Types.ObjectId(userId);

//     const subcategories = await Expense.aggregate([
//       {
//         $match: { "owedBy.user": userObjectId, ...(category && { category }) },
//       },
//       { $group: { _id: "$subcategory", total: { $sum: "$amount" } } },
//       { $sort: { total: -1 } },
//     ]);

//     const formattedSubcategories = subcategories.map((sub) => ({
//       name: sub._id,
//       total: sub.total,
//     }));

//     res.status(200).json({ subcategories: formattedSubcategories });
//   } catch (error) {
//     console.error("Error fetching subcategories:", error);
//     res.status(500).json({ message: "Server error" });
//   }
// };
const getSubCategoriesForUser = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { userId, category, startDate, endDate } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);

    const timeFilter = {};
    if (startDate && endDate) {
      timeFilter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    } else if (startDate) {
      timeFilter.createdAt = { $gte: new Date(startDate) };
    } else if (endDate) {
      timeFilter.createdAt = { $lte: new Date(endDate) };
    }

    let subcategories = [];
    await session.withTransaction(async () => {
      subcategories = await Expense.aggregate([
        {
          $match: {
            "owedBy.user": userObjectId,
            ...(category && { category }),
            ...timeFilter,
          },
        },
        { $unwind: "$owedBy" },
        { $match: { "owedBy.user": userObjectId } },
        {
          $group: {
            _id: "$subcategory",
            total: { $sum: "$owedBy.amount" },
          },
        },
        { $sort: { total: -1 } },
      ]).session(session);
    });

    const formattedSubcategories = subcategories.map((sub) => ({
      name: sub._id,
      total: sub.total,
    }));

    res.status(200).json({ subcategories: formattedSubcategories });
  } catch (error) {
    console.error("Error fetching subcategories:", error);
    res.status(500).json({ message: "Server error" });
  } finally {
    await session.endSession();
  }
};

//Get all expenses for a user in a specific subcategory
// const getAllExpensesForASubcategory = async (req, res) => {
//   try {
//     const { userId, category, subcategory } = req.body;

//     if (!userId || !category || !subcategory) {
//       return res.status(400).json({ message: "Incomplete data received" });
//     }

//     const userObjectId = new mongoose.Types.ObjectId(userId);

//     // Build the query
//     const query = {
//       "owedBy.user": userObjectId,
//       category: category,
//       subcategory: subcategory,
//     };

//     // Fetch expenses and sort by updatedAt descending
//     const expenses = await Expense.find(query)
//       .populate({ path: "paidBy", select: "username" })
//       .populate({ path: "owedBy.user", select: "username" })
//       .sort({ updatedAt: -1 });

//     res.status(200).json({ expenses });
//   } catch (error) {
//     console.error("Error fetching expenses:", error);
//     res.status(500).json({ message: "Server error" });
//   }
// };
const getAllExpensesForASubcategory = async (req, res) => {
  try {
    const { userId, category, subcategory, startDate, endDate } = req.body;

    if (!userId || !category || !subcategory) {
      return res.status(400).json({ message: "Incomplete data received" });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Build the query
    const query = {
      "owedBy.user": userObjectId,
      category,
      subcategory,
    };

    // Add date range filter if provided
    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    } else if (startDate) {
      query.createdAt = { $gte: new Date(startDate) };
    } else if (endDate) {
      query.createdAt = { $lte: new Date(endDate) };
    }

    // Fetch expenses and sort by updatedAt descending
    const expenses = await Expense.find(query)
      .populate({ path: "paidBy", select: "username" })
      .populate({ path: "owedBy.user", select: "username" })
      .populate({ path: "group", select: "name" })
      .sort({ updatedAt: -1 });

    res.status(200).json({ expenses });
  } catch (error) {
    console.error("Error fetching expenses:", error);
    res.status(500).json({ message: "Server error" });
  }
};

//Function to fetch user details
const userDetails = async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await User.findById(userId)
      .populate({
        path: "friends.friend",
        select: "username email upiId profilePhotoUrl", // optional: select only needed fields
      })
      .populate({
        path: "recentExpense",
        options: { sort: { createdAt: -1 } }, // 👈 only latest 3
        select: "title amount paidBy owedBy createdAt category subcategory",
        populate: [
          { path: "paidBy", select: "username email" },
          { path: "owedBy.user", select: "username email" },
          { path: "group", select: "name description" },
        ],
      })
      .populate({
        path: "groups",
        select:
          "name description tripTotal from to createdAt updatedAt members",
        options: { sort: { updatedAt: -1 }, limit: 3 }, // 👈 most recently updated groups first
      })
      .select({
        username: 1,
        email: 1,
        upiId: 1,
        aiChatUsage: 1,
        friends: 1,
        recentExpense: { $slice: -3 },
        requests: 1,
        fcmToken: 1,
        profilePhotoUrl: 1,
        gender: 1,
        updatedAt: 1,

      })
      .lean();
    // console.log(user.friends) // exclude sensitive fields
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    // console.log("User sent:",user);

    // Filter out null friends (where the friend document was deleted)
    if (user.friends) {
      user.friends = user.friends.filter(f => f.friend !== null);
    }

    res.status(200).json({ user: user });
  } catch (err) {
    console.error("Error fetching user details:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Public profile - no auth required
const publicUserDetails = async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId)
      .populate({
        path: "friends.friend",
        select: "username email profilePhotoUrl",
      })
      .select({
        username: 1,
        email: 1,
        profilePhotoUrl: 1,
        friends: 1,
      })
      .lean();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ user });
  } catch (err) {
    console.error("Error fetching public user details:", err);
    res.status(500).json({ message: "Server error" });
  }
};

const getFriendSuggestions = async (req, res) => {
  try {
    const userId = req.params.userId;
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "5", 10), 1), 20);
    const skip = (page - 1) * limit;

    const currentUser = await User.findById(userId)
      .select("friends")
      .populate({
        path: "friends.friend",
        select: "_id",
      })
      .lean();

    if (!currentUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const friendIds = new Set(
      (currentUser.friends || [])
        .map((friendEntry) => friendEntry.friend?._id?.toString())
        .filter(Boolean)
    );

    const recentCutoff = new Date();
    recentCutoff.setDate(recentCutoff.getDate() - 30);

    const suggestionsMap = new Map();

    if (friendIds.size > 0) {
      const friendsOfFriends = await User.find({
        _id: { $in: Array.from(friendIds) },
      })
        .select("friends")
        .populate({
          path: "friends.friend",
          select: "_id username profilePhotoUrl createdAt",
        })
        .lean();

      for (const friend of friendsOfFriends) {
        for (const friendEntry of friend.friends || []) {
          const candidate = friendEntry.friend;

          if (!candidate?._id) {
            continue;
          }

          const candidateId = candidate._id.toString();
          if (candidateId === String(userId) || friendIds.has(candidateId)) {
            continue;
          }

          const existingSuggestion = suggestionsMap.get(candidateId);
          if (existingSuggestion) {
            existingSuggestion.mutualFriends += 1;
            continue;
          }

          suggestionsMap.set(candidateId, {
            user: {
              _id: candidate._id,
              username: candidate.username,
              profilePhotoUrl: candidate.profilePhotoUrl || null,
              createdAt: candidate.createdAt,
            },
            mutualFriends: 1,
            recentlyJoined: candidate.createdAt
              ? new Date(candidate.createdAt) >= recentCutoff
              : false,
          });
        }
      }
    }

    const allSuggestions = Array.from(suggestionsMap.values()).sort((a, b) => {
      if (b.mutualFriends !== a.mutualFriends) {
        return b.mutualFriends - a.mutualFriends;
      }

      if (Number(b.recentlyJoined) !== Number(a.recentlyJoined)) {
        return Number(b.recentlyJoined) - Number(a.recentlyJoined);
      }

      return new Date(b.user.createdAt || 0) - new Date(a.user.createdAt || 0);
    });

    const paginatedSuggestions = allSuggestions.slice(skip, skip + limit);

    res.status(200).json({
      suggestions: paginatedSuggestions,
      pagination: {
        page,
        limit,
        totalSuggestions: allSuggestions.length,
        totalPages: allSuggestions.length === 0 ? 0 : Math.ceil(allSuggestions.length / limit),
        hasMore: page * limit < allSuggestions.length,
      },
    });
  } catch (err) {
    console.error("Error fetching friend suggestions:", err);
    res.status(500).json({ message: "Server error" });
  }
};

const setFcmToken = async (req, res) => {
  try {
    const { fcmToken, userId } = req.body;

    if (!fcmToken) {
      return res.status(400).json({ message: "FCM token is required" });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { fcmToken },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "FCM token set successfully", user });
  } catch (error) {
    console.error("Error setting FCM token:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const notifyFriend = async (req, res) => {
  const { friendId, userId } = req.body;
  const user = await User.findOne({ _id: userId });
  const friend = await User.findOne({ _id: friendId });

  let balance = 0;
  let found = false;

  for (const f of friend.friends) {
    // console.log(f);
    if (f.friend.toString() === userId.toString()) {
      found = true;
      if (f.balance < 0) {
        balance = f.balance;
        break;
      } else if (f.balance === 0) {
        return res.status(400).json({ message: "No balance to settle" });
      } else {
        return res.status(400).json({ message: "You owe your friend!" });
      }
    }
  }

  if (!found)
    return res.status(404).json({ message: "Friend not found in friend list" });

  // attempt push notification if token available
  let pushSent = false;
  if (friend.fcmToken) {
    const token = friend.fcmToken;
    const title = "Healthy Reminder";
    const body = `It's always good to settle your balances. You owe ${user.username
      } ₹${Math.abs(balance).toFixed(2)}.`;

    try {
      await sendOneNotification(token, title, body);
      pushSent = true;
    } catch (err) {
      console.error("Error sending FCM reminder:", err);
    }
  }

  // always log activity regardless of token
  try {
    await Notification.create({
      recipient: friend._id,
      sender: user._id,
      type: "payment_reminder",
      message: `Reminder to settle ₹${Math.abs(balance).toFixed(2)}`,
    });
  } catch (notifErr) {
    console.error("Error creating payment reminder activity:", notifErr);
  }

  // respond according to whether push was sent
  if (pushSent) {
    return res.status(200).json({ message: "Notification sent successfully!" });
  } else {
    return res.status(200).json({ message: "Activity logged (no FCM token)" });
  }
};

const removeFcmToken = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { fcmToken: null },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "FCM token removed successfully" });
  } catch (error) {
    console.error("Error removing FCM token:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Function to update user profile
const updateUserProfile = async (req, res) => {
  try {
    const userId = req.params.id;

    const { username, upiId, gender, avatarUrl } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const updateFields = { username, upiId, gender };

    // If a predefined avatar URL was sent, save it directly as profilePhotoUrl
    // This avoids uploading to Cloudinary for built-in avatars
    if (avatarUrl) {
      // Delete previous Cloudinary image if it exists
      const existingUser = await User.findById(userId);
      if (existingUser?.profilePhotoId) {
        try {
          await cloudinary.uploader.destroy(existingUser.profilePhotoId);
        } catch (err) {
          console.warn("Failed to delete previous Cloudinary image:", err.message);
        }
      }
      updateFields.profilePhotoUrl = avatarUrl;
      updateFields.profilePhotoId = null; // no Cloudinary asset for predefined avatars
    }

    const updatedUser = await User.findByIdAndUpdate(userId, updateFields, { new: true, select: "-password" });

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      message: "User profile updated successfully",
      user: updatedUser,
    });
  } catch (err) {
    console.error("Error updating user profile:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

//Adding the friends

const inviteFriend = async (req, res) => {
  const { email, userId } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Incomplete data received" });
  }

  try {
    const user = await User.findOne({ _id: userId });
    const emailExists = await User.findOne({ email });

    if (emailExists) { return res.status(403).json({ message: "email already exists." }); }

    if (!user || user.email === email) {
      return res.status(404).json({ message: "User not found" });
    }

    // Friend does not exist — send invitation email via our mail microservice
    // In your inviteFriend controller
    const encodedEmail = encodeURIComponent(email);
    const inviteLink = `https://fair-fare-phi.vercel.app/signup/${user._id}?email=${encodedEmail}`;

    try {
      await sendMail({
        to: email,
        subject: `Heartfelt invitation from ${user.username}`,
        text: `${user.username} has invited you to join Fair Fare. Join here: ${inviteLink}`,
        html: `
          <!DOCTYPE html>
          <html lang="en">
          <body style="margin: 0; padding: 0; background-color: #f6f9fc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f6f9fc; padding: 40px 0;">
              <tr>
                <td align="center">
                  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 500px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.04); border: 1px solid #eef2f6;">
                    <tr>
                      <td height="6" style="background: linear-gradient(90deg, #4f46e5 0%, #d946ef 100%);"></td>
                    </tr>
                    <tr>
                      <td align="center" style="padding: 32px 32px 16px 32px;">
                        <table border="0" cellpadding="0" cellspacing="0">
                          <tr>
                            <td align="center" style="background: linear-gradient(135deg, #4f46e5 0%, #d946ef 100%); border-radius: 12px; width: 44px; height: 44px; text-align: center; vertical-align: middle;">
                              <span style="font-size: 18px; font-weight: 800; color: #ffffff; display: block; line-height: 44px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">FF</span>
                            </td>
                            <td style="font-size: 20px; font-weight: 700; color: #1f2937; padding-left: 12px; letter-spacing: -0.5px;">
                              Fair Fare
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 20px 40px 32px 40px;">
                        <h1 style="font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 16px 0; text-align: center; line-height: 1.3;">
                          You've Been Invited!
                        </h1>
                        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px;">
                          <tr>
                            <td height="1" style="background-color: #e5e7eb;"></td>
                          </tr>
                        </table>
                        <p style="font-size: 15px; line-height: 1.6; color: #4b5563; margin: 0 0 24px 0;">
                          Hi there,
                        </p>
                        <p style="font-size: 15px; line-height: 1.6; color: #4b5563; margin: 0 0 24px 0;">
                          Your friend <strong style="color: #1f2937;">${user.username}</strong> has added you as a friend on the <strong>Fair Fare</strong> app and sent you an invitation to join.
                        </p>
                        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f9fafb; border-radius: 12px; border: 1px solid #f3f4f6; margin-bottom: 32px;">
                          <tr>
                            <td style="padding: 20px; text-align: center;">
                              <span style="font-size: 12px; font-weight: 600; color: #4f46e5; text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 8px;">
                                From ${user.username}
                              </span>
                              <span style="font-size: 14px; color: #374151; font-style: italic; display: block; line-height: 1.5;">
                                "Hey! I'm using Fair Fare to track and split our expenses smoothly. Join me so we can settle up easily!"
                              </span>
                            </td>
                          </tr>
                        </table>
                        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 28px;">
                          <tr>
                            <td align="center">
                              <a href="${inviteLink}" target="_blank" style="background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); color: #ffffff; text-decoration: none; padding: 14px 28px; font-size: 15px; font-weight: 600; border-radius: 10px; display: inline-block; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25); text-align: center;">
                                Accept Invitation &amp; Join
                              </a>
                            </td>
                          </tr>
                        </table>
                        <p style="font-size: 12px; line-height: 1.5; color: #9ca3af; text-align: center; margin: 0;">
                          If the button above doesn't work, copy and paste this link in your browser:<br>
                          <a href="${inviteLink}" style="color: #4f46e5; text-decoration: none; word-break: break-all;">${inviteLink}</a>
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td style="background-color: #f9fafb; padding: 24px 40px; text-align: center; border-top: 1px solid #f3f4f6;">
                        <p style="font-size: 12px; line-height: 1.5; color: #6b7280; margin: 0 0 6px 0;">
                          <strong>Fair Fare</strong> — The smart way to split bills and track expenses.
                        </p>
                        <p style="font-size: 11px; line-height: 1.5; color: #9ca3af; margin: 0;">
                          You received this because someone invited you to use Fair Fare. If you do not wish to create an account, you can safely ignore this email.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `,
      });
      // Optionally log or track successful invite sends
    } catch (err) {
      // Log the mail error but continue processing other friends
      console.error(`Failed to send invite email to ${friendEmail}:`, err);
    }
    return res.status(200).json({
      message: "Friends processed",
    });
  } catch (error) {
    console.error("Error in addFriends:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

// Friend Requests: send, list, approve, deny
const sendFriendRequest = async (req, res) => {
  try {
    const { fromUserId, toEmail, toUserId } = req.body;
    if (!fromUserId || (!toEmail && !toUserId)) {
      return res.status(400).json({ message: "Incomplete data received" });
    }

    const fromUser = await User.findById(fromUserId);
    if (!fromUser) {
      return res.status(404).json({ message: "Sender not found" });
    }

    // Normalize to arrays
    const emails = Array.isArray(toEmail) ? toEmail : toEmail ? [toEmail] : [];
    const userIds = Array.isArray(toUserId) ? toUserId : toUserId ? [toUserId] : [];

    const targets = [];
    const results = [];

    for (const email of emails) {
      const toUser = await User.findOne({ email });
      if (!toUser) {
        results.push({ email, status: "failed", reason: "User not found" });
        continue;
      }
      targets.push({ toUser, identifier: email });
    }

    for (const id of userIds) {
      const toUser = await User.findById(id);
      if (!toUser) {
        results.push({ userId: id, status: "failed", reason: "User not found" });
        continue;
      }
      targets.push({ toUser, identifier: toUser.email || id });
    }

    for (const target of targets) {
      const { toUser, identifier } = target;

      // Check friendship in both directions
      const userHasFriend = fromUser.friends?.some(
        (f) => String(f.friend) === String(toUser._id)
      );
      const otherHasFriend = toUser.friends?.some(
        (f) => String(f.friend) === String(fromUser._id)
      );

      if (userHasFriend || otherHasFriend) {
        results.push({
          identifier,
          status: "skipped",
          reason: "Already friends or partially friends",
        });
        continue;
      }

      // Skip if request already exists
      const existingRequest = await FriendRequest.findOne({
        from: fromUser._id,
        to: toUser._id,
      });

      if (existingRequest) {
        results.push({
          identifier,
          reason: `Request already sent to ${toUser.username}`,
        });
        continue;
      }

      // Checking if the to user has sent a request to the from user
      const existingRequest1 = await FriendRequest.findOne({
        to: fromUser._id,
        from: toUser._id,
      });

      if (existingRequest1) {
        results.push({
          identifier,
          reason: `You have a friend request from ${toUser.username}. Please respond to it.`,
        });
        continue;
      }

      // Create friend request
      const friendRequest = await FriendRequest.create({
        from: fromUser._id,
        to: toUser._id,
      });

      // Update user's requests count
      await User.updateOne({ _id: toUser._id }, { $inc: { requests: 1 } });

      // Send notification
      if (toUser.fcmToken) {
        await sendOneNotification(
          toUser.fcmToken,
          "New Friend Request",
          `${fromUser.username} sent you a friend request`
        );
      }

      // Create Activity notification
      try {
        await Notification.create({
          recipient: toUser._id,
          sender: fromUser._id,
          type: "friend_request",
          message: `sent you a friend request`,
          referenceId: friendRequest._id,
        });
      } catch (notifError) {
        console.error("Error creating activity notification:", notifError);
      }

      results.push({
        identifier,
        status: "success",
        reason: "Request sent to " + toUser.username,
      });
    }
    return res.status(200).json({
      results,
    });
  } catch (error) {
    console.error("Error sending friend request:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const listFriendRequests = async (req, res) => {
  try {
    const { userId } = req.params;

    // Get friend requests from the separate collection
    const friendRequests = await FriendRequest.find({
      to: userId,
    })
      .populate({
        path: "from",
        select: "username email",
      })
      .sort({ createdAt: -1 });

    return res.status(200).json(friendRequests);
  } catch (error) {
    console.error("Error listing friend requests:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const respondToFriendRequest = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { userId, fromUserId, action, requestId } = req.body;
    if (!userId || !fromUserId || !action) {
      return res.status(400).json({ message: "Incomplete data received" });
    }

    let resultAction = null;
    let senderUser = null;
    let acceptorUser = null;

    await session.withTransaction(async () => {
      const user = await User.findById(userId).session(session);
      const fromUser = await User.findById(fromUserId).session(session);

      if (!user || !fromUser) {
        throw new Error("User not found");
      }
      senderUser = fromUser;
      acceptorUser = user;

      let friendRequest;
      if (requestId) {
        friendRequest = await FriendRequest.findById(requestId).session(session);
      } else {
        friendRequest = await FriendRequest.findOne({
          from: fromUserId,
          to: userId,
        }).session(session);
      }

      if (!friendRequest) {
        throw new Error("Friend request not found");
      }

      // decrease request count
      await User.updateOne(
        { _id: userId },
        { $inc: { requests: -1 } },
        { session }
      );

      if (action === "approve") {
        await User.updateOne(
          { _id: userId, "friends.friend": { $ne: fromUserId } },
          { $push: { friends: { friend: fromUserId, balance: 0 } } },
          { session }
        );

        await User.updateOne(
          { _id: fromUserId, "friends.friend": { $ne: userId } },
          { $push: { friends: { friend: userId, balance: 0 } } },
          { session }
        );
      }

      await FriendRequest.deleteOne({ _id: friendRequest._id }, { session });
      resultAction = action;
    });

    if (resultAction === "approve" && senderUser?.fcmToken) {
      const title = "Friend Request Accepted";
      const acceptorName = acceptorUser?.username || "Someone";
      await sendOneNotification(senderUser.fcmToken, title, `${acceptorName} accepted your friend request`);
    }

    // Create Activity notification (regardless of FCM token)
    if (resultAction === "approve") {
      try {
        const acceptorName = acceptorUser?.username || "Someone";
        await Notification.create({
          recipient: senderUser._id,
          sender: acceptorUser._id,
          type: "friend_added",
          message: `accepted your friend request`,
        });
      } catch (notifError) {
        console.error("Error creating activity notification:", notifError);
      }
    }

    if (resultAction === "approve") {
      return res.status(200).json({ message: "Friend request approved" });
    } else {
      return res.status(200).json({ message: "Friend request denied" });
    }
  } catch (error) {
    console.error("Transaction failed:", error);
    return res
      .status(500)
      .json({ message: error.message || "Internal Server Error" });
  } finally {
    session.endSession();
  }
};

const updateFriendBalance = async (req, res) => {
  const { userEmail, friendEmail, amount, action, note } = req.body;

  if (!userEmail || !friendEmail || !amount || !action || !note) {
    return res.status(400).json({ message: "Incomplete data received" });
  }

  const value = parseFloat(amount);
  if (isNaN(value) || value <= 0) {
    return res
      .status(400)
      .json({ message: "Amount must be a positive number" });
  }

  const session = await mongoose.startSession();

  try {
    let savedExpense = null;
    let friendToNotify = null;
    let userToNotifyAs = null;
    let payer = null;
    let owedUser = null;

    await session.withTransaction(async () => {
      // Fetch both users
      const user = await User.findOne({ email: userEmail }).session(session);
      const friend = await User.findOne({ email: friendEmail }).session(session);

      if (!user || !friend) {
        throw new Error("User or friend not found");
      }

      const friendRecord = user.friends.find(
        (f) => f.friend.toString() === friend._id.toString()
      );

      if (
        friendRecord &&
        friendRecord.balance === 0 &&
        note === "Cleared Everything"
      ) {
        throw new Error("Balance already settled");
      }

      let userIncrement, friendIncrement;

      if (action === "paid") {
        userIncrement = value;
        friendIncrement = -value;
        payer = user;
        owedUser = friend;
      } else if (action === "received") {
        userIncrement = -value;
        friendIncrement = value;
        payer = friend;
        owedUser = user;
      } else {
        throw new Error("Invalid action type");
      }

      // Update the user's friend record
      await User.updateOne(
        { email: userEmail, "friends.friend": friend._id },
        { $inc: { "friends.$.balance": userIncrement } },
        { session }
      );

      // Update the friend's record
      await User.updateOne(
        { email: friendEmail, "friends.friend": user._id },
        { $inc: { "friends.$.balance": friendIncrement } },
        { session }
      );

      // Create expense document
      const expense = new Expense({
        title: note,
        amount: value,
        paidBy: payer._id,
        owedBy: [
          {
            user: owedUser._id,
            amount: value,
          },
        ],
      });
      await expense.save({ session });

      // Push expense to payer's recentExpense
      await User.updateOne(
        { _id: payer._id },
        { $push: { recentExpense: expense._id } },
        { session }
      );

      savedExpense = expense;
      friendToNotify = friend;
      userToNotifyAs = user;
    });

    // Send notifications AFTER commit
    if (friendToNotify?.fcmToken) {
      sendOneNotification(
        friendToNotify.fcmToken,
        "Balance Updated",
        `Your transaction with ${userToNotifyAs.username} has been updated.`
      );
    }

    // create activity entry
    try {
      await Notification.create({
        recipient: owedUser._id,
        sender: payer._id,
        type: "payment_received",
        message: `₹${value} received`,
        referenceId: savedExpense._id,
      });
    } catch (notifErr) {
      console.error("Error creating payment received activity:", notifErr);
    }

    return res.status(200).json({
      message: "Friend balance updated & expense added",
      expense: savedExpense,
    });
  } catch (error) {
    if (error.message === "User or friend not found") {
      return res.status(404).json({ message: error.message });
    }
    if (error.message === "Balance already settled" || error.message === "Invalid action type") {
      return res.status(400).json({ message: error.message });
    }
    console.error("Error updating friend balance:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  } finally {
    session.endSession();
  }
};

const removeFriend = async (req, res) => {
  const { friendId, userId } = req.body;

  if (!friendId || !userId) {
    return res.status(400).json({ message: "Friend ID and User ID are required." });
  }

  if (friendId === userId) {
    return res.status(400).json({ message: "Cannot remove yourself as a friend." });
  }

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      // Fetch both users within the transaction
      const user = await User.findById(userId).session(session);
      const friend = await User.findById(friendId).session(session);

      if (!user || !friend) {
        throw new Error("USER_NOT_FOUND");
      }

      // Check if they are actually friends
      const friendRecord = user.friends.find(
        (f) => f.friend.toString() === friendId.toString()
      );

      if (!friendRecord) {
        throw new Error("NOT_FRIENDS");
      }

      // Check if there's an unsettled balance
      if (friendRecord.balance !== 0) {
        throw new Error("UNSETTLED_BALANCE:" + friendRecord.balance);
      }

      // Remove friend from current user
      await User.findByIdAndUpdate(
        userId,
        { $pull: { friends: { friend: friendId } } },
        { session }
      );

      // Remove current user from friend's list
      await User.findByIdAndUpdate(
        friendId,
        { $pull: { friends: { friend: userId } } },
        { session }
      );
    });

    return res.status(200).json({ message: "Friend removed successfully." });
  } catch (error) {
    if (error.message === "USER_NOT_FOUND") {
      return res.status(404).json({ message: "User or friend not found." });
    }
    if (error.message === "NOT_FRIENDS") {
      return res.status(400).json({ message: "This user is not in your friends list." });
    }
    if (error.message.startsWith("UNSETTLED_BALANCE:")) {
      const balance = error.message.split(":")[1];
      return res.status(400).json({
        message: "Balance is not settled. Please settle the balance first before removing this friend.",
        balance: Number(balance),
      });
    }
    console.error("Error removing friend:", error);
    return res.status(500).json({ message: "Server error" });
  } finally {
    await session.endSession();
  }
};

const forgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Incomplete data" });
  }

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  // Generate OTP
  const otp = Math.floor(100000 + Math.random() * 900000);
  console.log("Password reset OTP generated:", otp);

  try {
    const hashedOtp = await bcrypt.hash(String(otp), 10);

    // 🔥 Send OTP email using our mail microservice
    await sendMail({
      to: email,
      subject: "Account Recovery - Fair Fare",
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <body style="margin: 0; padding: 0; background-color: #f6f9fc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f6f9fc; padding: 40px 0;">
            <tr>
              <td align="center">
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 500px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.04); border: 1px solid #eef2f6;">
                  <tr>
                    <td height="6" style="background: linear-gradient(90deg, #4f46e5 0%, #d946ef 100%);"></td>
                  </tr>
                  <tr>
                    <td align="center" style="padding: 32px 32px 16px 32px;">
                      <table border="0" cellpadding="0" cellspacing="0">
                        <tr>
                          <td align="center" style="background: linear-gradient(135deg, #4f46e5 0%, #d946ef 100%); border-radius: 12px; width: 44px; height: 44px; text-align: center; vertical-align: middle;">
                            <span style="font-size: 18px; font-weight: 800; color: #ffffff; display: block; line-height: 44px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">FF</span>
                          </td>
                          <td style="font-size: 20px; font-weight: 700; color: #1f2937; padding-left: 12px; letter-spacing: -0.5px;">
                            Fair Fare
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 20px 40px 32px 40px;">
                      <h1 style="font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 16px 0; text-align: center; line-height: 1.3;">
                        Password Reset Requested
                      </h1>
                      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px;">
                        <tr>
                          <td height="1" style="background-color: #e5e7eb;"></td>
                        </tr>
                      </table>
                      <p style="font-size: 15px; line-height: 1.6; color: #4b5563; margin: 0 0 24px 0;">
                        Hi ${user.username || "User"},
                      </p>
                      <p style="font-size: 15px; line-height: 1.6; color: #4b5563; margin: 0 0 24px 0;">
                        We received a request to recover your account on the <strong>Fair Fare</strong> app. Please use the following One-Time Password (OTP) to complete your password reset:
                      </p>
                      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f9fafb; border-radius: 12px; border: 1px solid #f3f4f6; margin-bottom: 24px;">
                        <tr>
                          <td style="padding: 24px; text-align: center;">
                            <span style="font-size: 12px; font-weight: 600; color: #4f46e5; text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 12px;">
                              Your OTP Code
                            </span>
                            <span style="font-size: 32px; font-weight: 800; color: #111827; letter-spacing: 6px; display: block; font-family: Courier, monospace;">
                              ${otp}
                            </span>
                          </td>
                        </tr>
                      </table>
                      <p style="font-size: 14px; line-height: 1.6; color: #4b5563; margin: 0 0 16px 0;">
                        This code is valid for <strong>5 minutes</strong>.
                      </p>
                      <p style="font-size: 13px; line-height: 1.6; color: #9ca3af; margin: 0;">
                        If you did not request this change, please ignore this email. Your password will remain secure and unchanged.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="background-color: #f9fafb; padding: 24px 40px; text-align: center; border-top: 1px solid #f3f4f6;">
                      <p style="font-size: 12px; line-height: 1.5; color: #6b7280; margin: 0 0 6px 0;">
                        <strong>Fair Fare</strong> — The smart way to split bills and track expenses.
                      </p>
                      <p style="font-size: 11px; line-height: 1.5; color: #9ca3af; margin: 0;">
                        This is an automated security notification regarding your account.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });

    console.log(`OTP email sent successfully to ${email}`);

    return res.status(200).json({
      message: "OTP sent to email",
      otp: hashedOtp,
    });
  } catch (error) {
    console.error("Failed to send password reset email:", error);
    return res.status(500).json({
      message: "Failed to send OTP email",
    });
  }
};

const verifyForgotPassword = async (req, res) => {
  const { otpGenerated, otp, email } = req.body;
  if (!otp || !otpGenerated)
    return res.status(400).json({ message: "incomplete data" });

  try {
    const isOtpValid = await bcrypt.compare(otp, otpGenerated);
    if (!isOtpValid) {
      return res.status(400).json({ message: "Invalid OTP" });
    }
    const user = await User.findOne({ email: email });
    const token = signAccessToken(user._id);
    return res.status(200).json({ user, token });
  } catch (error) {
    console.error("Error during user creation:", error);
    return res
      .status(500)
      .json({ message: "Server error while creating user" });
  }
};

const changePassword = async (req, res) => {
  const { userId, newPassword } = req.body;

  // Validate required fields
  if (!userId || !newPassword) {
    return res
      .status(400)
      .json({ message: "Please provide userId and newPassword." });
  }

  try {
    // Find the user. Note: If the password field is excluded by default,
    // you may use `.select("+password")` if needed for the pre-save hook.
    const user = await User.findById(userId).select("+password");
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const cleanPassword = String(newPassword).trim();

    // Use the schema's comparePassword method
    const isPasswordValid = await user.comparePassword(cleanPassword);
    // console.log("Password comparison result: ", isPasswordValid);

    if (isPasswordValid) {
      return res.status(400).json({
        message: "New password cannot be same as old password",
      });
    }

    // Set the new password. The pre-save middleware in your schema will hash it.
    user.password = newPassword;

    // Save the updated user document
    await user.save();

    res.status(200).json({ message: "Password changed successfully." });
  } catch (error) {
    console.error("Error changing password:", error);
    res
      .status(500)
      .json({ message: "Internal server error.", error: error.message });
  }
};

const getUpdatedFriendBalances = async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ message: "User ID is required" });
  }

  try {
    // Fetch the user by ID
    const user = await User.findById(userId).populate({
      path: "friends.friend",
      select: "username profilePhotoUrl",
    });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Create an array of friend balances in the desired format
    const updatedData = user.friends
      .filter((f) => f && f.friend) // remove null or broken entries
      .map((f) => ({
        friendId: f.friend._id, // friend ID
        balance: f.balance, // balance
        username: f.friend.username, // friend's username
        profilePhotoUrl: f.friend.profilePhotoUrl, // friend's profile photo URL
      }));

    // Send the updated data as response
    return res.status(200).json(updatedData);
  } catch (error) {
    console.error("Error fetching updated friend balances:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

function escapeRegex(text = "") {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const getUsernames = async (req, res) => {
  let { username } = req.query;
  // console.log("username recieved:",username);
  try {
    if (!username || typeof username !== "string") {
      return res.status(400).json({ message: "username query is required" });
    }

    username = username.trim();
    if (username.length === 0) {
      return res.status(400).json({ message: "username must not be empty" });
    }
    if (username.length > 50) {
      return res.status(400).json({ message: "username too long" });
    }

    // Escape regex-special characters to avoid ReDoS and unexpected regex behavior
    const safe = escapeRegex(username);

    // For prefix-match (recommended for index use): use ^safe
    // For substring match (less index-friendly): remove ^
    const usePrefixSearch = true;
    const pattern = usePrefixSearch ? `^${safe}` : safe;
    const regex = new RegExp(pattern, "i");

    // Query
    const results = await User.find(
      { username: regex },
      { username: 1, email: 1, profilePhotoUrl: 1 } // projection: return only username & email and _id
    )
      .limit(8)
      .lean();

    return res.json({ users: results });
  } catch (err) {
    console.error("searchUsers error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// const uploadProfilePhoto = async (req, res) => {
//   try {
//     const { id } = req.params;
//     // if (!req.user || req.user.id !== id) return res.status(403).json({ message: 'Forbidden' });
//     if (!req.file || !req.file.buffer)
//       return res.status(400).json({ message: "No file uploaded" });

//     const user = await User.findById(id);
//     if (!user) return res.status(404).json({ message: "User not found" });

//     // console.log("req", user);

//     // upload to Cloudinary
//     const result = await uploadFromBuffer(req.file.buffer);

//     // delete previous Cloudinary image if present
//     if (user.profilePhotoId) {
//       try {
//         await cloudinary.uploader.destroy(user.profilePhotoId);
//       } catch (err) {
//         console.warn(
//           "Failed to delete previous Cloudinary image:",
//           err.message
//         );
//       }
//     }

//     // Save URL + public_id to user document (fields: profilePhotoUrl, profilePhotoId)
//     user.profilePhotoUrl = result.secure_url;
//     user.profilePhotoId = result.public_id;
//     await user.save();

//     const publicUser = user.toObject();
//     delete publicUser.password;
//     res.status(200).json({ user: publicUser });
//   } catch (err) {
//     console.error("uploadProfilePhoto error:", err);
//     res.status(500).json({ message: "Server error", error: err.message });
//   }
// };

const uploadProfilePhoto = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file || !req.file.buffer)
      return res.status(400).json({ message: "No file uploaded" });

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Upload to Cloudinary
    const result = await uploadFromBuffer(req.file.buffer);

    // Delete previous Cloudinary image if it exists
    if (user.profilePhotoId) {
      try {
        await cloudinary.uploader.destroy(user.profilePhotoId);
      } catch (err) {
        console.warn(
          "Failed to delete previous Cloudinary image:",
          err.message
        );
      }
    }

    // Update user document directly
    const updatedUser = await User.findByIdAndUpdate(
      id,
      {
        profilePhotoUrl: result.secure_url,
        profilePhotoId: result.public_id,
      },
      { new: true, select: "-password" } // return updated doc and exclude password
    );

    res.status(200).json({ user: updatedUser });
  } catch (err) {
    console.error("uploadProfilePhoto error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

const getUserLastUpdatedAt = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({ lastUpdatedAt: user.updatedAt });
  } catch (err) {
    console.error("getUserLastUpdatedAt error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

const checkFriendRequestStatus = async (req, res) => {
  try {
    const { fromUserId, toUserId } = req.params;
    const request = await FriendRequest.findOne({
      from: fromUserId,
      to: toUserId,
    });
    return res.status(200).json({ pending: !!request });
  } catch (error) {
    console.error("Error checking friend request status:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const googleAuth = async (req, res) => {
  try {
    const { idToken, referId } = req.body;
    if (!idToken) {
      return res.status(400).json({ message: "Google ID token is required" });
    }

    const admin = (await import("../firebaseAdmin.js")).default;

    // Verify the Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { uid, email, name, picture } = decodedToken;

    let user = await User.findOne({ email });

    if (user) {
      // User exists, just log them in
      // If they were previously local, update auth provider and googleId if missing
      if (!user.googleId) {
        user.googleId = uid;
        user.authProvider = "google";
        if (picture && !user.profilePhotoUrl) {
          user.profilePhotoUrl = picture;
        }
        await user.save();
      }

      const userWithoutPassword = { ...user.toObject() };
      delete userWithoutPassword.password;
      const token = signAccessToken(user._id);

      return res.status(200).json({
        message: "Google login successful",
        user: userWithoutPassword,
        token,
        id: user._id, // Required by frontend to set cookies correctly
      });
    }

    // User doesn't exist, create a new one
    // Clean username (use email prefix if name is empty)
    let baseUsername = (name || email.split("@")[0]).trim();
    let uniqueUsername = baseUsername;
    let counter = 1;

    // Ensure unique username
    while (await User.findOne({ username: uniqueUsername })) {
      uniqueUsername = `${baseUsername}${counter}`;
      counter++;
    }

    // Generate a secure random password for Google-auth users
    const crypto = await import('crypto');
    const randomPassword = crypto.randomBytes(16).toString('hex');

    const newUser = await User.create({
      username: uniqueUsername,
      email,
      password: randomPassword,
      googleId: uid,
      authProvider: "google",
      profilePhotoUrl: picture || null,
    });

    if (referId) {
      const referUser = await User.findById(referId);
      if (referUser) {
        await User.updateOne(
          { _id: referId },
          { $push: { friends: { friend: newUser._id, balance: 0 } } }
        );
        await User.updateOne(
          { _id: newUser._id },
          { $push: { friends: { friend: referId, balance: 0 } } }
        );
      }
    }

    const userWithoutPassword = { ...newUser.toObject() };
    delete userWithoutPassword.password;
    const token = signAccessToken(newUser._id);

    return res.status(200).json({
      message: "Google signup successful",
      user: userWithoutPassword,
      token,
      id: newUser._id // return id for backwards compatibility if frontend expects it
    });
  } catch (error) {
    console.error("Google Auth Error:", error);
    return res.status(500).json({
      message: "Authentication failed",
      error: error.message,
    });
  }
};

export {
  sendOtp,
  userLogin,
  inviteFriend,
  verifyForgotPassword,
  forgotPassword,
  updateUserProfile,
  verifyOtp,
  removeFriend,
  userDetails,
  updateFriendBalance,
  changePassword,
  getUpdatedFriendBalances,
  setFcmToken,
  getUsernames,
  sendFriendRequest,
  listFriendRequests,
  respondToFriendRequest,
  getAllExpensesForUser,
  getTopCategoriesForUser,
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
};
