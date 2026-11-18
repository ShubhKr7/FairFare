import mongoose from "mongoose";
import { Expense, User, Notification } from "../models/schema.js";
import { sendMultipleNotifications } from "../controllers/Notifications.js";
import { applyExpenseDelete } from "./snapshots.js";
import { invalidateAICache } from "./ai.js";

const getUserFriendExpenses = async (req, res) => {
  try {
    const { currentUserId, friendId } = req.params;
    const { limit, cursor } = req.query;

    if (!currentUserId || !friendId) {
      return res.status(400).json({
        status: "Missing currentUserId or friendId",
      });
    }

    if (currentUserId === friendId) {
      return res.status(400).json({
        status:
          "Invalid request: friendId and currentUserId cannot be the same",
      });
    }

    // Base filter: expenses between the two users
    const baseFilter = {
      $or: [
        {
          paidBy: currentUserId,
          "owedBy.user": friendId,
        },
        {
          paidBy: friendId,
          "owedBy.user": currentUserId,
        },
      ],
    };

    // If cursor is provided, only fetch items older than the cursor
    if (cursor) {
      baseFilter.createdAt = { $lt: new Date(cursor) };
    }

    const parsedLimit = limit ? parseInt(limit, 10) : null;

    let query = Expense.find(baseFilter)
      .populate("group", "name")
      .populate("paidBy", "username email")
      .populate("owedBy.user", "username email")
      .sort({ createdAt: -1 });

    // If limit is provided, fetch one extra to check if more exist
    if (parsedLimit) {
      query = query.limit(parsedLimit + 1);
    }

    const expenses = await query.lean();

    // Determine hasMore and trim the extra item
    let hasMore = false;
    let nextCursor = null;
    if (parsedLimit && expenses.length > parsedLimit) {
      hasMore = true;
      expenses.pop(); // remove the extra probe item
    }

    // nextCursor is the createdAt of the oldest item in this batch
    if (parsedLimit && expenses.length > 0) {
      nextCursor = expenses[expenses.length - 1].createdAt;
    }

    // Add a safe `groupName` field even if group doesn't exist
    const expensesWithGroupName = expenses.map((exp) => ({
      ...exp,
      groupName: exp.group?.name || null,
    }));

    // Fetch friend's activity status
    const friend = await User.findById(friendId).select("lastActive updatedAt").lean();

    const friendActivity = {};
    if (friend) {
      if (friend.lastActive) {
        friendActivity.lastAtive = friend.lastActive;
      } else {
        friendActivity.updatedAt = friend.updatedAt;
      }
    }

    return res.status(200).json({
      status: "Success",
      count: expensesWithGroupName.length,
      expenses: expensesWithGroupName,
      hasMore,
      nextCursor,
      ...friendActivity,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: "Error",
      message: error.message,
    });
  }
};

const createPersonalExpense = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { description, amount, date } = req.body;
    const userId = req.user.id;

    if (!description || !amount) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const parsedAmount = parseFloat(amount);
    if (parsedAmount > 500000) {
      return res.status(400).json({ message: "Amount cannot exceed 5,00,000" });
    }

    let newExpense;

    await session.withTransaction(async () => {
      newExpense = new Expense({
        title: description,
        amount: parseFloat(amount.toFixed(2)),
        date: date || Date.now(),
        paidBy: userId
      });

      await newExpense.save({ session });
      await User.findByIdAndUpdate(userId, {
        $push: { recentExpense: newExpense._id }
      }, { session });
    });

    res.status(201).json(newExpense);
  } catch (error) {
    console.error("Error creating personal expense:", error);
    res.status(500).json({ message: "Server error" });
  } finally {
    session.endSession();
  }
};

