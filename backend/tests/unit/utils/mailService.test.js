// =============================================================================
// tests/unit/utils/mailService.test.js
// -----------------------------------------------------------------------------
// TIER:   UNIT
// TARGET: utils/mailService.js  (sendMail)
//
// WHY THIS FILE EXISTS
//   sendMail is a thin wrapper around axios.post to an EXTERNAL mail
//   microservice. Calling the real service in a test would be slow, flaky
//   (network-dependent), and would actually send email. So we mock axios at
//   the module boundary and assert sendMail calls the right URL, payload,
//   headers, and timeout.
//
//   Two behaviors are worth pinning down specifically:
//     1. sendMail SWALLOWS errors (returns undefined, never throws) so the
//        caller's flow never breaks when mail is down. Lock that in with a
//        test so a future "fix" cannot silently turn it back into a throwing
//        function.
//     2. sendMail is a no-op when required fields or env vars are missing.
//
// MOCKING STRATEGY
//   jest.mock("axios") replaces the axios module with a manual mock before
//   sendMail is imported. axios.post becomes a jest.fn() we control per-test.
//   This isolates sendMail from the real HTTP client and from the network.
//
// WHAT THIS FILE WILL CONTAIN (Phase 1)
//   - Calls axios.post with the mail service URL + the given payload.
//   - Sends the x-mail-password header.
//   - Passes a 10_000 ms timeout.
//   - Does not throw when the network fails (error swallowing).
//   - Is a no-op when required fields are missing.
//   - Is a no-op when env vars are not configured.
//
// STATUS: placeholder. Replace the placeholder test below with the real cases
// listed above.
// =============================================================================

import { jest, expect, describe, test, beforeEach } from "@jest/globals";

// NOTE: package.json has "type":"module", so Jest runs this file in its ESM
// runtime. The CommonJS API (jest.mock) is a NO-OP here — the factory never
// executes and the real axios gets imported instead, which is why
// axios.post.mockReset threw "not a function". Use the ESM-native API.
await jest.unstable_mockModule("axios", () => ({
  default: { post: jest.fn().mockResolvedValue({ status: 200 }) },
}));

const axios = (await import("axios")).default;
const { sendMail } = await import("../../../utils/mailService.js");

describe("sendMail (placeholder — Phase 1)", () => {
  beforeEach(() => {
    axios.post.mockReset();
    // sendMail swallows errors and missing-field cases via console.error.
    // Without this, Jest complains "Cannot log after tests are done" when
    // the swallowed-error path runs after the test resolves.
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  // STRUCTURE PLACEHOLDER — delete this test and replace with real cases.
  test("TODO: URL/payload/headers, timeout, error swallowing, no-op guards", async () => {
    axios.post.mockResolvedValue({ status: 200 });
    await sendMail({ to: "a@b.com", subject: "s", text: "t" });
    expect(axios.post).toHaveBeenCalledTimes(1);
  });
});
