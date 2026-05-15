import mongoose from "mongoose";
import { Expense } from "../models/schema.js";
import { enqueue } from "./categorizerWorker.js";

// Common query for finding uncategorized expenses
const UNCATEGORIZED_QUERY = {
  $or: [
    { category: "Uncategorized" },
    { category: { $exists: false } },
    { category: null },
    { category: "" },
    { subcategory: null },
    { subcategory: "" }
  ]
};

// Process old expenses in batches (stream cursor)
async function processExistingExpenses() {
  console.log("🔍 Scanning for uncategorized expenses...");

  const cursor = Expense.find(UNCATEGORIZED_QUERY).cursor();

  for (
    let expense = await cursor.next();
    expense != null;
    expense = await cursor.next()
  ) {
    enqueue(expense._id, expense.title);
  }

  console.log("✅ Existing expenses enqueued");
}

let changeStream;
let resumeToken = null;
let lastEventTime = Date.now();
let isStarting = false;

function startExpenseStream() {
  if (isStarting) return;
  isStarting = true;
  console.log("🟢 Starting expense change stream...");

  // Close any existing stream
  if (changeStream) {
    try {
      changeStream.close();
    } catch {
      console.log("Error occured while closing an existing change stream.");
    }
    changeStream.removeAllListeners();
  }

  const options = resumeToken
    ? { resumeAfter: resumeToken, fullDocument: "updateLookup" }
    : { fullDocument: "updateLookup" };

  changeStream = Expense.watch([], options);

  changeStream.on("change", (change) => {
    resumeToken = change._id;
    lastEventTime = Date.now();

    // Loophole fixed: Handling both insert and update
    if (change.operationType === "insert" || change.operationType === "update") {
      const doc = change.fullDocument;
      // Check if the resulting document is uncategorized
      if (!doc.category || doc.category === "Uncategorized" || !doc.subcategory || doc.subcategory === "") {
        enqueue(doc._id, doc.title);
      }
    }
  });

  changeStream.on("error", (err) => {
    console.error("❌ Change stream error:", err);
    restartStreamWithBackoff();
    isStarting = false;
  });

  changeStream.on("close", () => {
    console.warn("⚠️ Change stream closed. Restarting...");
    restartStreamWithBackoff();
    isStarting = false;
  });
  isStarting = false;
  console.log("✅ Change Stream started perfectly!!!");
}

let retryTimeout;
function restartStreamWithBackoff() {
  if (retryTimeout) clearTimeout(retryTimeout);
  const delay = Math.min(30000, 5000 + Math.random() * 5000);
  console.log(`⏳ Restarting change stream in ${delay / 1000}s...`);
  retryTimeout = setTimeout(startExpenseStream, delay);
}

// Safety net: restart if no event seen for 15 mins
setInterval(() => {
  if (Date.now() - lastEventTime > 15 * 60 * 1000) {
    console.warn("💤 No events in 15min. Restarting stream...");
    restartStreamWithBackoff();
  }
}, 5 * 60 * 1000);

mongoose.connection.on("connected", () => {
  console.log("✅ MongoDB connected. Ensuring change stream running...");
  setTimeout(startExpenseStream, 2000);
});

mongoose.connection.on("reconnected", () => {
  console.log("🔁 MongoDB reconnected. Restarting change stream...");
  startExpenseStream();
});

async function rescanExpenses() {
  try {
    const uncategorized = await Expense.find(UNCATEGORIZED_QUERY)
      .limit(100)
      .lean();
    uncategorized.forEach((expense) => enqueue(expense._id, expense.title));
    if (uncategorized.length > 0) {
      console.log(`🔁 Rescan found ${uncategorized.length} uncategorized expenses.`);
    }
  } catch (err) {
    console.error("Rescan error:", err);
  }
}

// Run every 10 minutes
setInterval(rescanExpenses, 10 * 60 * 1000);

// Init categorizer
async function initExpenseCategorizer() {
  console.log("🚀 Initializing Expense Categorizer...");
  
  const exists = await Expense.exists(UNCATEGORIZED_QUERY);

  if (exists) {
    console.log("📂 Processing existing expenses...");
    await processExistingExpenses();
  } else {
    console.log("✨ No existing uncategorized expenses found.");
  }
  
  console.log("📡 Starting real-time expense stream...");
  startExpenseStream();
}

export { initExpenseCategorizer };
