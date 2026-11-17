// =============================================================================
// tests/unit/services/expenseCategorizer.test.js
// -----------------------------------------------------------------------------
// TIER:   UNIT
// TARGET: service/expenseCategorizer.js  (initExpenseCategorizer + helpers)
//
// WHY THIS FILE EXISTS
//   expenseCategorizer.js wires up the Gemini/Groq AI clients, a sliding-window
//   rate limiter, an in-memory queue, and a LabelCategory cache. It is the
//   most complex service in the repo and the hardest to test, so it gets its
//   own file rather than being absorbed into a controller test.
//
//   This is a UNIT test: we mock the AI SDKs (@google/generative-ai and
//   groq-sdk) at the module boundary and test the pure logic around them —
//   rate limiting, model fallback, cache invalidation, prompt building —
//   without ever calling a real API.
//
// WHAT THIS FILE WILL CONTAIN (Phase 2)
//   - Rate limiter: enforces the sliding window (e.g. 8 req/min) and blocks
//     the 9th call within the window.
//   - Model fallback: when Groq returns 429/quota, the service switches to
//     Gemini and retries, instead of failing.
//   - Cache invalidation: invalidateAICache(userId) removes that user's entry.
//   - Prompt building: the system prompt contains the expected safety and
//     formatting rules (field whitelisting, no exposure of tokens/emails).
//
// MOCKING STRATEGY
//   jest.mock("@google/generative-ai") and jest.mock("groq-sdk") so the SDK
//   clients are replaced with jest.fn() instances. The service's own module
//   load (new GoogleGenerativeAI(...) / new Groq(...)) then succeeds with
//   stubbed clients, and we control what generateContent / chat.completions
//   create returns.
//
// STATUS: placeholder. Replace the placeholder test below with the real cases
// listed above. Do NOT test the actual AI output quality here — that is a
// manual/eval concern. Test the mechanics.
// =============================================================================

import { jest, expect, describe, test } from "@jest/globals";

jest.mock("@google/generative-ai");
jest.mock("groq-sdk");

describe("expenseCategorizer (placeholder — Phase 2)", () => {
  // STRUCTURE PLACEHOLDER — delete this test and replace with real cases.
  test("TODO: rate limiting, model fallback, cache invalidation, prompt rules", () => {
    expect(true).toBe(true);
  });
});
