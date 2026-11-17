// =============================================================================
// jest.config.cjs
// -----------------------------------------------------------------------------
// WHY THIS FILE EXISTS
//   The repo currently has NO Jest config. Running `jest` falls back to every
//   default, which means:
//     - Jest looks for tests in the whole project (including node_modules)
//     - It uses jsdom, which breaks code that assumes a Node environment
//     - There is no global setup hook, so env vars and DB state are undefined
//     - Coverage is never collected or enforced
//
//   This file centralizes all of that in ONE place so teammates don't have to
//   remember flags. It is the single source of truth for "how tests run".
//
// KEY DECISIONS
//   - testEnvironment: "node"  -> our code uses mongoose, express, fs, crypto.
//     jsdom would fake a browser and silently break Node-only APIs.
//   - roots: ["<rootDir>/tests"] -> tests live ONLY under backend/tests.
//     Prevents Jest from picking up stray scripts (e.g. scripts/*.js).
//   - setupFilesAfterEnv -> runs setup.jest.js once before the test suite.
//     This is where we inject test env vars and register global hooks
//     (afterAll for DB disconnect). Doing it here means every test file
//     gets a clean, identical environment without repeating boilerplate.
//   - collectCoverageFrom -> defines WHAT counts as "code under test".
//     We deliberately exclude tests/** and node_modules. Coverage is
//     reported but NOT enforced here (enforcement happens in CI via a
//     --coverageThreshold flag, so a local run never blocks a dev).
// =============================================================================

module.exports = {
  // Use Node, not jsdom. Mongoose + Express need real Node APIs.
  testEnvironment: "node",

  // Only treat files under backend/tests as tests.
  // Stops Jest from running scripts/backfillExpenseDates.js etc.
  roots: ["<rootDir>/tests"],

  // Match *.test.js / *.spec.js (works for both .js and .jsx).
  testMatch: ["**/?(*.)+(spec|test).[jt]s?(x)"],

  // Run once before any test file executes.
  setupFilesAfterEnv: ["<rootDir>/setup.jest.js"],

  // Where coverage reports go.
  coverageDirectory: "coverage",

  // What to measure. Exclude tests, helpers, and config from coverage.
  collectCoverageFrom: [
    "controllers/**/*.js",
    "service/**/*.js",
    "utils/**/*.js",
    "models/**/*.js",
    "middleware/**/*.js",
    "routes/**/*.js",
    "db/**/*.js",
    "!**/node_modules/**",
    "!**/index.js", // wire-up script; covered implicitly by e2e if at all
  ],

  // Clear the mock registry between test files so state can't leak.
  clearMocks: true,

  // ESM: the package.json has "type":"module". Jest still needs the flag
  // because it runs in its own VM. The npm script already passes
  // NODE_OPTIONS=--experimental-vm-modules; this is a backup for direct
  // `jest` invocations.
  transform: {},
};