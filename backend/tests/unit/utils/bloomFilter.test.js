// =============================================================================
// tests/unit/utils/bloomFilter.test.js
// -----------------------------------------------------------------------------
// TIER:   UNIT
// TARGET: utils/bloomFilter.js  (BloomFilter class)
//
// WHY THIS FILE EXISTS
//   The BloomFilter class is pure, deterministic, and free of external
//   dependencies (no DB, no network, no env vars). It is the safest place to
//   start: writing the first real Jest test here proves the harness works
//   before we touch anything that needs MongoDB or mocked services.
//
//   Note: utils/testBloomFilter.js already contains an equivalent test script
//   that runs with plain `node`. This file is its Jest counterpart.
//
// WHAT THIS FILE WILL CONTAIN (Phase 1)
//   - Constructor math: bit size (m) and hash count (k) match the optimal
//     formulas for the given expected-element count and false-positive rate.
//   - Zero false negatives: anything add()ed must test() true.
//   - False-positive rate stays under threshold for keys that were never added.
//   - Edge cases: empty string, null, undefined, numbers.
//   - clear() resets the filter to a fresh state.
//
// WHAT IT WILL NOT TEST
//   - initBloomFilter() -> that queries MongoDB; belongs in an integration test.
//   - The global bloomFilter singleton -> stateful; test the class instead.
//
// STATUS: placeholder. Replace the placeholder test below with the real cases
// listed above. Keep at least one test here so Jest does not warn about an
// empty suite while the structure is being committed.
// =============================================================================

import { BloomFilter } from "../../../utils/bloomFilter.js";

describe("BloomFilter (placeholder — Phase 1)", () => {
  // STRUCTURE PLACEHOLDER — delete this test and replace with real cases.
  test("TODO: constructor math, zero false negatives, FP rate, edge cases, clear()", () => {
    const f = new BloomFilter(1000, 0.01);
    f.add("alice");
    expect(f.test("alice")).toBe(true);
  });
});