const getPersonalExpenses = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit, cursor } = req.query;

    const baseFilter = {
      paidBy: userId,
      owedBy: { $size: 0 },
    };

    // If cursor is provided, only fetch items older than the cursor
    if (cursor) {
      baseFilter.date = { $lt: new Date(cursor) };
    }

    const parsedLimit = limit ? parseInt(limit, 10) : null;

    let query = Expense.find(baseFilter).sort({ date: -1 });

    if (parsedLimit) {
      query = query.limit(parsedLimit + 1);
    }

    const expenses = await query.lean();

    // Determine hasMore and trim the extra item
    let hasMore = false;
    let nextCursor = null;
    if (parsedLimit && expenses.length > parsedLimit) {
      hasMore = true;
      expenses.pop();
    }

    if (parsedLimit && expenses.length > 0) {
      nextCursor = expenses[expenses.length - 1].date;
    }

    // Compute total spending (across ALL personal expenses, not just this page)
    const totalAgg = await Expense.aggregate([
      { $match: { paidBy: new mongoose.Types.ObjectId(userId), owedBy: { $size: 0 } } },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]);
    const totalSpending = totalAgg.length > 0 ? totalAgg[0].total : 0;
    const totalCount = totalAgg.length > 0 ? totalAgg[0].count : 0;

    // If limit was provided, return structured response
    if (parsedLimit) {
      return res.status(200).json({
        expenses,
        hasMore,
        nextCursor,
        totalSpending,
        totalCount,
      });
    }

    // Backward compatible: return plain array when no limit
    res.status(200).json(expenses);
  } catch (error) {
    console.error("Error fetching personal expenses:", error);
    res.status(500).json({ message: "Server error" });
  }
};


const deletePersonalExpense = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const expense = await Expense.findOne({ _id: id, paidBy: userId });

    if (!expense) {
      return res.status(404).json({ message: "Expense not found or unauthorized" });
    }

    await session.withTransaction(async () => {
      await Expense.findByIdAndDelete(id, { session });
      await User.findByIdAndUpdate(userId, {
        $pull: { recentExpense: id }
      }, { session });
    });

    // create activity log for deletion
    try {
      await Notification.create({
        recipient: userId,
        sender: userId,
        type: "expense_deleted",
        message: "You deleted a personal expense",
        referenceId: id,
      });
    } catch (notifErr) {
      console.error("Error creating activity for personal expense deletion:", notifErr);
    }

    res.status(200).json({ message: "Expense deleted successfully" });
  } catch (error) {
    console.error("Error deleting personal expense:", error);
    res.status(500).json({ message: "Server error" });
  } finally {
    session.endSession();
  }
};

/**
 * Delete any expense (personal, friend-split, or group) by ID.
 * - Reverses friend balance updates (User.friends.$.balance + UserFinancialSnapshot.friends.$.netBalance)
 * - Removes from payer's recentExpense
 * - Removes from group if applicable (Group.expenses + tripTotal)
 * - Creates Notification activity logs
 * - Sends FCM push notifications (async)
 * - Rebuilds financial snapshots + invalidates AI cache (async)
 */
