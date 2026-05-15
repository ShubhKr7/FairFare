import { Expense, LabelCategory, Group } from "../models/schema.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY?.trim());

const EXPIRY_MONTHS = 6; // expire cache after 6 months

const requestTimestamps = [];
const MAX_REQUESTS = 8; // max requests per WINDOW_MS
const WINDOW_MS = 60 * 1000; // 1 minute

// ---- Model switching state ----
const MODELS = [
  "gemini-3-flash-preview",     // Confirmed working in 2026!
  "gemini-3.1-flash-lite",
  "gemini-3.1-flash-lite-preview",
  "gemma-4-31b-it",             // Gemma 4 31B (15 RPM)
  "gemma-4-26b-a4b-it",         // Gemma 4 26B (15 RPM)
  "gemini-3-pro-preview",
  "gemini-flash-lite-latest",
  "gemini-2.0-flash-lite",
  "gemini-2.5-flash-lite",
  "gemini-3.1-pro-preview",
  "gemini-2.5-flash",
  "gemini-2.5-pro",
];

let modelIndex = 0; // track which model we are currently using
let lastSwitchDate = new Date().toDateString(); // track when quota was last reset

/**
 * Calculates milliseconds until the next midnight
 */
function getMsUntilMidnight() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight - now;
}

const PROMPT = `🧾 System Prompt: Expense Categorisation Expert

IMPORTANT: Always respond with a JSON object in this format:

{

 "category": "<best guess category>",

 "subcategory": "<best guess subcategory>"

}

Never output free text or arrows (->). If unsure, pick the closest available subcategory.

Given an expense title, return ONLY a valid JSON object.

You are an Expense Categorisation Expert.

Your role is to accurately and efficiently categorize user-provided expenses into predefined categories and subcategories.

🎯 Purpose & Goals

Accurately categorize a wide range of real-world expenses.

Map each expense to the most appropriate Category → Subcategory.

Provide clear, concise, and unambiguous categorization for every input.

⚙️ Behaviors & Rules

Initial Interaction

Wait for the user to provide a list of expenses.

For each expense, return the most fitting Category → Subcategory.

If multiple subcategories apply, choose the most common or primary one.

If no clear mapping exists, classify as Miscellaneous / Uncategorized.

Categorization Logic

Always prefer the closest subcategory match.

If a subcategory cannot be identified, return only the parent category.

Keep responses precise and structured:



[expense] -> [Category -> Subcategory]

📍 Special Rule for Locations

If the expense input is a location name (e.g., city, country, tourist spot, or explicitly looks like a trip/destination),



→ categorize it as:

Transport & Travel → Trips



💳 Special Rule for Names

- If the expense input is a **person’s name** (e.g., “Rahul”, “John”, “Priya”),  

  → categorize it as **Finance & Investments → Loan EMI**  

  (treat it as lending/borrowing money with that person).





📂 Expense Categories

Food & Dining

Groceries

Restaurants

Fast Food

Coffee/Tea

Alcohol

Cigarettes/Tobacco

Snacks

Transport & Travel

Public Transport

Taxi/Ride-hailing

Fuel/Petrol/Diesel

Vehicle Maintenance/Servicing

Parking & Tolls

Flights

Hotels/Accommodation

Travel Insurance

Trips

Housing & Utilities

Rent/Mortgage

Electricity

Water

Gas

Internet

Mobile Bill

Home Maintenance/Repairs

Property Tax

Repairs & Maintenance

Electronics Repair

Vehicle Repair

Appliances Repair

Other Repairs

Entertainment & Leisure

Movies & Shows

Music & Streaming

Gaming

Sports & Events

Nightlife/Clubs

Books/Magazines

Shopping

Clothing & Accessories

Electronics & Gadgets

Home Appliances

Furniture & Decor

Beauty & Personal Care

Gifts

Health & Fitness

Doctor Consultation

Medicines/Pharmacy

Health Insurance

Gym & Fitness Classes

Sports Equipment

Therapy/Counseling

Education & Learning

Tuition/Coaching

Books & Stationery

Online Courses/Subscriptions

Exams/Certifications

Finance & Investments

Loan EMI

Credit Card Bill

Bank Charges/Fees

Investments

Insurance Premiums

Taxes

Family & Personal Care

Childcare/School Fees

Elderly Care

Pet Care

Salon/Beauty Parlour

Personal Hygiene

Gifts & Donations

Charity/Donations

Religious Offerings

Gifts for Friends/Family

Business & Work

Office Supplies

Business Travel

Software Subscriptions

Freelancers/Contractors

Unexpected Expenses

Emergency Medical Bills

Accident Repairs

Lost/Stolen Item Replacement

Sudden Appliance Breakdown

Legal Fees/Fines

Emergency Travel

Miscellaneous / Uncategorized

Small one-off spends

Uncategorized expenses

🧩 Example Mappings

tea → Food & Dining → Coffee/Tea

coffee → Food & Dining → Coffee/Tea

pizza → Food & Dining → Fast Food

beer → Food & Dining → Alcohol

auto → Transport & Travel → Taxi/Ride-hailing

flight → Transport & Travel → Flights

train ticket → Transport & Travel → Public Transport

petrol → Transport & Travel → Fuel/Petrol/Diesel

rent → Housing & Utilities → Rent/Mortgage

wifi bill → Housing & Utilities → Internet

laptop repair → Repairs & Maintenance → Electronics Repair

movie ticket → Entertainment & Leisure → Movies & Shows

clothes → Shopping → Clothing & Accessories

makeup → Shopping → Beauty & Personal Care

gym membership → Health & Fitness → Gym & Fitness Classes

doctor visit → Health & Fitness → Doctor Consultation

school fees → Family & Personal Care → Childcare/School Fees

dog food → Family & Personal Care → Pet Care

gift for friend → Gifts & Donations → Gifts for Friends/Family

charity donation → Gifts & Donations → Charity/Donations

software subscription → Business & Work → Software Subscriptions

freelancer payment → Business & Work → Freelancers/Contractors

legal fine → Unexpected Expenses → Legal Fees/Fines

emergency hospital bill → Unexpected Expenses → Emergency Medical Bills

random purchase → Miscellaneous / Uncategorized → Uncategorized expenses

goa → Transport & Travel → Trips

delhi → Transport & Travel → Trips

paris → Transport & Travel → Trips`;

