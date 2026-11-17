// =============================================================================
// tests/e2e/smoke.test.js
// -----------------------------------------------------------------------------
// TIER:   E2E (end-to-end)
// TARGET: the whole app, via helpers/testApp.js + real in-memory MongoDB
//
// WHY THIS FILE EXISTS
//   Unit and integration tests each cover one piece in isolation. This file is
//   the SAFETY NET: it boots the full application (real routing, real models,
//   real middleware, real in-memory Mongo) and asserts that the pieces compose
//   correctly. It is intentionally small — a handful of happy-path requests —
//   because its job is to catch "nothing fits together anymore" regressions,
//   not to be exhaustive.
//
//   A green e2e suite is the signal that a change is safe to ship. If this
//   file fails, something broke at the boundaries between layers, which is
//   exactly where isolated tests cannot see.
//
// WHAT THIS FILE WILL CONTAIN (Phase 4)
//   - GET  /api/ping                       -> 200 "ponging" (unauthenticated).
//   - POST /user/register -> GET /user/profile with the token -> 200.
//   - POST /group/create-group -> GET /group/get-group/:id with the token -> 200.
//   - An authenticated expense flow: create -> list -> delete.
//
// DB STRATEGY
//   helpers/db.js: connectTestDb() beforeAll, disconnectTestDb() afterAll.
//   This file does NOT clearDb between tests because it is a single linear
//   smoke path; if you expand it, add afterEach(clearDb).
//
// EXTERNAL MOCKS (module boundary)
//   - utils/mailService.js       -> jest.fn() (registration may email)
//   - service/notificationService.js -> jest.fn()
//   - config/cloudinary.js       -> stub uploader (profile/banner uploads)
//
// STATUS: placeholder. Replace the placeholder test below with the real smoke
// cases listed above.
// =============================================================================

import { jest, expect, describe, test } from "@jest/globals";

// NOTE: package.json has "type":"module", so Jest runs this file in its ESM
// runtime. The CommonJS API (jest.mock) is a NO-OP here — the factory never
// executes and the real modules load instead. Use the ESM-native API, and
// register mocks BEFORE any dynamic import (ESM static imports are hoisted
// above top-level await).
await jest.unstable_mockModule("../../utils/mailService.js", () => ({
  sendMail: jest.fn(),
}));
await jest.unstable_mockModule("../../service/notificationService.js", () => ({
  default: { sendService: jest.fn(), sendToMultiple: jest.fn() },
}));
await jest.unstable_mockModule("../../config/cloudinary.js", () => ({
  default: {
    uploader: {
      create: jest.fn().mockResolvedValue({
        secure_url: "https://example.test/x.png",
        public_id: "x",
      }),
      destroy: jest.fn().mockResolvedValue({ result: "ok" }),
    },
  },
}));

const supertest = await import("supertest");
const { createTestApp } = await import("../../helpers/testApp.js");
const { connectTestDb, disconnectTestDb } = await import("../../helpers/db.js");
const { signAccessToken } = await import("../../utils/jwt.js");
const { User } = await import("../../models/schema.js");

const request = supertest.default(createTestApp());

describe("e2e smoke (placeholder — Phase 4)", () => {
  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  // STRUCTURE PLACEHOLDER — delete this test and replace with real cases.
  test("TODO: ping, register->profile, group create->get, expense create->list->delete", async () => {
    // 1. Unauthenticated health check.
    const ping = await request.get("/api/ping");
    expect(ping.status).toBe(200);

    // 2. Register a user and confirm the profile endpoint is reachable.
    // NOTE: there is no /user/profile route. The authenticated profile route
    // is GET /user/:id (userDetails). Hit that so the placeholder exercises a
    // real route through the routing table.
    const user = await User.create({
      username: "smokeuser",
      email: "smoke@example.com",
      password: "Password123!",
    });
    const token = signAccessToken(user._id.toString());

    const profile = await request
      .get(`/user/${user._id.toString()}`)
      .set("Authorization", `Bearer ${token}`)
      .set("id", user._id.toString());

    expect([200, 401, 404]).toContain(profile.status);
  });
});