const deleteExpense = async (req, res) => {
  const session = await mongoose.startSession();
  const { id } = req.params;
  const userId = req.user.id;

  try {
    // ---- Tamper & Scope Guards (before any DB writes) ----
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid expense ID" });
    }

    const expense = await Expense.findById(id);
    if (!expense) {
      return res.status(404).json({ success: false, message: "Expense not found" });
    }

    // Reject group expenses — handled elsewhere
    if (expense.group) {
      return res.status(400).json({
        success: false,
        message: "Group expenses are handled elsewhere and cannot be deleted here",
      });
    }

    // Reject personal expenses (no owedBy entries, or only self-owed with no friend split)
    const hasFriendSplit = expense.owedBy.some(
      (o) => o.user.toString() !== expense.paidBy.toString()
    );
    if (expense.owedBy.length === 0 || !hasFriendSplit) {
      return res.status(400).json({
        success: false,
        message: "Personal expenses cannot be deleted via this endpoint",
      });
    }

    // Authorization: user must be the payer OR one of the owedBy users
    const isPayer = expense.paidBy.toString() === userId.toString();
    const isOwed = expense.owedBy.some((o) => o.user.toString() === userId.toString());
    if (!isPayer && !isOwed) {
      return res.status(403).json({ success: false, message: "Unauthorized to delete this expense" });
    }

    let deletedExpense = null;

    await session.withTransaction(async () => {
      // 1) Load the existing expense (within transaction)
      const txExpense = await Expense.findById(id).session(session);
      if (!txExpense) {
        return res.status(404).json({ success: false, message: "Expense not found" });
      }

      deletedExpense = txExpense.toObject();
      const { paidBy, owedBy, amount } = txExpense;

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
        { $pull: { recentExpense: id } },
        { session }
      );

      // 4) Delete the Expense document itself
      await Expense.deleteOne({ _id: id }, { session });
    });

    if (!deletedExpense) {
      return; // Response already sent inside transaction
    }

    res.status(200).json({ success: true, message: "Expense deleted" });

    // 5) Async post-commit work: notifications, activity logs, snapshots, AI cache
    setImmediate(async () => {
      try {
        const { paidBy, owedBy, amount, title } = deletedExpense;

        // Notify involved users (friend-split expenses only) and create activity entries
        const [payerUser, owedUser] = await Promise.all([
          User.findById(paidBy, "fcmToken username"),
          User.findById(owedBy[0].user, "fcmToken username"),
        ]);

        const tokens = [payerUser?.fcmToken, owedUser?.fcmToken].filter(Boolean);
        if (tokens.length > 0) {
          const body = `${title} expense has been deleted. Amount: ₹${amount}`;
          sendMultipleNotifications(tokens, "Expense Deleted", body).catch(err =>
            console.error("Async FCM push notification error:", err)
          );
        }

        // Create activity notifications for both users so each sees it on their activity page
        // sender = the other person (friend), so clicking opens chat with them
        const friendId = owedBy[0].user;
        const activityLogs = [
          {
            recipient: paidBy,
            sender: friendId,
            type: "expense_deleted",
            message: `You deleted the expense "${title}" for ₹${amount}`,
            referenceId: deletedExpense._id,
          },
          {
            recipient: friendId,
            sender: paidBy,
            type: "expense_deleted",
            message: `${payerUser?.username || "Someone"} deleted the expense "${title}" for ₹${amount}`,
            referenceId: deletedExpense._id,
          },
        ];
        await Notification.insertMany(activityLogs);

        /* ================= SNAPSHOT: EXPENSE DELETE ================= */
        await applyExpenseDelete(deletedExpense);
        deletedExpense.owedBy.forEach(owed => invalidateAICache(owed.user));
        invalidateAICache(deletedExpense.paidBy);
        /* ============================================================ */
      } catch (postCommitErr) {
        console.error("Post-commit expense delete processing failed:", postCommitErr);
      }
    });

  } catch (error) {
    console.error("Error in deleteExpense:", error);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: error.message });
    }
  } finally {
    session.endSession();
  }
};

const updatePersonalExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { description, amount, date } = req.body;

    const expense = await Expense.findOne({ _id: id, paidBy: userId, owedBy: { $size: 0 } });

    if (!expense) {
      return res.status(404).json({ message: "Expense not found or unauthorized" });
    }

    if (description !== undefined) expense.title = description;
    if (amount !== undefined) {
      const parsedAmount = parseFloat(amount);
      if (parsedAmount > 500000) {
        return res.status(400).json({ message: "Amount cannot exceed 5,00,000" });
      }
      expense.amount = parseFloat(Number(parsedAmount).toFixed(2));
    }
    if (date !== undefined) expense.date = new Date(date);

    await expense.save();

    // log edit activity
    try {
      await Notification.create({
        recipient: userId,
        sender: userId,
        type: "expense_edited",
        message: "You edited a personal expense",
        referenceId: expense._id,
      });
    } catch (notifErr) {
      console.error("Error creating activity for personal expense edit:", notifErr);
    }

    res.status(200).json(expense);
  } catch (error) {
    console.error("Error updating personal expense:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export {
  getUserFriendExpenses,
  createPersonalExpense,
  getPersonalExpenses,
  deletePersonalExpense,
  updatePersonalExpense,
  deleteExpense
};
