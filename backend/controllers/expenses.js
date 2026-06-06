import mongoose from "mongoose";
import { Expense, User, Notification } from "../models/schema.js";

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
  updatePersonalExpense
};