// ---- In-memory queue ----
const queue = [];
let isProcessing = false;

// Add job to queue
function enqueue(expenseId, label) {
  queue.push({ expenseId, label });
  processQueue();
}

// Process queue sequentially
// Process queue sequentially with sliding window rate limiting
async function processQueue() {
  if (isProcessing) return;
  isProcessing = true;

  while (queue.length > 0) {
    const { expenseId, label } = queue.shift();

    try {
      console.log(`\n[Queue: ${queue.length + 1} remaining] Categorizing: "${label}"`);

      const normalized = label.trim().toLowerCase();

      // 1. Check if already cached in DB
      const cached = await LabelCategory.findOne({ label: normalized });
      if (cached) {
        const ageMonths = cached.updatedAt
          ? (Date.now() - cached.updatedAt.getTime()) /
            (1000 * 60 * 60 * 24 * 30)
          : Infinity;

        if (ageMonths < EXPIRY_MONTHS) {
          // still valid
          await Expense.findByIdAndUpdate(expenseId, {
            category: cached.category,
            subcategory: cached.subcategory,
          });

          console.log(
            `✔ Cached: ${label} → ${cached.category}/${cached.subcategory}`
          );
          continue;
        }
      }

      // 2. Sliding window rate limiting before calling Gemini
      const now = Date.now();
      // Remove timestamps older than WINDOW_MS
      while (
        requestTimestamps.length &&
        requestTimestamps[0] <= now - WINDOW_MS
      ) {
        requestTimestamps.shift();
      }

      if (requestTimestamps.length >= MAX_REQUESTS) {
        // Wait until the oldest request leaves the window
        const waitTime = WINDOW_MS - (now - requestTimestamps[0]);
        console.log(
          `Rate limit reached. Waiting ${Math.ceil(waitTime / 1000)}s...`
        );
        queue.push({ expenseId, label });
        await new Promise((r) => setTimeout(r, waitTime));
        continue; // recheck the sliding window
      }

      // Record the request timestamp
      requestTimestamps.push(Date.now());

      // 3. Call Gemini
      const result = await categorizeExpenseWithGemini(expenseId, label);

      if (!result) {
        // 👇 all models failed, likely daily quota hit
        queue.push({ expenseId, label });
        
        const waitMs = getMsUntilMidnight();
        const waitHours = (waitMs / (1000 * 60 * 60)).toFixed(2);
        
        console.log(`\n🛑 DAILY QUOTA EXHAUSTED for all models.`);
        console.log(`⏳ Pausing categorization until midnight (~${waitHours} hours remaining).`);
        console.log(`📅 Will resume at: ${new Date(Date.now() + waitMs).toLocaleString()}`);
        
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }

      await Expense.findByIdAndUpdate(expenseId, {
        category: result.category,
        subcategory: result.subcategory,
      });

      // 4. Update or insert cache (upsert)
      await LabelCategory.findOneAndUpdate(
        { label: normalized },
        { category: result.category, subcategory: result.subcategory }, // will auto-update updatedAt
        { upsert: true, new: true }
      );

      console.log(
        `✔ Updated: ${label} → ${result.category}/${result.subcategory}`
      );
    } catch (err) {
      console.error("Worker error:", err.message);
    }

    // Small delay to avoid bursts (optional)
    await new Promise((r) => setTimeout(r, 100));
  }

  isProcessing = false;
}

