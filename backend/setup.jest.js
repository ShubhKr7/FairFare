// =============================================================================
// setup.jest.js
// -----------------------------------------------------------------------------
// WHY THIS FILE EXISTS
//   Several modules in this repo read environment variables AT IMPORT TIME,
//   not at call time. That means the moment any test file (or anything it
//   imports) touches those modules, the code runs with whatever env happens
//   to be set -- which in a fresh CI/local shell is usually undefined.
//
//   Specific offenders we have already found:
//     - index.js            -> process.env.ORIGIN.split(",") throws if unset
//     - firebaseAdmin.js    -> JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
//     - service/ai.js       -> new GoogleGenerativeAI(GEMINI_API_KEY)
//                            -> new Groq({ apiKey: GROQ_API_KEY })
//     - db/mongoDb.js       -> mongoose.connect(process.env.MONGO_URI)
//     - utils/jwt.js        -> jwt.sign(..., process.env.JWT_SECRET)
//     - middleware/auth.js  -> jwt.verify(..., process.env.JWT_SECRET)
//
//   Rather than make every test file set these vars, we set them ONCE here.
//   Jest runs this file before ANY test file, so the values are in place
//   before the first import happens.
//
// WHY THESE SPECIFIC VALUES
//   - JWT_SECRET / ISSUER / AUDIENCE: must match what auth.js and jwt.js
//     read. Using fixed test values means a token signed in one test is
//     verifiable in another. They are NOT real secrets.
//   - FIREBASE_SERVICE_ACCOUNT stub: firebaseAdmin.js parses this JSON at
//     import. We give it an empty object so parsing succeeds but no real
//     credential is loaded. Tests that need FCM mock the module anyway.
//   - GEMINI_API_KEY / GROQ_API_KEY stubs: ai.js builds SDK clients at
//     import. Empty strings prevent undefined crashes; ai tests mock the
//     SDK methods themselves.
//   - MONGO_URI: default placeholder. Integration/e2e tests override this
//     at runtime with an in-memory server URI (see helpers/db.js).
// =============================================================================

// --- Inject test environment BEFORE any module loads ------------------------
process.env.NODE_ENV = "test";

// dotenv.config() in firebaseAdmin.js (and elsewhere) loads .env and would
// OVERWRITE every value we set below with real credentials. Stub it out so
// the test stubs win. Real .env is never needed in tests.
import dotenv from "dotenv";
const _realConfig = dotenv.config;
dotenv.config = () => ({ parsed: {}, error: null });

process.env.MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/fairfare_test";

process.env.JWT_SECRET = process.env.JWT_SECRET || "fairfare-test-secret-do-not-commit";
process.env.JWT_ISSUER = process.env.JWT_ISSUER || "fairfare-test";
process.env.JWT_AUDIENCE = process.env.JWT_AUDIENCE || "fairfare-test-app";
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

// firebaseAdmin.js does JSON.parse(this) at import AND calls
// admin.credential.cert(...), which validates the shape. An empty object
// throws "must contain a project_id", so the stub must look like a real
// service account. These are NOT real credentials — just enough shape to
// let firebase-admin initialize. Tests that need FCM mock the module.
process.env.FIREBASE_SERVICE_ACCOUNT =
  process.env.FIREBASE_SERVICE_ACCOUNT ||
  JSON.stringify({
    project_id: "fairfare-test",
    private_key: "-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----\n",
    client_email: "test@fairfare-test.iam.gserviceaccount.com",
  });

// ai.js builds SDK clients at import -> stub to avoid undefined crashes.
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || "test-gemini-key";
process.env.GROQ_API_KEY = process.env.GROQ_API_KEY || "test-groq-key";

// mailService.js reads these; stub so importing it never throws.
process.env.MAIL_SERVICE_URL =
  process.env.MAIL_SERVICE_URL || "https://example.test/api/send-mail";
process.env.MAIL_SERVICE_PASSWORD =
  process.env.MAIL_SERVICE_PASSWORD || "test-mail-password";

// index.js reads this to configure CORS. Without it the app throws on import.
process.env.ORIGIN = process.env.ORIGIN || "http://localhost:5173";

// --- Global hooks ------------------------------------------------------------
// Jest runs these AFTER all test files have loaded but BEFORE the event loop
// exits. This is the right place to tear down shared resources so they do
// not leak between suites or hang the process.

afterAll(async () => {
  // Best-effort disconnect from whatever DB the last test connected to.
  // Wrapped in try/catch because some test tiers (pure unit) never connect.
  try {
    const mongoose = await import("mongoose");
    if (mongoose.default.connection.readyState !== 0) {
      await mongoose.default.disconnect();
    }
  } catch (err) {
    // Non-fatal: if mongoose isn't connected, nothing to clean up.
    console.warn("setup.jest.js: cleanup disconnect skipped:", err.message);
  }
});