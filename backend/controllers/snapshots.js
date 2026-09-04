import { User, Group, Expense } from "../models/schema.js";
import { UserFinancialSnapshot } from "../models/schema.js";
import { invalidateAICache } from "./ai.js";

export async function createSnapshot(userId) {
  const user = await User.findById(userId).lean();
  if (!user) throw new Error("User not found");

  const snapshot = new UserFinancialSnapshot({
    userId,
    profile: {
      username: user.username,
      groupsCount: user.groups.length,
      upiLinked: Boolean(user.upiId)
    }
  });

  // FULL BUILD USING AGGREGATIONS
  await buildFullSnapshot(snapshot, userId);


  return snapshot.save();
}


export async function buildFullSnapshot(snapshot, userId) {

  /* ---------- CATEGORY SPEND ---------- */
  const categorySpend = await Expense.aggregate([
    { $match: { paidBy: userId } },
    {
      $group: {
        _id: "$category",
        total: { $sum: "$amount" }
      }
    }
  ]);

  snapshot.spending.totalSpend = categorySpend.reduce(
    (sum, c) => sum + c.total, 0
  );

  categorySpend.forEach(c => {
    snapshot.spending.categoryTotals.set(
      c._id || "Uncategorized",
      c.total
    );
  });

  /* ---------- GROUP SPEND ---------- */
  const groups = await Group.find({ members: userId }).lean();

  for (const g of groups) {
    const expenses = await Expense.find({ group: g._id }).lean();

    let yourTotal = 0;
    let groupTotal = 0;
    const categoryTotals = {};

    for (const e of expenses) {
      groupTotal += e.amount;
      if (String(e.paidBy) === String(userId)) {
        yourTotal += e.amount;
        categoryTotals[e.category] =
          (categoryTotals[e.category] || 0) + e.amount;
      }
    }

    snapshot.groups.push({
      groupId: g._id,
      yourTotalSpend: yourTotal,
      groupTotal,
      groupName: g.name,
      topCategory:
        Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0]?.[0],
      categoryTotals
    });
  }

  /* ---------- FRIEND BALANCES ---------- */
  /* ---------- FRIEND BALANCES (SOURCE OF TRUTH: USER MODEL) ---------- */

  const user = await User.findById(userId)
    .populate("friends.friend", "username")
    .lean();

  console.log(user.friends)

  snapshot.friends = (user.friends || [])
    .filter(f => String(f.friend?._id) !== String(userId)) // 🚫 safety: no self
    .map(f => ({
      friendId: f.friend?._id,
      friendName: f.friend?.username,
      netBalance: f.balance
    }));

  console.log("snapshot", snapshot);
}



// export async function applyExpenseCreate(expense) {
//   const affectedUsers = new Set([
//     expense.paidBy.toString(),
//     ...expense.owedBy.map(o => o.user.toString())
//   ]);
//   console.log("affectedUsers", affectedUsers);

//   for (const userId of affectedUsers) {
//     console.log("userId", userId);
//     let snapshot = await UserFinancialSnapshot.findOne({ userId });

//     if (!snapshot) {
//       snapshot = await createSnapshot(userId);
//     }


//     if (String(expense.paidBy) === String(userId)) {
//       // Spending
//       const categoryKey = typeof expense.category === "string" && expense.category.trim()
//     ? expense.category
//     : "Uncategorized";

// snapshot.spending.categoryTotals.set(
//   categoryKey,
//   (snapshot.spending.categoryTotals.get(categoryKey) || 0) +
//     expense.amount
// );
//       // Group
//       if (expense.group) {
//         let group = snapshot.groups.find(
//           g => String(g.groupId) === String(expense.group)
//         );

//         if (!group) {
//           snapshot.groups.push({
//             groupId: expense.group,
//             yourTotalSpend: expense.amount,
//             groupTotal: expense.amount,
//             categoryTotals: { [expense.category]: expense.amount },
//             topCategory: expense.category
//           });
//         } else {
//           group.yourTotalSpend += expense.amount;
//           group.groupTotal += expense.amount;

//           group.categoryTotals[expense.category] =
//             (group.categoryTotals[expense.category] || 0) + expense.amount;

//           group.topCategory = Object.entries(group.categoryTotals)
//             .sort((a, b) => b[1] - a[1])[0][0];
//         }
//       }
//     }

//     // Friend balances
//     for (const o of expense.owedBy) {
//       if (String(o.user) !== String(userId)) continue;

//       let friend = snapshot.friends.find(
//         f => String(f.friendId) === String(expense.paidBy)
//       );