// ---- Gemini API call ----
async function categorizeExpenseWithGemini(expenseId, label) {
  try {
    const expense = await Expense.findById(expenseId).populate("group");

    // Reset model to the first one at the start of a new day
    const today = new Date().toDateString();
    if (today !== lastSwitchDate) {
      modelIndex = 0;
      lastSwitchDate = today;
    }

    const activeModel = MODELS[modelIndex];

    const prompt = `
      ${PROMPT}

      Expense Title: "${label}".

      Group Title: "${expense?.group?.name || ""}".

      Group Description: "${expense?.group?.description || ""}".

      Consider the group context when categorizing if provided in this prompt.
      
      Respond with the best fitting category and subcategory in JSON.
    `;

    const model = genAI.getGenerativeModel({ model: activeModel });

    console.log(`📡 Calling Gemini (${activeModel})...`);
    const result = await model.generateContent(prompt);

    // Extract the text response safely
    const textResponse = result.response.text().trim();
    const cleanText = textResponse.replace(/```json|```/g, "");
    const parsed = JSON.parse(cleanText);

    return {
      category: parsed.category || "Uncategorized",
      subcategory: parsed.subcategory || "Other",
    };
  } catch (err) {
    const currentModel = MODELS[modelIndex];
    console.error(`Gemini error on ${currentModel}:`, err.message);

    // Switch to next model on ANY error (Quota, Invalid Key for that model, or Not Found)
    if (modelIndex < MODELS.length - 1) {
      modelIndex++;
      console.log(`🔄 Switching Model: ${currentModel} -> ${MODELS[modelIndex]}`);
      return categorizeExpenseWithGemini(expenseId, label); // retry with next model
    } else {
      console.log(
        "🚫 All models failed or exhausted for this request."
      );
      modelIndex = 0;
      return null;
    }
  }
}

export { enqueue, queue, isProcessing };
