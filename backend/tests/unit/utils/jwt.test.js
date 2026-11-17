// =============================================================================
// tests/unit/utils/jwt.test.js
// -----------------------------------------------------------------------------
// TIER:   UNIT
// TARGET: utils/jwt.js  (signAccessToken)
//
// WHY THIS FILE EXISTS
//   signAccessToken is the single entry point for creating auth tokens in this
//   codebase. Every protected route depends on tokens produced here being
//   verifiable by middleware/auth.js. If the claim shape, issuer, audience,
//   or expiry ever drift, authentication breaks silently.
//
//   It is a pure function (no DB, no network), so it is an ideal unit test.
//   We pin down the CONTRACT: claim shape, HS256 algorithm, issuer/audience,
//   expiry, and a round-trip verification using the exact options auth.js uses.
//
// WHAT THIS FILE WILL CONTAIN (Phase 1)
//   - The token is a non-empty string.
//   - The `sub` claim equals the userId passed in (as a string).
//   - The algorithm is HS256 (auth.js rejects anything else).
//   - issuer and audience match what auth.js verifies against.
//   - exp is set and lies in the future.
//   - Round-trip: a token signed here verifies with auth.js's verify options.
//
// WHAT IT WILL NOT TEST
//   - middleware/auth.js itself -> that is tests/unit/middleware/auth.test.js.
//   - Refresh token / rotation -> this codebase only issues access tokens.
//
// STATUS: placeholder. Replace the placeholder test below with the real cases
// listed above. The VERIFY_OPTIONS constant below mirrors auth.js exactly —
// if auth.js changes, update this constant too; that drift is the whole point
// of the test.
// =============================================================================

import jwt from "jsonwebtoken";
import { signAccessToken } from "../../../utils/jwt.js";

// Replicate the exact verification options middleware/auth.js uses.
const VERIFY_OPTIONS = {
  algorithms: ["HS256"],
  issuer: process.env.JWT_ISSUER,
  audience: process.env.JWT_AUDIENCE,
  clockTolerance: 5,
};

describe("signAccessToken (placeholder — Phase 1)", () => {
  // STRUCTURE PLACEHOLDER — delete this test and replace with real cases.
  test("TODO: claim shape, HS256, issuer/audience, expiry, round-trip verify", () => {
    const token = signAccessToken("64f7a8b9c1d2e3f4a5b6c7d8");
    const payload = jwt.verify(token, process.env.JWT_SECRET, VERIFY_OPTIONS);
    expect(payload.sub).toBe("64f7a8b9c1d2e3f4a5b6c7d8");
  });
});