//       if (!friend) {
//         snapshot.friends.push({
//           friendId: expense.paidBy,
//           netBalance: -o.amount
//         });
//       } else {
//         friend.netBalance -= o.amount;
//       }
//     }

//     snapshot.version += 1;
//     snapshot.lastUpdated = new Date();
//     await snapshot.save();
//   }
// }




// export async function applyExpenseDelete(expense) {
//   const affectedUsers = new Set([
//     expense.paidBy.toString(),
//     ...expense.owedBy.map(o => o.user.toString())
//   ]);

//   for (const userId of affectedUsers) {
//     let snapshot = await UserFinancialSnapshot.findOne({ userId });

//     // Safety fallback
//     if (!snapshot) {
//       snapshot = await createSnapshot(userId);
//       continue;
//     }

//     /* ------------------------------
//        PAID BY USER (REVERSE SPENDING)
//     ------------------------------ */
//     if (String(expense.paidBy) === String(userId)) {
//       // Reverse total spend
//       snapshot.spending.totalSpend -= expense.amount;

//       // Reverse category spend
//       const currentCategoryTotal =
//         snapshot.spending.categoryTotals.get(expense.category) || 0;

//       if (currentCategoryTotal <= expense.amount) {
//         snapshot.spending.categoryTotals.delete(expense.category);
//       } else {
//         snapshot.spending.categoryTotals.set(
//           expense.category,
//           currentCategoryTotal - expense.amount
//         );
//       }

//       /* -------- GROUP REVERSAL -------- */
//       if (expense.group) {
//         const group = snapshot.groups.find(
//           g => String(g.groupId) === String(expense.group)
//         );

//         if (group) {
//           group.yourTotalSpend -= expense.amount;
//           group.groupTotal -= expense.amount;

//           // Reverse group category
//           if (group.categoryTotals?.[expense.category] <= expense.amount) {
//             delete group.categoryTotals[expense.category];
//           } else {
//             group.categoryTotals[expense.category] -= expense.amount;
//           }

//           // Recompute top category safely
//           const entries = Object.entries(group.categoryTotals || {});
//           group.topCategory =
//             entries.length > 0
//               ? entries.sort((a, b) => b[1] - a[1])[0][0]
//               : null;

//           // Cleanup empty group
//           if (group.groupTotal <= 0) {
//             snapshot.groups = snapshot.groups.filter(
//               g => String(g.groupId) !== String(expense.group)
//             );
//           }
//         }
//       }
//     }

//     /* ------------------------------
//        OWED USERS (REVERSE BALANCES)
//     ------------------------------ */
//     for (const o of expense.owedBy) {
//       if (String(o.user) !== String(userId)) continue;

//       const friend = snapshot.friends.find(
//         f => String(f.friendId) === String(expense.paidBy)
//       );

//       if (friend) {
//         friend.netBalance += o.amount;

//         // Cleanup zero balances
//         if (friend.netBalance === 0) {
//           snapshot.friends = snapshot.friends.filter(
//             f => String(f.friendId) !== String(expense.paidBy)
//           );
//         }
//       }
//     }

//     snapshot.version += 1;
//     snapshot.lastUpdated = new Date();
//     await snapshot.save();
//   }
// }


export async function applyExpenseCreate(expense) {
  const affectedUsers = new Set([
    expense.paidBy.toString(),
    ...expense.owedBy.map(o => o.user.toString())
  ]);

  for (const userId of affectedUsers) {
    let snapshot = await UserFinancialSnapshot.findOne({ userId });

    if (!snapshot) {
      snapshot = await createSnapshot(userId);
      continue;
    }

    // 🔥 FULL REBUILD — SINGLE SOURCE OF TRUTH
    snapshot.groups = [];
    snapshot.friends = [];
    snapshot.spending.categoryTotals.clear();

    await buildFullSnapshot(snapshot, userId);

    snapshot.version += 1;
    snapshot.lastUpdated = new Date();
    await snapshot.save();
    invalidateAICache(userId);
  }
}

export async function applyExpenseDelete(expense) {
  const affectedUsers = new Set([
    expense.paidBy.toString(),
    ...expense.owedBy.map(o => o.user.toString())
  ]);

  for (const userId of affectedUsers) {
    let snapshot = await UserFinancialSnapshot.findOne({ userId });

    if (!snapshot) {
      snapshot = await createSnapshot(userId);
      continue;
    }

    snapshot.groups = [];
    snapshot.friends = [];
    snapshot.spending.categoryTotals.clear();

    await buildFullSnapshot(snapshot, userId);

    snapshot.version += 1;
    snapshot.lastUpdated = new Date();
    await snapshot.save();
    invalidateAICache(userId);
  }
}
