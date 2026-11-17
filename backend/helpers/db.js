// =============================================================================
// helpers/db.js
// -----------------------------------------------------------------------------
// WHY THIS FILE EXISTS
//   Integration and e2e tests need a REAL MongoDB (so queries, indexes,
//   populate, and transactions behave exactly like production) but they must
//   NOT touch the developer's or CI's production database.
//
//   mongodb-memory-server spins up a real MongoDB binary in a temp directory,
//   bound to a random port, isolated from everything else. It is deleted when
//   the server stops. This gives us production-faithful behavior with zero
//   side effects.
//
//   This helper wraps the connect/disconnect lifecycle so every test tier
//   uses the SAME pattern. If the pattern changes later (e.g. we switch to a
//   Dockerized Mongo), only this file changes.
//
// USAGE
//   import { connectTestDb, disconnectTestDb, clearDb } from "../../helpers/db.js";
//
//   beforeAll(async () => { await connectTestDb(); });
//   afterEach(async () => { await clearDb(); });
//   afterAll(async () => { await disconnectTestDb(); });
// =============================================================================

import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

let mongo; // holds the in-memory server instance for teardown

/**
 * Start an in-memory MongoDB and connect mongoose to it.
 * Also overrides process.env.MONGO_URI so any module that reads it
 * (e.g. db/mongoDb.js) points at the test instance.
 */
export async function connectTestDb() {
  mongo = await MongoMemoryServer.create();
  const uri = mongo.getUri();

  process.env.MONGO_URI = uri; // redirect db/mongoDb.js to the test instance

  await mongoose.connect(uri);
  return mongoose;
}

/**
 * Drop all data between tests so each test starts from a clean slate.
 * Cheaper than reconnecting; keeps indexes intact.
 */
export async function clearDb() {
  if (!mongoose.connection.db) return;
  const collections = await mongoose.connection.db.collections();
  for (const collection of collections) {
    await collection.deleteMany();
  }
}

/**
 * Disconnect mongoose and stop the in-memory server.
 * Always call this in afterAll to avoid Jest hanging ("Jest did not exit").
 */
export async function disconnectTestDb() {
  await mongoose.disconnect();
  if (mongo) {
    await mongo.stop();
    mongo = null;
  }
}