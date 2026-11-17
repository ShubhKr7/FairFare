// =============================================================================
// tests/unit/middleware/auth.test.js
// -----------------------------------------------------------------------------
// TIER:   UNIT
// TARGET: middleware/auth.js  (the `auth` middleware)
//
// WHY THIS FILE EXISTS
//   auth.js is the gatekeeper for every protected route. Its behavior is
//   deterministic given a token and a request, so it is a unit test, not an
//   integration test. Testing it in isolation (rather than through supertest)
//   makes the pass/fail paths obvious: call next() or send a 401.
//
//   We test it by calling the middleware directly with a mock req/res/next.
//   Tokens are created with the REAL signAccessToken (from utils/jwt.js) so we
//   exercise the exact same signing/verifying pair the app uses.
//
// WHAT THIS FILE WILL CONTAIN (Phase 1)
//   - Missing / malformed Authorization header -> 401 "Authentication required".
//   - Valid token, matching id header -> next() called, req.user.id set.
//   - Valid token, MISMATCHED id header -> 401 "Unauthorised".
//   - Expired token -> 401 "Session expired. Please log in again."
//   - Tampered token (wrong secret) -> 401 "Invalid token".
//   - Token with wrong algorithm -> 401 (auth.js pins algorithms: ["HS256"]).
//
// MOCKING STRATEGY
//   auth.js calls User.findByIdAndUpdate(payload.sub, { lastActive: ... })
//   fire-and-forget. That is a DB write on every authenticated request, so we
//   mock the User model (jest.mock("../../../models/schema.js")) and assert
//   findByIdAndUpdate was called with the right args (or just that it didn't
//   throw). This keeps the test fast and DB-free.
//
// STATUS: placeholder. Replace the placeholder test below with the real cases
// listed above.
// =============================================================================

import { jest, expect, describe, test } from "@jest/globals";

// NOTE: package.json has "type":"module", so Jest runs this file in its ESM
// runtime. The CommonJS API (jest.mock) is a NO-OP here — the factory never
// executes and the real User model loads instead, which is why the
// fire-and-forget findByIdAndUpdate threw a mongoose cast error after the
// environment was torn down. Use the ESM-native API.
await jest.unstable_mockModule("../../../models/schema.js", () => ({
  User: { findByIdAndUpdate: jest.fn().mockResolvedValue({}) },
}));

const jwt = await import("jsonwebtoken");
const { signAccessToken } = await import("../../../utils/jwt.js");
const { auth } = await import("../../../middleware/auth.js");
const { User } = await import("../../../models/schema.js");

describe("auth middleware (placeholder — Phase 1)", () => {
  const buildReq = (overrides = {}) => ({
    headers: { authorization: "", id: "", ...overrides },
  });

  const makeRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };
  const next = jest.fn();

  // STRUCTURE PLACEHOLDER — delete this test and replace with real cases.
  test("TODO: 401 on missing header, 200/next on valid token, 401 on mismatched id, expired, tampered", async () => {
    const token = signAccessToken("64f7a8b9c1d2e3f4a5b6c7d8");
    const req = buildReq({ authorization: `Bearer ${token}`, id: "64f7a8b9c1d2e3f4a5b6c7d8" });
    const res = makeRes();
    await auth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
      "64f7a8b9c1d2e3f4a5b6c7d8",
      { lastActive: expect.any(Date) }
    );
  });
});
