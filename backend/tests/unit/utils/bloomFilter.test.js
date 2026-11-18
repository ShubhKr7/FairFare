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
// STATUS: Phase 1 starter. Real cases below; expand as needed.
//   Currently implemented: constructor math, basic add/test, falsy-input
//   handling (undefined/null/""/0/false), number<->string coercion, object
//   keys. Remaining cases (zero false negatives across many keys, FP-rate
//   threshold, clear()) are TODOs — not yet written.
// =============================================================================

import { BloomFilter } from "../../../utils/bloomFilter.js";

describe("BloomFilter (starter)", () => {
  test("constructor math: m=9586, k=7 for n=1000, p=0.01", () => {
    const f = new BloomFilter(1000, 0.01);
    expect(f.m).toBe(9586);
    expect(f.k).toBe(7);
  });

  test("add then test returns true", () => {
    const f = new BloomFilter(1000, 0.01);
    f.add("alice");
    expect(f.test("alice")).toBe(true);
  });
});

describe("BloomFilter edge cases (falsy inputs and invalid types)", () => {
  test("test() returns false for falsy keys that were never added", () => {
    const f = new BloomFilter(1000, 0.01);
    expect(f.test(undefined)).toBe(false);
    expect(f.test(null)).toBe(false);
    expect(f.test("")).toBe(false);
    expect(f.test(0)).toBe(false);
    expect(f.test(false)).toBe(false);
  });

  test("add() silently ignores falsy keys and does not increment count", () => {
    const f = new BloomFilter(1000, 0.01);
    f.add(undefined);
    f.add(null);
    f.add("");
    f.add(0);
    f.add(false);
    expect(f.count).toBe(0);
    expect(f.test(undefined)).toBe(false);
    expect(f.test(null)).toBe(false);
    expect(f.test("")).toBe(false);
    expect(f.test(0)).toBe(false);
    expect(f.test(false)).toBe(false);
  });

  test("object keys are coerced via String() and round-trip correctly", () => {
    const f = new BloomFilter(1000, 0.01);
    f.add({ a: 1 });
    expect(f.test({ a: 1 })).toBe(true);
    expect(f.test("[object Object]")).toBe(true);
  });

  test("number and string keys are treated as equivalent", () => {
    const f = new BloomFilter(1000, 0.01);
    f.add(123);
    expect(f.test(123)).toBe(true);
    expect(f.test("123")).toBe(true);
  });
});