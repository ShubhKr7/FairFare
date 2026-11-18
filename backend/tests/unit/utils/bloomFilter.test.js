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
// STATUS: Phase 1 complete. All scenarios from the Phase 1 list are implemented
//   below: constructor math, zero false negatives, FP-rate threshold, edge
//   cases (falsy inputs, coercion, object keys), clear(), and determinism.
//   Only initBloomFilter() and the global singleton remain untested (integration).
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

describe("BloomFilter correctness", () => {
  const N = 1000;
  const SEEN = Array.from({ length: N }, (_, i) => `user_${i}`);
  const UNSEEN = Array.from({ length: 20000 }, (_, i) => `unseen_${i + N}`);

  let filter;
  beforeEach(() => {
    filter = new BloomFilter(N, 0.01);
    for (const key of SEEN) filter.add(key);
  });

  test("zero false negatives: every added key tests true", () => {
    for (const key of SEEN) {
      expect(filter.test(key)).toBe(true);
    }
    expect(filter.count).toBe(N);
  });

  test("false-positive rate stays under threshold for never-added keys", () => {
    // Empirically ~0.0091 for this config; 0.05 gives 5x headroom so the
    // test stays non-flaky while still catching a broken implementation.
    let falsePositives = 0;
    for (const key of UNSEEN) {
      if (filter.test(key)) falsePositives++;
    }
    const rate = falsePositives / UNSEEN.length;
    expect(rate).toBeLessThanOrEqual(0.05);
  });

  test("clear() resets the filter to a fresh state", () => {
    expect(filter.count).toBe(N);
    filter.clear();
    expect(filter.count).toBe(0);
    expect(filter.test("user_0")).toBe(false);
    expect(filter.test("user_999")).toBe(false);
    // After clear, previously-unseen keys are still not present.
    expect(filter.test("unseen_0")).toBe(false);
  });

  test("index generation is deterministic across independent instances", () => {
    const other = new BloomFilter(N, 0.01);
    const key = "user_42";
    expect(other._getIndices(key)).toEqual(filter._getIndices(key));
    // Same instance is also stable across repeated calls.
    expect(filter._getIndices(key)).toEqual(filter._getIndices(key));
  });
});