// FNV-1a 32-bit hash function
function fnv1a(str, seed = 0) {
  let hash = 0x811c9dc5 ^ seed;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    // 32-bit integer multiplication
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export class BloomFilter {
  constructor(expectedElements = 100000, falsePositiveRate = 0.01) {
    this.n = expectedElements;
    this.p = falsePositiveRate;
    
    // Calculate optimal bit size (m) and optimal number of hash functions (k)
    this.m = Math.ceil(- (this.n * Math.log(this.p)) / (Math.log(2) ** 2));
    this.k = Math.ceil((this.m / this.n) * Math.log(2));
    
    // Allocate space in memory as a typed byte array
    this.bitArray = new Uint8Array(Math.ceil(this.m / 8));
    this.count = 0;
  }
  
  /**
   * Generates k indices using Kirsch-Mitzenmacher optimization
   */
  _getIndices(key) {
    const strKey = String(key);
    const hash1 = fnv1a(strKey, 0);
    const hash2 = fnv1a(strKey, 1);
    
    const indices = [];
    for (let i = 0; i < this.k; i++) {
      const idx = (hash1 + Math.imul(i, hash2)) % this.m;
      indices.push(idx >= 0 ? idx : idx + this.m);
    }
    return indices;
  }
  
  /**
   * Adds an item to the Bloom Filter
   */
  add(key) {
    if (!key) return;
    const indices = this._getIndices(key);
    for (const idx of indices) {
      const byteIdx = Math.floor(idx / 8);
      const bitIdx = idx % 8;
      this.bitArray[byteIdx] |= (1 << bitIdx);
    }
    this.count++;
  }
  
  /**
   * Tests if an item is in the Bloom Filter
   * Returns true (possibly in set) or false (definitely not in set)
   */
  test(key) {
    if (!key) return false;
    const indices = this._getIndices(key);
    for (const idx of indices) {
      const byteIdx = Math.floor(idx / 8);
      const bitIdx = idx % 8;
      if ((this.bitArray[byteIdx] & (1 << bitIdx)) === 0) {
        return false; // Definitely not in the set
      }
    }
    return true; // Possibly in the set
  }
  
  /**
   * Resets the Bloom Filter
   */
  clear() {
    this.bitArray.fill(0);
    this.count = 0;
  }
}

import { User } from "../models/schema.js";

// Export a default global instance configured for 100,000 users and 1% FP rate
export const bloomFilter = new BloomFilter(100000, 0.01);

/**
 * Initializes the Bloom Filter by loading all usernames from MongoDB.
 */
export async function initBloomFilter() {
  console.log("🌸 [BloomFilter] Running self-test health check...");
  try {
    const testFilter = new BloomFilter(1000, 0.01);
    const sampleUsernames = ["john_doe", "jane_smith", "alex_123"];
    
    // Add sample usernames
    for (const username of sampleUsernames) {
      testFilter.add(username);
    }
    
    // Verify zero false negatives
    for (const username of sampleUsernames) {
      if (!testFilter.test(username)) {
        throw new Error(`Self-test failed: "${username}" should exist in the filter.`);
      }
    }
    
    // Verify non-existent username returns false (probabilistic, highly likely to be false)
    if (testFilter.test("completely_random_unused_name")) {
      console.warn("⚠️ [BloomFilter] Self-test warning: False positive on 'completely_random_unused_name' (expected behavior for bloom filters).");
    }
    
    console.log("✅ [BloomFilter] Self-test health check passed successfully!");
  } catch (error) {
    console.error("❌ [BloomFilter] Self-test health check failed:", error);
  }

  console.log("🌸 [BloomFilter] Initializing Bloom Filter from database...");
  try {
    const users = await User.find({}, "username").lean();
    bloomFilter.clear();
    for (const user of users) {
      if (user.username) {
        bloomFilter.add(user.username.trim());
      }
    }
    console.log(`✅ [BloomFilter] Initialized successfully with ${bloomFilter.count} usernames.`);
  } catch (error) {
    console.error("❌ [BloomFilter] Failed to initialize Bloom Filter:", error);
  }
}
