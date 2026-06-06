import { Group } from "../models/schema.js";
import { User } from "../models/schema.js";
import { Expense } from "../models/schema.js";
import { Notification } from "../models/schema.js";
import {
  sendOneNotification,
  sendMultipleNotifications,
} from "../controllers/Notifications.js";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cloudinary from "../config/cloudinary.js";
import streamifier from "streamifier";
dotenv.config();

/**
 * Helper: upload buffer to Cloudinary with banner transformation (Wide aspect ratio)
 */
const uploadBannerFromBuffer = (buffer, folder = "trip_banners") =>
  new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        transformation: [
          { width: 1200, height: 400, crop: "fill", gravity: "center" },
          { quality: "auto", fetch_format: "auto" }
        ],
      },
      (error, result) => (error ? reject(error) : resolve(result))
    );
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });

const createGroup = async (req, res) => {
  const { name, description, from, to, members } = req.body;

  try {
    // Step 1: Create the group
    const group = new Group({
      name,
      description,
      from,
      to,
      members, // Array of user ObjectIds
    });

    await group.save();

    // Step 2: Add group reference to each user
    await Promise.all(
      members.map(async (userId) => {
        await User.findByIdAndUpdate(
          userId,
          { $addToSet: { groups: group._id } },
          { new: true }
        );
      })
    );

    // Step 3: Ensure mutual friendship between all members
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const userA = members[i];
        const userB = members[j];

        // Add userB to userA's friends if not present
        await User.updateOne(
          { _id: userA, "friends.friend": { $ne: userB } },
          { $push: { friends: { friend: userB, balance: 0 } } }
        );

        // Add userA to userB's friends if not present
        await User.updateOne(
          { _id: userB, "friends.friend": { $ne: userA } },
          { $push: { friends: { friend: userA, balance: 0 } } }
        );
      }
    }

    res.status(201).json({
      message: "Group created and friendships updated successfully",
      group,
    });
  } catch (error) {
    console.error("Error creating group:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

//Function to Fetch all groups of a user
const getAllGroupsOfAUser = async (req, res) => {
  const userId = req.params.id;
  const showArchived = req.query.archived === "true";
  const limit = req.query.limit ? parseInt(req.query.limit, 10) : null;
  try {
    const groups = await Group.find({ members: userId });
    // Filter: archived = in hiddenBy, active = not in hiddenBy
    let filtered = groups.filter((g) => {
      const isHidden = g.hiddenBy?.some((id) => id.toString() === userId);
      return showArchived ? isHidden : !isHidden;
    });
    // Sort by most recently updated, then apply optional limit
    filtered.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    if (limit) filtered = filtered.slice(0, limit);
    res.status(200).json(filtered);
  } catch (error) {
    console.error("Error fetching groups:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};


const addMembers = async (req, res) => {
  const groupId = req.params.id;
  const { members } = req.body; // members = array of user._id

  if (!groupId || !Array.isArray(members)) {
    return res.status(400).json({ message: "Invalid input" });
  }

  try {
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    const existingMemberIds = group.members.map((id) => id.toString());
    const newMembers = members.filter((id) => !existingMemberIds.includes(id)); // ✅ only new users
    const allMembers = [
      ...new Set([...existingMemberIds, ...members.map((id) => id.toString())]),
    ];

    // Step 1: Add new members to the group
    for (const userId of members) {
      if (!existingMemberIds.includes(userId)) {
        group.members.push(userId);
      }

      // Add group to user's groups list
      const user = await User.findById(userId);
      if (user && !user.groups.includes(group._id)) {
        await User.updateOne(
          { _id: userId },
          { $addToSet: { groups: group._id } }
        );
      }
    }

    // Step 2: Ensure all group members are mutual friends
    for (let i = 0; i < allMembers.length; i++) {
      for (let j = i + 1; j < allMembers.length; j++) {
        const userA = allMembers[i];
        const userB = allMembers[j];

        await User.updateOne(
          { _id: userA, "friends.friend": { $ne: userB } },
          { $push: { friends: { friend: userB, balance: 0 } } }
        );

        await User.updateOne(
          { _id: userB, "friends.friend": { $ne: userA } },
          { $push: { friends: { friend: userA, balance: 0 } } }
        );
      }
    }

    await group.save();

    // Step 3: 🔔 Notify newly added members and create activity entries
    if (newMembers.length > 0) {
      const users = await User.find(
        { _id: { $in: newMembers } },
        "fcmToken username"
      );

      // Collect all valid tokens
      const tokens = users.map((u) => u.fcmToken).filter(Boolean);

      if (tokens.length > 0) {
        const title = "Added to a Group";
        const body = `You have been added to the group "${group.name}".`;
        await sendMultipleNotifications(tokens, title, body); // ✅ send in one request
      }

      // Activity notifications
      const adderUserId = req.user?.id;
      for (const user of users) {
        try {
          await Notification.create({
            recipient: user._id,
            sender: adderUserId,
            type: "group_invite",
            message: `You were added to the group "${group.name}"`,
            referenceId: group._id,
          });
        } catch (notifErr) {
          console.error("Error creating activity notification for group invite:", notifErr);
        }
      }
    }

    const updatedGroup = await Group.findById(groupId)
      .populate("members")
      .populate("expenses");
    res.status(200).json(updatedGroup);
  } catch (err) {
    console.error("Add Members Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

const removeMembers = async (req, res) => {
  const groupId = req.params.id;
  const { members } = req.body; // members = array of user._id
  // console.log("Removing members from group:", groupId, "Members:", members);

  if (!groupId || !Array.isArray(members)) {
    return res.status(400).json({ message: "Invalid input" });
  }

  try {
    const group = await Group.findById(groupId).populate(
      "members",
      "username email groups"
    );

    if (!group) return res.status(404).json({ message: "Group not found" });

    // Step 1: Remove members from the group
    group.members = group.members.filter(
      (member) => !members.includes(member._id.toString())
    );
    await group.save();

    // Step 2: Remove group reference from each removed user
    await User.updateMany(
      { _id: { $in: members } },
      { $pull: { groups: groupId } }
    );

    // Step 3: 🔔 Notify removed members
    const removedUsers = await User.find(
      { _id: { $in: members } },
      "fcmToken username"
    );
    // Collect all valid tokens
    const tokens = removedUsers.map((u) => u.fcmToken).filter(Boolean);

    if (tokens.length > 0) {
      const title = "Removed from Group";
      const body = `You have been removed from the group "${group.name}".`;
      await sendMultipleNotifications(tokens, title, body); // ✅ one request to FCM
    }

    // ✅ Return updated group
    const updatedGroup = await Group.findById(groupId)
      .populate("members", "username")
      .populate("expenses");
    return res.status(200).json(updatedGroup);
  } catch (err) {
    console.error("Remove Members Error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

const getGroupDetails = async (req, res) => {
  try {
    const groupId = req.params.id;

    const group = await Group.findById(groupId)
      .select("name description members hiddenBy createdAt updatedAt bannerUrl from to")
      .populate("members", "username")
      .lean();

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    res.status(200).json(group);
  } catch (error) {
    console.error("getGroupMeta error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const getGroupExpenses = async (req, res) => {
  try {
    const groupId = req.params.id;
    const limit = Math.min(parseInt(req.query.limit || "20", 10), 50);
    const cursor = req.query.cursor ? new Date(req.query.cursor) : null;

    const query = { group: groupId };
    if (cursor) query.createdAt = { $lt: cursor };

    const expenses = await Expense.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .select("title amount createdAt category subcategory paidBy owedBy")
      .populate("paidBy", "username")
      .populate("owedBy.user", "username")
      .lean();

    const hasMore = expenses.length === limit;
    const nextCursor = hasMore ? expenses[expenses.length - 1].createdAt : null;

    res.status(200).json({ expenses, nextCursor });
  } catch (error) {
    console.error("getGroupExpenses error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * addExpenseController
 *
 * This controller:
 * - Creates a new Expense document.
 * - Depending on the split mode, calculates the owedBy details.
 * - Pushes the entire expense document (as an embedded subdocument) into:
 *    - the Group's expenses array (if a group is specified),
 *    - the payer User’s recentExpense field.
 * - Updates friend balances based on the shared expense.
 *
 * Expected req.body:
 * {
 *   title: String,
 *   amount: Number, // total expense amount
 *   paidBy: String, // payer's user _id
 *   groupId: String, // optional if expense belongs to a group
 *   splitMode: 'equally' | 'unequally',
 *   involvedMembers: Array of user _ids,  // for the expense splitting (owedBy)
 *   customAmounts: { [userId]: Number }    // provided only if splitMode === 'unequally'
 * }
 */
const addExpenseController = async (req, res) => {
  const {
    title,
    amount, // e.g., "300"
    paidBy, // payer's user _id
    groupId, // group _id if applicable (or null)
    splitMode, // either "equally" or "unequally"
    involvedMembers, // array of user _ids who are part of the expense splitting
    customAmounts, // object mapping user _id to amount (for uneven splits)
  } = req.body;

  // Basic validation
  if (
    !title ||
    !amount ||
    !paidBy ||
    !involvedMembers ||
    !Array.isArray(involvedMembers) ||
    involvedMembers.length === 0
  ) {
    return res
      .status(400)
      .json({ success: false, message: "Missing required fields" });
  }

  const totalEntered = parseFloat(amount);
  if (totalEntered > 500000) {
    return res
      .status(400)
      .json({ success: false, message: "Amount cannot exceed 5,00,000" });
  }

  if (involvedMembers.length === 1 && involvedMembers[0] === paidBy) {
    return res.status(400).json({
      success: false,
      message: "Cannot split expense with only the payer involved.",
    });
  }

  // Get payer's friends list
  const payer = await User.findById(paidBy).select("friends username");
  if (!payer) {
    return res.status(404).json({ success: false, message: "Payer not found" });
  }

  const friendIds = payer.friends.map((f) => f.friend.toString());

  // Find all non-friends from involvedMembers (skip self)
  const notFriends = involvedMembers.filter(
    (memberId) =>
      memberId.toString() !== paidBy.toString() && // ✅ skip self
      !friendIds.includes(memberId.toString())
  );

  // console.log("Not friends with:", notFriends);

  if (notFriends.length > 0) {
    // Fetch names of non-friends
    const nonFriendUsers = await User.find({ _id: { $in: notFriends } }).select(
      "username"
    );

    const nonFriendNames = nonFriendUsers.map((u) => u.username);

    return res.status(400).json({
      success: false,
      message: `Cannot add expense since ${payer.username
        } is not friends with ${nonFriendNames.join(", ")}`,
    });
  }

  // Start a transaction session
  const session = await mongoose.startSession();

  try {
    let savedExpense = null;

    await session.withTransaction(async () => {
      // Build the owedBy array for the expense document
      let owedByArray = [];

      if (splitMode === "equally") {
        const share = parseFloat(amount) / involvedMembers.length;
        owedByArray = involvedMembers.map((memberId) => ({
          user: memberId,
          amount: parseFloat(share.toFixed(2)),
        }));
      } else if (splitMode === "unequally") {
        const totalCustom = Object.values(customAmounts).reduce(
          (sum, val) => sum + parseFloat(val || 0),
          0
        );

        if (
          parseFloat(totalCustom.toFixed(2)) !==
          parseFloat(parseFloat(amount).toFixed(2))
        ) {
          throw new Error(
            "Total of custom amounts does not match the expense amount."
          );
        }

        owedByArray = involvedMembers.map((memberId) => ({
          user: memberId,
          amount: parseFloat(parseFloat(customAmounts[memberId]).toFixed(2)),
        }));
      } else {
        throw new Error("Invalid split mode provided.");
      }

      // Create a new Expense document
      const newExpense = new Expense({
        title,
        amount: parseFloat(amount),
        paidBy,
        owedBy: owedByArray,
        group: groupId || null,
      });

      // Save the new expense within the transaction
      await newExpense.save({ session });

      if (groupId) {
        await Group.findByIdAndUpdate(
          groupId,
          {
            $push: { expenses: newExpense._id },
            $inc: { tripTotal: newExpense.amount },
          },
          { session }
        );
      }

      await User.findByIdAndUpdate(
        paidBy,
        { $push: { recentExpense: newExpense._id } },
        { session }
      );

      // Update friend balances
      for (const owed of owedByArray) {
        if (owed.user.toString() === paidBy.toString()) continue;

        await User.updateOne(
          { _id: paidBy, "friends.friend": owed.user },
          { $inc: { "friends.$.balance": owed.amount } },
          { session }
        );

        await User.updateOne(
          { _id: owed.user, "friends.friend": paidBy },
          { $inc: { "friends.$.balance": -owed.amount } },
          { session }
        );
      }
      savedExpense = newExpense;
    });

    // Send Notification AFTER transaction commit
    if (savedExpense) {
      const userIds = savedExpense.owedBy.map((owed) => owed.user);
      if (!userIds.some(id => id.toString() === paidBy.toString())) {
        userIds.push(paidBy);
      }

      const users = await User.find(
        { _id: { $in: userIds } },
        "fcmToken username"
      );

      const tokens = users.map((u) => u.fcmToken).filter(Boolean);

      if (tokens.length > 0) {
        const payerUser = users.find((u) => u._id.toString() === paidBy.toString());
        const notificationTitle = "Tap to see";
        const body = `${savedExpense.title} expense has been paid by ${payerUser?.username || "Someone"
          }. \nAmount: ${savedExpense.amount}`;

        await sendMultipleNotifications(tokens, notificationTitle, body);
      }

      // Create Activity notifications for each user owing money
      const payerUsername = users.find((u) => u._id.toString() === paidBy.toString())?.username || "Someone";
      const groupName = savedExpense.group ? (await Group.findById(savedExpense.group).select("name"))?.name : null;
      
      for (const owed of savedExpense.owedBy) {
        if (owed.user.toString() === paidBy.toString()) continue; // Don't notify the payer about themselves
        
        const message = groupName
          ? `You were added to "${savedExpense.title}" in ${groupName}`
          : `You were added to "${savedExpense.title}"`;
        const notifType = groupName ? "group_expense_added" : "expense_added";
        try {
          await Notification.create({
            recipient: owed.user,
            sender: paidBy,
            type: notifType,
            message,
            referenceId: savedExpense._id,
          });
        } catch (notifError) {
          console.error("Error creating activity notification:", notifError);
        }
      }
    }

    return res.status(200).json({ success: true, expense: savedExpense });
  } catch (error) {
    console.error("Error in addExpenseController:", error);
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    session.endSession();
  }
};

const getUserTrips = async (req, res) => {
  const { userId } = req.params; // Expecting URL like /api/user/:userId/trips
  try {
    // Find the user and populate their groups (trips) along with members.
    const user = await User.findById(userId).populate({
      path: "groups",
      populate: {
        path: "members", // Populate the members in each group.
        select: "username email", // Only retrieve username and email.
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Sort the groups (trips) in descending order (newest first) based on createdAt.
    const sortedTrips = user.groups.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    // Return the sorted trips information.
    return res.status(200).json({ trips: sortedTrips });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getRecentExpenses = async (req, res) => {
  const { userId } = req.params; // Expecting URL like /api/user/:userId/recent-expenses
  try {
    // Find the user and populate the recentExpense field.
    const user = await User.findById(userId).populate({
      path: "recentExpense",
      populate: [
        {
          path: "paidBy",
          select: "username email",
        },
        {
          path: "owedBy.user",
          select: "username email",
        },
        {
          path: "group",
          select: "name description",
        },
      ],
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Sort the recent expenses by createdAt in descending order.
    const sortedExpenses = user.recentExpense.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
    // Return the sorted recent expenses.
    return res.status(200).json({ recentExpenses: sortedExpenses });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const addafterDeleteExpenseController = async (req, res) => {
  const {
    title,
    amount, // e.g., "300"
    paidBy, // payer's user _id
    groupId, // group _id if applicable (or null)
    splitMode, // either "equally" or "unequally"
    involvedMembers, // array of user _ids who are part of the expense splitting
    customAmounts, // object mapping user _id to amount (for uneven splits)
    createdAt: clientCreatedAt, // optionally provided by client to preserve original timestamp
    action, // optionally "edit" when updating existing expense
  } = req.body;

  // Basic validation
  if (
    !title ||
    !amount ||
    !paidBy ||
    !involvedMembers ||
    !Array.isArray(involvedMembers) ||
    involvedMembers.length === 0
  ) {
    return res
      .status(400)
      .json({ success: false, message: "Missing required fields" });
  }

  const totalEntered = parseFloat(amount);
  if (totalEntered > 500000) {
    return res
      .status(400)
      .json({ success: false, message: "Amount cannot exceed 5,00,000" });
  }

  const session = await mongoose.startSession();

  try {
    let savedExpense = null;

    await session.withTransaction(async () => {
      // Build owedBy array
      let owedByArray = [];
      if (splitMode === "equally") {
        const share = parseFloat(amount) / involvedMembers.length;
        owedByArray = involvedMembers.map((memberId) => ({
          user: memberId,
          amount: parseFloat(share.toFixed(2)),
        }));
      } else if (splitMode === "unequally") {
        const totalCustom = Object.values(customAmounts).reduce(
          (sum, val) => sum + parseFloat(val || 0),
          0
        );

        if (
          parseFloat(totalCustom.toFixed(2)) !==
          parseFloat(parseFloat(amount).toFixed(2))
        ) {
          throw new Error(
            "Total of custom amounts does not match the expense amount."
          );
        }

        owedByArray = involvedMembers.map((memberId) => ({
          user: memberId,
          amount: parseFloat(parseFloat(customAmounts[memberId]).toFixed(2)),
        }));
      } else {
        throw new Error("Invalid split mode provided.");
      }

      // Create new Expense
      const expenseData = {
        title,
        amount: parseFloat(amount),
        paidBy,
        owedBy: owedByArray,
        group: groupId || null,
      };
      if (clientCreatedAt) {
        expenseData.createdAt = new Date(clientCreatedAt);
      }

      const newExpense = new Expense(expenseData);
      await newExpense.save({ session });

      if (groupId) {
        await Group.findByIdAndUpdate(
          groupId,
          {
            $push: { expenses: newExpense._id },
            $inc: { tripTotal: newExpense.amount },
          },
          { session }
        );
      }

      await User.findByIdAndUpdate(
        paidBy,
        { $push: { recentExpense: newExpense._id } },
        { session, select: false }
      );

      for (const owed of owedByArray) {
        if (owed.user.toString() === paidBy.toString()) continue;
        await User.updateOne(
          { _id: paidBy, "friends.friend": owed.user },
          { $inc: { "friends.$.balance": owed.amount } },
          { session }
        );
        await User.updateOne(
          { _id: owed.user, "friends.friend": paidBy },
          { $inc: { "friends.$.balance": -owed.amount } },
          { session }
        );
      }
      savedExpense = newExpense;
    });

    // Send notifications AFTER commit
    if (savedExpense) {
      try {
        let notifyUsers = [];
        if (groupId) {
          const group = await Group.findById(groupId).populate(
            "members",
            "fcmToken username"
          );
          notifyUsers = group.members;
        } else {
          notifyUsers = await User.find(
            { _id: { $in: involvedMembers } },
            "fcmToken username"
          );
        }

        const tokens = notifyUsers.map((u) => u.fcmToken).filter(Boolean);
        if (tokens.length > 0) {
          const notificationBody = `Expense "${title}" has been updated for ₹${amount}.`;
          await sendMultipleNotifications(tokens, title, notificationBody);
        }

        // Create Activity notifications for each user owing money
        const payerUser = await User.findById(paidBy).select("username");
        const payerUsername = payerUser?.username || "Someone";
        const groupName = groupId ? (await Group.findById(groupId).select("name"))?.name : null;
        const isEdit = req.body.action === "edit";

        for (const owed of savedExpense.owedBy) {
          if (owed.user.toString() === paidBy.toString()) continue;
          
          const message = isEdit
            ? groupName
              ? `${payerUsername} edited the expense "${savedExpense.title}" in ${groupName}`
              : `${payerUsername} edited the expense "${savedExpense.title}"`
            : groupName
              ? `${payerUsername} added you to "${savedExpense.title}" in ${groupName}`
              : `${payerUsername} added you to "${savedExpense.title}"`;
          const notifType = isEdit
            ? "expense_edited"
            : groupName
              ? "group_expense_added"
              : "expense_added";
          try {
            await Notification.create({
              recipient: owed.user,
              sender: paidBy,
              type: notifType,
              message,
              referenceId: savedExpense._id,
            });
          } catch (notifError) {
            console.error("Error creating activity notification:", notifError);
          }
        }
      } catch (notifyErr) {
        console.error("Error sending expense edited notification:", notifyErr);
      }
    }

    return res.status(200).json({ success: true, expense: savedExpense });
  } catch (error) {
    console.error("Error in addafterDeleteExpenseController:", error);
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    session.endSession();
  }
};

// -----------------------------------------
// 2) deleteExpenseController
// -----------------------------------------
const deleteExpenseController = async (req, res) => {
  const { expenseId } = req.params;
  const { action } = req.body;

  const session = await mongoose.startSession();

  try {
    let deletedExpense = null;

    await session.withTransaction(async () => {
      // 1) Load the existing expense
      const expense = await Expense.findById(expenseId).session(session);
      if (!expense) {
        deletedExpense = null;
        return;
      }
      deletedExpense = expense.toObject();

      const { paidBy, owedBy, amount, group: groupId } = expense;

      // 2) Reverse each balance update
      for (const owed of owedBy) {
        const owedUserId = owed.user.toString();
        const payerId = paidBy.toString();
        const owedAmount = owed.amount;

        if (owedUserId === payerId) continue;

        await User.updateOne(
          { _id: paidBy, "friends.friend": owed.user },
          { $inc: { "friends.$.balance": -owedAmount } },
          { session }
        );
        await User.updateOne(
          { _id: owed.user, "friends.friend": paidBy },
          { $inc: { "friends.$.balance": owedAmount } },
          { session }
        );
      }

      // 3) Remove from payer's recentExpense
      await User.updateOne(
        { _id: paidBy },
        { $pull: { recentExpense: expenseId } },
        { session }
      );

      // 4) If part of a group, remove from Group.expenses and decrement tripTotal
      if (groupId) {
        await Group.updateOne(
          { _id: groupId },
          {
            $pull: { expenses: expenseId },
            $inc: { tripTotal: -amount },
          },
          { session }
        );
      }

      // 5) Delete the Expense document itself
      await Expense.deleteOne({ _id: expenseId }, { session });
    });

    if (!deletedExpense) {
      return res.status(404).json({ success: false, message: "Expense not found" });
    }

    // 6) 🔔 Notify group members AFTER commit and create activity entries
    if (deletedExpense.group) {
      const group = await Group.findById(deletedExpense.group).populate(
        "members",
        "fcmToken username"
      );
      if (group && group.members.length > 0) {
        const tokens = group.members.map((m) => m.fcmToken).filter(Boolean);
        if (tokens.length > 0) {
          const title = action === "edit" ? "Expense Edited" : "Expense Deleted";
          const body = action === "edit"
            ? `An expense "${deletedExpense.title}" of amount ₹${deletedExpense.amount} has been edited in group "${group.name}".`
            : `An expense "${deletedExpense.title}" of amount ₹${deletedExpense.amount} has been deleted from group "${group.name}".`;
          await sendMultipleNotifications(tokens, title, body);
        }

        // Add activity notifications for members (exclude payer maybe?)
        for (const member of group.members) {
          try {
            await Notification.create({
              recipient: member._id,
              sender: deletedExpense.paidBy,
              type: action === "edit" ? "expense_edited" : "expense_deleted",
              message: action === "edit"
                ? `An expense \"${deletedExpense.title}\" was edited in ${group.name}`
                : `An expense \"${deletedExpense.title}\" was deleted from ${group.name}`,
              referenceId: deletedExpense._id,
            });
          } catch (notifErr) {
            console.error("Error creating activity notification for deletion/edit:", notifErr);
          }
        }
      }
    }

    return res.status(200).json({ success: true, message: "Expense deleted" });
  } catch (error) {
    console.error("Error in deleteExpenseController:", error);
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    session.endSession();
  }
};

// -----------------------------------------
// 3) getExpenseController (fetch one expense by ID)
// -----------------------------------------
const getExpenseController = async (req, res) => {
  const { expenseId } = req.params;
  try {
    // Populate owedBy.user and paidBy so that the frontend sees usernames etc.
    const expense = await Expense.findById(expenseId)
      .populate("owedBy.user", "username")
      .populate("paidBy", "username")
      .lean();

    if (!expense) {
      return res
        .status(404)
        .json({ success: false, message: "Expense not found" });
    }

    return res.status(200).json({ success: true, expense });
  } catch (error) {
    console.error("Error in getExpenseController:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getTopCategoriesForGroupExpense = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { startDate, endDate } = req.query; // frontend sends these as query params

    if (!groupId) {
      return res.status(400).json({ message: "Group ID is required" });
    }

    const groupObjectId = new mongoose.Types.ObjectId(groupId);

    // Base match condition
    const matchConditions = { group: groupObjectId };

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
      { $match: matchConditions },
      { $group: { _id: "$category", total: { $sum: "$amount" } } },
      { $sort: { total: -1 } },
      // { $limit: 4 },
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

// Get subcategories for a group within a category (with optional timeline filter)
const getSubCategoriesForGroup = async (req, res) => {
  try {
    const { groupId, category, startDate, endDate } = req.body;

    if (!groupId) {
      return res.status(400).json({ message: "Group ID is required" });
    }

    const groupObjectId = new mongoose.Types.ObjectId(groupId);

    // Build match stage
    const matchStage = { group: groupObjectId, ...(category && { category }) };

    // Add timeline filter
    if (startDate && endDate) {
      matchStage.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    } else if (startDate) {
      matchStage.createdAt = { $gte: new Date(startDate) };
    } else if (endDate) {
      matchStage.createdAt = { $lte: new Date(endDate) };
    }

    const subcategories = await Expense.aggregate([
      { $match: matchStage },
      { $group: { _id: "$subcategory", total: { $sum: "$amount" } } },
      { $sort: { total: -1 } },
    ]);

    const formattedSubcategories = subcategories.map((sub) => ({
      name: sub._id,
      total: sub.total,
    }));

    res.status(200).json({ subcategories: formattedSubcategories });
  } catch (error) {
    console.error("Error fetching subcategories:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get all expenses for a subcategory within a group (with optional timeline filter)
const getAllExpensesForASubcategoryInGroup = async (req, res) => {
  try {
    const { groupId, category, subcategory, startDate, endDate } = req.body;

    if (!groupId || !category || !subcategory) {
      return res.status(400).json({ message: "Incomplete data received" });
    }

    const groupObjectId = new mongoose.Types.ObjectId(groupId);

    // Build the query
    const query = {
      group: groupObjectId,
      category,
      subcategory,
    };

    // Add optional date filters
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

const updateGroupDetails = async (req, res) => {
  const { id } = req.params;
  const { name, description, userId, from, to } = req.body;

  if (!name || name.trim().length === 0) {
    return res.status(400).json({ message: "Trip name is required." });
  }

  const session = await mongoose.startSession();

  try {
    let updatedGroup = null;

    await session.withTransaction(async () => {
      // Single atomic findOneAndUpdate — combines membership check + update
      // No separate read, so no write conflict possible
      const updateFields = { name: name.trim() };
      if (description !== undefined) {
        updateFields.description = description.trim();
      }
      if (from !== undefined) {
        updateFields.from = from || null;
      }
      if (to !== undefined) {
        updateFields.to = to || null;
      }

      updatedGroup = await Group.findOneAndUpdate(
        { _id: id, members: userId }, // query: group exists AND user is a member
        { $set: updateFields },
        { new: true, session }
      );

      if (!updatedGroup) {
        throw new Error("NOT_FOUND_OR_NOT_MEMBER");
      }
    });

    return res.status(200).json({ message: "Group updated successfully.", group: updatedGroup });
  } catch (error) {
    if (error.message === "NOT_FOUND_OR_NOT_MEMBER") {
      return res.status(403).json({ message: "Group not found or you are not a member." });
    }
    console.error("Error updating group details:", error);
    return res.status(500).json({ message: "Server error" });
  } finally {
    await session.endSession();
  }
};

const archiveGroup = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ message: "userId is required" });
  try {
    await Group.findByIdAndUpdate(id, { $addToSet: { hiddenBy: userId } });
    res.status(200).json({ message: "Group archived" });
  } catch (error) {
    console.error("archiveGroup error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const unarchiveGroup = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ message: "userId is required" });
  try {
    await Group.findByIdAndUpdate(id, { $pull: { hiddenBy: userId } });
    res.status(200).json({ message: "Group unarchived" });
  } catch (error) {
    console.error("unarchiveGroup error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const uploadGroupBanner = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file || !req.file.buffer)
      return res.status(400).json({ message: "No file uploaded" });

    const group = await Group.findById(id);
    if (!group) return res.status(404).json({ message: "Group not found" });

    // Upload to Cloudinary
    const result = await uploadBannerFromBuffer(req.file.buffer);

    // Delete previous Cloudinary image if it exists
    if (group.bannerId) {
      try {
        await cloudinary.uploader.destroy(group.bannerId);
      } catch (err) {
        console.warn(
          "Failed to delete previous Cloudinary banner:",
          err.message
        );
      }
    }

    // Update group document directly
    const updatedGroup = await Group.findByIdAndUpdate(
      id,
      {
        bannerUrl: result.secure_url,
        bannerId: result.public_id,
      },
      { new: true }
    );

    res.status(200).json({ group: updatedGroup });
  } catch (err) {
    console.error("uploadGroupBanner error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

const deleteGroupBanner = async (req, res) => {
  const { id } = req.params;
  const session = await mongoose.startSession();

  try {
    let updatedGroup = null;

    await session.withTransaction(async () => {
      const group = await Group.findById(id).session(session);
      if (!group) throw new Error("NOT_FOUND");
      if (!group.bannerUrl) throw new Error("NO_BANNER");

      // Delete from Cloudinary if bannerId exists
      if (group.bannerId) {
        try {
          await cloudinary.uploader.destroy(group.bannerId);
        } catch (err) {
          console.warn("Failed to delete Cloudinary banner:", err.message);
        }
      }

      // Clear banner fields in DB
      updatedGroup = await Group.findByIdAndUpdate(
        id,
        { $set: { bannerUrl: null, bannerId: null } },
        { new: true, session }
      );
    });

    return res.status(200).json({ message: "Banner deleted", group: updatedGroup });
  } catch (err) {
    if (err.message === "NOT_FOUND") {
      return res.status(404).json({ message: "Group not found" });
    }
    if (err.message === "NO_BANNER") {
      return res.status(400).json({ message: "No banner to delete" });
    }
    console.error("deleteGroupBanner error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  } finally {
    await session.endSession();
  }
};

export {
  createGroup,
  getGroupDetails,
  addMembers,
  getAllGroupsOfAUser,
  addExpenseController,
  getUserTrips,
  getRecentExpenses,
  removeMembers,
  addafterDeleteExpenseController,
  deleteExpenseController,
  getExpenseController,
  getTopCategoriesForGroupExpense,
  getSubCategoriesForGroup,
  getAllExpensesForASubcategoryInGroup,
  getGroupExpenses,
  updateGroupDetails,
  archiveGroup,
  unarchiveGroup,
  uploadGroupBanner,
  deleteGroupBanner,
};
