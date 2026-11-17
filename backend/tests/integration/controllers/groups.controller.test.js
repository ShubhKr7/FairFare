// =============================================================================
// tests/integration/controllers/groups.controller.test.js
// -----------------------------------------------------------------------------
// TIER:   INTEGRATION
// TARGET: controllers/groups.js  (group + group-expense lifecycle)
//
// WHY THIS FILE EXISTS
//   groups.js owns the group lifecycle: create, add/remove members, add/update/
//   delete expenses, archive/unarchive, banner upload. It also calls into
//   snapshots.js (applyExpenseCreate/applyExpenseUpdate/applyExpenseDelete),
//   which is the financial-snapshot pipeline. Because group operations and
//   snapshot updates are transactional, this file is where the two subsystems
//   are most likely to drift apart — a perfect integration-test target.
//
// WHAT THIS FILE WILL CONTAIN (Phase 3)
//   - createGroup: creates a group owned by the requester with the given
//     members; the owner appears in members[] and the group is returned.
//   - addMembers / removeMembers: members[] grows and shrinks correctly.
//   - addExpenseController: expense is created, group.expenses[] gains the id,
//     and group.tripTotal is updated.
//   - updateGroupExpenseController / deleteExpenseController: tripTotal and
//     expenses[] move in the right direction.
//   - archiveGroup / unarchiveGroup: hiddenBy[] toggles correctly.
//   - uploadGroupBanner / deleteGroupBanner: Cloudinary upload and destroy are
//     mocked; bannerUrl/bannerId are set and cleared.
//
// DB STRATEGY
//   helpers/db.js: connectTestDb() beforeAll, clearDb() afterEach,
//   disconnectTestDb() afterAll.
//
// EXTERNAL MOCKS (per-test, at module boundary)
//   - config/cloudinary.js       -> stub uploader.create / uploader.destroy
//   - service/notificationService.js -> jest.fn()
//
// STATUS: placeholder. Replace the placeholder test below with the real cases
// listed above.
// =============================================================================

import { jest, expect, describe, test } from "@jest/globals";

import { connectTestDb, clearDb, disconnectTestDb } from "../../../helpers/db.js";
import { User, Group, Expense } from "../../../models/schema.js";

// NOTE: package.json has "type":"module", so Jest runs this file in its ESM
// runtime. The CommonJS API (jest.mock) is a NO-OP here — the factory never
// executes and the real modules load instead. Use the ESM-native API.
await jest.unstable_mockModule("../../../config/cloudinary.js", () => ({
  cloudinary: {
    uploader: {
      create: jest.fn().mockResolvedValue({
        secure_url: "https://example.test/banner.png",
        public_id: "test_banner",
      }),
      destroy: jest.fn().mockResolvedValue({ result: "ok" }),
    },
  },
}));
await jest.unstable_mockModule("../../../service/notificationService.js", () => ({
  default: { sendService: jest.fn(), sendToMultiple: jest.fn() },
}));
// notificationService.js statically imports firebaseAdmin.js, which parses
// FIREBASE_SERVICE_ACCOUNT and calls admin.credential.cert() at import time.
// The setup stub is a fake key, so cert() throws "Too few bytes to parse DER".
// Mock firebaseAdmin itself so no real credential is ever parsed.
await jest.unstable_mockModule("../../../firebaseAdmin.js", () => ({
  default: {
    messaging: () => ({ send: jest.fn() }),
  },
}));

describe("groups controller (placeholder — Phase 3)", () => {
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
  test("TODO: create group, add/remove members, expense lifecycle, archive, banner upload", async () => {
    const owner = await User.create({
      username: "owner",
      email: "owner@example.com",
      password: "Password123!",
    });
    const group = await Group.create({
      name: "Trip",
      members: [owner._id],
      tripTotal: 0,
    });
    expect(group.name).toBe("Trip");
  });
});
