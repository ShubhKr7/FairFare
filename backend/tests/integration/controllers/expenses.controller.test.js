// =============================================================================
// tests/integration/controllers/expenses.controller.test.js
// -----------------------------------------------------------------------------
// TIER:   INTEGRATION
// TARGET: controllers/expenses.js  (personal + friend expenses)
//
// WHY THIS FILE EXISTS
//   expenses.js is the smallest controller but it owns the core money
//   operations: create, read, update, delete for both personal expenses and
//   friend-split expenses. These are the writes that feed every analytics,
//   snapshot, and balance view in the app, so they need the most careful
//   coverage.
//
// WHAT THIS FILE WILL CONTAIN (Phase 3)
//   - createPersonalExpense: expense is created with paidBy = requester and
//     owedBy reflecting the split; the payer's recentExpense[] gains the id.
//   - getPersonalExpenses: returns the requester's expenses, newest first.
//   - updatePersonalExpense: amount / title / category can be changed.
//   - deletePersonalExpense: expense and the recentExpense reference are gone.
//   - getUserFriendExpenses: returns expenses shared between two users.
//
// DB STRATEGY
//   helpers/db.js: connectTestDb() beforeAll, clearDb() afterEach,
//   disconnectTestDb() afterAll.
//
// EXTERNAL MOCKS (per-test, at module boundary)
//   - service/notificationService.js -> jest.fn() (expense writes may trigger
//     notifications to owed parties).
//
// STATUS: placeholder. Replace the placeholder test below with the real cases
// listed above.
// =============================================================================

import { jest, expect, describe, test } from "@jest/globals";

import { connectTestDb, clearDb, disconnectTestDb } from "../../../helpers/db.js";
import { User, Expense } from "../../../models/schema.js";

// NOTE: package.json has "type":"module", so Jest runs this file in its ESM
// runtime. The CommonJS API (jest.mock) is a NO-OP here — the factory never
// executes and the real modules load instead. Use the ESM-native API.
await jest.unstable_mockModule("../../../service/notificationService.js", () => ({
  default: { sendService: jest.fn(), sendToMultiple: jest.fn() },
}));

describe("expenses controller (placeholder — Phase 3)", () => {
  beforeAll(async () => {
    await connectTestDb();
  });

  afterEach(async () => {
    await clearDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  // STRUCTURE PLACEHOLDER — delete this test and replace with real cases.
  test("TODO: create/read/update/delete personal expenses, friend expenses", async () => {
    const payer = await User.create({
      username: "payer",
      email: "payer@example.com",
      password: "Password123!",
    });
    const expense = await Expense.create({
      title: "Dinner",
      amount: 500,
      category: "Food",
      paidBy: payer._id,
      owedBy: [{ user: payer._id, amount: 500 }],
    });
    expect(expense.title).toBe("Dinner");
  });
});
