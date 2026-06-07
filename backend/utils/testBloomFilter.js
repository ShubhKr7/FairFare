import { BloomFilter } from "./bloomFilter.js";
import assert from "assert";

console.log("🧪 Running Bloom Filter Unit Tests...");

// 1. Basic properties and calculations
const filter = new BloomFilter(1000, 0.01);
console.log(`- Optimal size (m): ${filter.m} bits`);
console.log(`- Optimal hash count (k): ${filter.k}`);

// 2. Test insertion and retrieval (No False Negatives)
console.log("- Inserting 500 sample usernames...");
const inserted = [];
for (let i = 0; i < 500; i++) {
  const username = `user_number_${i}`;
  filter.add(username);
  inserted.push(username);
}

console.log("- Verifying all inserted usernames exist (zero false negatives)...");
for (const username of inserted) {
  assert.strictEqual(filter.test(username), true, `Error: "${username}" should exist in the filter.`);
}
console.log("✅ Zero false negatives confirmed.");

// 3. Test false positives (Should be around 1% or less)
console.log("- Testing 10,000 non-inserted usernames for false positives...");
let falsePositives = 0;
const totalNonInserted = 10000;

for (let i = 0; i < totalNonInserted; i++) {
  const username = `different_user_${i}`;
  if (filter.test(username)) {
    falsePositives++;
  }
}

const fpRate = (falsePositives / totalNonInserted) * 100;
console.log(`- False positives found: ${falsePositives} out of ${totalNonInserted} (${fpRate.toFixed(2)}%)`);
assert.ok(fpRate < 2.0, `Error: False positive rate (${fpRate.toFixed(2)}%) is too high (expected < 2.0%).`);
console.log("✅ False positive rate is within target threshold.");

// 4. Test edge cases
console.log("- Testing edge cases (empty strings, null, numbers)...");
assert.strictEqual(filter.test(""), false, "Empty string should not match.");
assert.strictEqual(filter.test(null), false, "Null should not match.");
assert.strictEqual(filter.test(undefined), false, "Undefined should not match.");

// Let's add a number, it should be treated as a string internally
filter.add(12345);
assert.strictEqual(filter.test(12345), true, "Numbers converted to string should match.");
assert.strictEqual(filter.test("12345"), true, "String representation of number should match.");

// 5. Test clear
console.log("- Testing filter clearing...");
filter.clear();
for (const username of inserted) {
  assert.strictEqual(filter.test(username), false, `Error: "${username}" should NOT exist after clearing.`);
}
console.log("✅ Filter clear verified.");

console.log("\n🎉 All Bloom Filter unit tests passed successfully!");
