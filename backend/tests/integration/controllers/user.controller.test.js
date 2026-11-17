// =============================================================================
// tests/integration/controllers/user.controller.test.js
// -----------------------------------------------------------------------------
// TIER:   INTEGRATION
// TARGET: Controllers/user.js  (the user controller functions)
//
// WHY THIS FILE EXISTS
//   The controller layer is where business logic lives. This file calls the
//   controller functions DIRECTLY (not through HTTP) but with a REAL in-memory
//   MongoDB, so it exercises the full code path: controller -> model -> DB.
//   It is the "middle tier" between pure unit tests (no DB) and route tests
//   (HTTP layer). It catches bugs in query construction, validation, and
//   response shaping that neither tier sees.
//
//   We mock only the things that are NOT part of the controller's contract:
//   - utils/mailService.js       -> no real emails
//   - service/notificationService.js -> no real push notifications
//
//   Everything else (User model, bcrypt, JWT) runs for real.
//
// WHAT THIS FILE WILL CONTAIN (Phase 2)
//   - registerUser: 201 on success, 400 on duplicate email, 400 on weak password.
//   - updateUserProfile: 200 with updated doc, 404 if user missing.
//   - getUserProfile: 200 with correct shape, 404 if missing.
//   - getUserExpenses / getUserGroups: correct aggregation results.
//
// MOCKING STRATEGY
//   Models are real against an in-memory DB (helpers/db.js). External
//   services (mail, FCM) are mocked at the module boundary so no real
//   email/push happens.
//
// STATUS: placeholder. Replace the placeholder test below with the real cases
// listed above.
// =============================================================================

import { jest, expect, describe, test, beforeEach, afterEach, beforeAll, afterAll } from "@jest/globals";
import { connectTestDb, clearDb, disconnectTestDb } from "../../../helpers/db.js";
import { User } from "../../../models/schema.js";

// NOTE: package.json has "type":"module", so Jest runs this file in its ESM
// runtime. The CommonJS API (jest.mock) is a NO-OP here — the factory never
// executes and the real modules load instead. Use the ESM-native API.
await jest.unstable_mockModule("../../../utils/mailService.js", () => ({
  sendMail: jest.fn(),
}));
await jest.unstable_mockModule("../../../service/notificationService.js", () => ({
  default: { sendService: jest.fn(), sendToMultiple: jest.fn() },
}));

// Import the controller AFTER the mocks are registered.
const { updateUserProfile, publicUserDetails, userDetails } =
  await import("../../../controllers/user.js");

describe("user controller (placeholder — Phase 2)", () => {
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
  test("TODO: registerUser 201/400, getUserProfile 200/404, updateUserProfile", async () => {
    const user = await User.create({
      username: "ctrluser",
      email: "ctrl@example.com",
      password: "Password123!",
    });

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    await publicUserDetails({ params: { id: user._id } }, res);

    // The exact shape depends on the real controller; this placeholder only
    // proves the function is callable against the in-memory DB.
    // res.status is a chainable mock (returns this), so the status code is the
    // first CALL ARGUMENT, not mock.results[0].value.
    expect([200, 404]).toContain(res.status.mock.calls[0][0]);
  });
});