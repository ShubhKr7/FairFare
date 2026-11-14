import mongoose from "mongoose";
import dotenv from "dotenv";
import { Expense } from "../models/schema.js";

dotenv.config();

try {
  await mongoose.connect(process.env.MONGO_URI);
  const result = await Expense.updateMany(
    { $or: [{ date: { $exists: false } }, { date: null }] },
    [{ $set: { date: "$createdAt" } }]
  );
  console.log(`Backfilled expense dates: ${result.modifiedCount}`);
} catch (error) {
  console.error("Expense date backfill failed:", error);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
