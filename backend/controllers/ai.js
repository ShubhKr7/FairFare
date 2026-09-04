import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";
import { UserFinancialSnapshot, User, Expense, Group } from "../models/schema.js";
import NodeCache from "node-cache";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ================= CACHE CONFIGURATION =================
// 5-minute cache for user context data
const aiCache = new NodeCache({
  stdTTL: 300, // 5 minutes in seconds
  checkperiod: 60, // Check for expired keys every 60 seconds
  useClones: false // Better performance, data is read-only anyway
});

// ================= MODEL SWITCHING STATE =================
let activeModel = "llama-3.3-70b-versatile"; // default primary model (Groq)
let lastSwitchDate = new Date().toDateString(); // track when quota was last reset
let triedFallbackToday = false; // flag to avoid looping between models

// ================= FIELD WHITELISTING =================
// Explicitly define what fields AI can access (security best practice)
const SAFE_USER_FIELDS = ['username', 'friends', 'groups', 'profilePhotoUrl'];
const SAFE_FRIEND_FIELDS = ['username']; // NO email, NO fcmToken
const SAFE_GROUP_FIELDS = ['name', 'description', 'members', 'tripTotal', 'from', 'to'];

// ================= SYSTEM PROMPT =================
const SYSTEM_PROMPT = `
You are **FairFare AI** — a smart, friendly personal finance assistant for the FairFare expense splitting app.

## YOUR ROLE
You help users understand their spending patterns, manage shared expenses with friends, and make better financial decisions. You analyze their financial data and provide clear, actionable insights.

## CORE CAPABILITIES
✓ Analyze spending patterns and categories
✓ Track balances with friends (who owes whom)
✓ Provide insights on group expenses
✓ Identify spending trends and anomalies
✓ Answer questions about transactions and financial health
✓ Give friendly reminders and smart suggestions

## DATA YOU HAVE ACCESS TO
1. **User Profile**: Name, friends count, groups participation
2. **Friends**: List of friends with their balances (positive = they owe user, negative = user owes them)
3. **Groups**: Trip/event groups with total spending and category summaries. **Note**: Detailed individual expenses (up to 50) are only provided for a group if the user explicitly mentions the group's name in their message. If you need details for a group but don't see them, ask the user to specify which group they want to discuss.
4. **Expenses**: Recent transactions (up to 20) with:
   - Title, amount, category, date, group name
   - Who paid for the expense
   - Which friends were involved and how much each owes
   - Whether the user was the payer
5. **Financial Snapshot**: Aggregated spending data, category totals, monthly trends

## CRITICAL RULES

### Balance Interpretation (VERY IMPORTANT!)
- **Positive balance (+₹100)** = Friend OWES the user ₹100
- **Negative balance (-₹100)** = User OWES the friend ₹100
- **Zero balance (₹0)** = All settled up

### Response Formatting
- Use **markdown formatting** for beautiful, readable responses
- Include **headings** (##), **bold text**, and **bullet points**
- Keep responses **concise and scannable** — users are on mobile!
- For long lists (transactions, friends), show **top 20 maximum** and ask "Would you like to see more?"
- Use emojis sparingly for visual appeal (💰 💸 ✅ ⚠️ 📊)

### Pagination Guidelines
- Recent transactions: Show latest 20, offer to see more
- Friends list: Show top 10 by balance amount, offer full list
- Category breakdowns: Show top 5 categories, summarize rest as "Others"
- Group expenses: Show key highlights, not every detail

### Response Quality
- Be conversational, friendly, and encouraging
- Provide **actionable insights**, not just raw numbers
- Suggest next steps when relevant ("You might want to remind...")
- Use **natural language**, avoid technical jargon
- **Never mention**: database IDs, object IDs, internal schemas, snapshots

### Data Analysis
- Calculate totals, averages, and percentages when helpful
- Compare spending across time periods
- Rank friends/categories by amount
- Identify unusual patterns or spikes
- Combine data from multiple sources when needed

### Privacy & Security
- Never expose: passwords, UPI IDs, FCM tokens, internal IDs
- Refer to people by their names, not IDs
- Keep financial advice general and supportive

## EXAMPLE RESPONSES

**Q: "How much have I spent this month?"**
A:
## 💰 Monthly Spending Overview

You've spent **₹12,450** this month so far.

**Top Categories:**
- 🍔 Food & Dining: ₹5,200 (42%)
- 🚕 Transport: ₹3,100 (25%)
- 🎬 Entertainment: ₹2,800 (22%)
- 📦 Others: ₹1,350 (11%)

**Insight:** You're spending more on food than usual. Consider meal prepping to save!

---

**Q: "Who owes me money?"**
A:
## 💸 People Who Owe You

1. **Rahul** - ₹850
2. **Priya** - ₹420
3. **Amit** - ₹150

**Total receivable:** ₹1,420

💡 You can send them a payment reminder from their transaction page!

---

**Q: "Show me all my transactions"**
A:
## 📋 Recent Transactions (Latest 20)

1. ₹350 - Lunch at Cafe - Paid by Rahul (You owe ₹175)
2. ₹500 - Movie tickets - You paid (Priya owes ₹250)
3. ₹1,200 - Groceries - You paid (Split with 3 friends)
... (17 more)

Would you like to see more transactions? Just ask!

---

## WHAT TO DO IF...

- **Data is missing**: "I don't have that information yet. Try adding some expenses first!"
- **Question is unclear**: "Could you clarify what you mean? For example, are you asking about..."
- **Calculation needed**: Perform it confidently using the data provided
- **Nonsense question**: Respond wittily but respectfully

## HANDLING ACTION REQUESTS

**IMPORTANT:** You are an **analysis assistant**, NOT an action executor. You cannot perform actions on behalf of users.

### When users ask you to DO something:

**❌ You CANNOT:**
- Send payment reminders to friends
- Settle balances
- Add or remove friends
- Create or delete expenses
- Make payments
- Change settings

**✅ You CAN:**
- Analyze who owes whom and suggest they send reminders
- Explain how to settle balances through the app
- Guide users to the right features
- Provide insights to inform their decisions

### How to respond to action requests:

**Example 1: "Remind Rahul to pay me"**
Response:
## 📢 Sending Reminders

I can't send reminders directly, but I can help!

**Here's what you can do:**
1. Go to Rahul's transaction page
2. Tap the 🔔 bell icon at the top
3. A payment reminder will be sent to Rahul

**Current Balance:** Rahul owes you ₹850

💡 Gentle reminders work best for maintaining good friendships!

---

**Example 2: "Settle up with everyone"**
Response:
## 💰 Settle Balances

I can't settle balances for you, but here's your settlement guide:

**People who owe you:**
- Rahul: ₹850
- Priya: ₹420

**People you owe:**
- Amit: ₹200

**To settle:**
1. Go to each friend's transaction page
2. Tap the 💱 settle button at the top
3. Confirm the settlement

Would you like to know who to prioritize settling with first?

---

**General Action Response Template:**

1. **Acknowledge** the request kindly
2. **Explain** you can't perform actions
3. **Guide** them to the feature with clear steps
4. **Add context** from their data if relevant
5. **Provide insight** to make it helpful

**Tone:** Helpful, not dismissive. Position yourself as a guide, not a blocker.

## YOUR GOAL
Transform raw financial data into **clear, helpful, beautiful insights** that make users love using FairFare AI.
`;

// ================= HELPER FUNCTIONS =================

/**
 * Build user context from financial snapshot (fast) + selective detailed data
 * This prioritizes the pre-aggregated snapshot over full DB queries
 */
async function buildUserContext(userId, userQuery = "") {
  const q = userQuery.toLowerCase();
  console.log("🔍 Building fresh user context for:", userId, q ? `(query: ${q})` : "");

  // 1. PRIMARY SOURCE: Financial Snapshot (pre-aggregated, super fast)
  const snapshot = await UserFinancialSnapshot.findOne({ userId }).lean();

  if (!snapshot) {
    // Fallback: If snapshot doesn't exist, build minimal context
    const basicUser = await User.findById(userId)
      .select(SAFE_USER_FIELDS.join(' '))
      .lean();

    return {
      profile: {
        username: basicUser?.username || "User",
        friendsCount: 0,
        groupsCount: 0
      },
      friends: [],
      groups: [],
      recentExpenses: [],
      financialSummary: null,
      aiUsage: { dailyCount: 0, remaining: 10 }
    };
  }

  // 2. SECONDARY: Fetch ONLY detailed transaction data when needed
  // We still need recent expenses with friend context for specific queries
  const recentExpenses = await Expense.find({
    $or: [
      { paidBy: userId },
      { 'owedBy.user': userId }
    ]
  })
    .select('title amount category createdAt paidBy owedBy groupName')
    .populate('paidBy', SAFE_FRIEND_FIELDS.join(' '))
    .populate('owedBy.user', SAFE_FRIEND_FIELDS.join(' '))
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  // 3. Build context from snapshot + recent expenses
  const userContext = {
    profile: {
      username: snapshot.profile?.username || "User",
      friendsCount: snapshot.friends?.length || 0,
      groupsCount: snapshot.groups?.length || 0,
      profilePhoto: null // Not needed for AI
    },

    // Friends data from snapshot (already has balances)
    friends: snapshot.friends?.map(f => ({
      name: f.friendName,
      // NO email field - whitelisted out!
      balance: f.netBalance || 0
    })) || [],

    // Groups data - fetch actual groups with member details
    groups: await (async () => {
      if (!snapshot.groups || snapshot.groups.length === 0) return [];

      const groupIds = snapshot.groups.map(g => g.groupId);
      const actualGroups = await Group.find({ _id: { $in: groupIds } })
        .select('name description members tripTotal from to')
        .populate('members', 'username')
        .lean();

      return Promise.all(actualGroups.map(async (g) => {
        const snapshotGroup = snapshot.groups.find(
          sg => sg.groupId.toString() === g._id.toString()
        );

        // SELECTIVE FETCH: only fetch detail if group title is in query
        const isMentioned = q.includes(g.name.toLowerCase());
        let recentGroupExpenses = [];

        if (isMentioned) {
          const groupExpenses = await Expense.find({ group: g._id })
            .sort({ createdAt: -1 })
            .limit(50)
            .populate('paidBy', SAFE_FRIEND_FIELDS.join(' '))
            .populate('owedBy.user', SAFE_FRIEND_FIELDS.join(' '))
            .lean();

          recentGroupExpenses = groupExpenses.map(ge => {
            const isUserPayer = ge.paidBy?._id?.toString() === userId.toString();
            return {
              title: ge.title,
              amount: ge.amount,
              category: ge.category,
              date: ge.createdAt,
              paidBy: ge.paidBy?.username || "Unknown",
              youPaid: isUserPayer,
              involvedFriends: ge.owedBy
                ?.filter(o => o.user?._id?.toString() !== userId.toString())
                .map(o => o.user?.username || "Unknown") || []
            };
          });
        }

        return {
          name: g.name,
          description: g.description,
          totalSpent: g.tripTotal || 0,
          yourSpend: snapshotGroup?.yourTotalSpend || 0,
          topCategory: snapshotGroup?.topCategory,
          membersCount: g.members?.length || 0,
          memberNames: g.members?.map(m => m.username) || [],
          recentGroupExpenses,
          isDeepContextAvailable: isMentioned,
          period: g.from && g.to ? {
            from: g.from,
            to: g.to
          } : null
        };
      }));
    })(),

    // Recent expenses with friend context
    recentExpenses: recentExpenses.map(e => {
      const paidByName = e.paidBy?.username || "Unknown";
      const isUserPayer = e.paidBy?._id?.toString() === userId.toString();

      const friendsInvolved = e.owedBy
        ?.filter(o => o.user?._id?.toString() !== userId.toString())
        .map(o => ({
          name: o.user?.username || "Unknown",
          amount: o.amount
        })) || [];

      return {
        title: e.title,
        amount: e.amount,
        category: e.category,
        date: e.createdAt,
        paidBy: paidByName,
        youPaid: isUserPayer,
        friendsInvolved: friendsInvolved,
        groupName: e.groupName || null
      };
    }),

    // Financial summary from snapshot (pre-aggregated!)
    financialSummary: {
      totalSpent: snapshot.spending?.totalSpend || 0,
      categoryBreakdown: snapshot.spending?.categoryTotals
        ? (snapshot.spending.categoryTotals instanceof Map
          ? Object.fromEntries(snapshot.spending.categoryTotals)
          : snapshot.spending.categoryTotals)
        : {},
      monthlyTrend: {
        thisMonth: snapshot.trends?.monthlyTotal || 0,
        lastMonth: snapshot.trends?.lastMonthTotal || 0,
        change: snapshot.trends?.monthlyTotal && snapshot.trends?.lastMonthTotal
          ? ((snapshot.trends.monthlyTotal - snapshot.trends.lastMonthTotal) / snapshot.trends.lastMonthTotal * 100).toFixed(1)
          : null
      }
    },

    aiUsage: {
      dailyCount: 0,
      remaining: 10
    }
  };

  console.log("✅ Context built successfully");
  return userContext;
}

/**
 * Invalidate cache for a specific user (call this when user data changes)
 */
export function invalidateAICache(userId) {
  const cacheKey = `ai_context_${userId}`;
  aiCache.del(cacheKey);
  console.log(`🗑️ AI cache invalidated for user: ${userId}`);
}

// ================= MAIN AI FUNCTION =================

export const askFairFareAI = async (req, res) => {
  let count = 0; // Declare outside try-catch to prevent ReferenceError in error handlers

  try {
    const { userId, query } = req.body;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        answer: "💭 Saying nothing is still saying something. Try asking an actual question!"
      });
    }

    /* ================= USER + AI USAGE CHECK ================= */
    const user = await User.findById(userId).select("aiChatUsage username");

    if (!user) {
      return res.status(404).json({
        answer: "User not found.",
        usageCount: 0
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const usage = user.aiChatUsage || {};
    count = usage.count || 0;
    const lastUsed = usage.lastUsed;

    if (!lastUsed || new Date(lastUsed) < today) {
      count = 0;
    }

    // We will increment usage ONLY after successful AI response
    // But we still return the current count in context for AI to know limits
    const currentCount = count;

    if (currentCount >= 10) {
      return res.status(200).json({
        answer: "⏰ Daily AI query limit reached (10/day). Your curiosity is impressive! Come back tomorrow.",
        usageCount: currentCount
      });
    }

    /* ================= FETCH OR GET CACHED CONTEXT ================= */
    const lowercaseQuery = query.toLowerCase();

    // 1. Pre-AI Interception: Check if query is group-related but vague
    const snapshotForInterception = await UserFinancialSnapshot.findOne({ userId }).select('groups').lean();
    const groupNames = snapshotForInterception?.groups?.map(g => g.groupName) || [];

    const groupKeywords = ["group", "trip", "trips", "expense", "expenses", "spending", "spent"];
    const isGroupRelated = groupKeywords.some(kw => lowercaseQuery.includes(kw));
    const mentionsAnyGroup = groupNames.some(name => lowercaseQuery.includes(name.toLowerCase()));

    if (isGroupRelated && !mentionsAnyGroup && groupNames.length > 0) {
      console.log("🛑 Intercepting vague group query");
      return res.status(200).json({
        answer: `I see you're asking about your group expenses! 📊 To give you a detailed breakdown, could you please specify which group? \n\nYou are currently in: \n${groupNames.map(n => `• **${n}**`).join('\n')}`,
        usageCount: currentCount
      });
    }

    // 2. Proceed with normal AI flow if not intercepted
    const cacheKey = `ai_context_${userId}_${lowercaseQuery.replace(/\s+/g, '_').substring(0, 30)}`;
    let userContext = aiCache.get(cacheKey);

    if (!userContext) {
      // Cache miss - build fresh context
      console.log("❌ Cache miss - fetching from DB");
      userContext = await buildUserContext(userId, query);

      // Store in cache for 5 minutes
      aiCache.set(cacheKey, userContext);
      console.log("💾 Context cached for 5 minutes");
    } else {
      console.log("✅ Cache hit - using cached data");
    }

    // Update AI usage in context
    userContext.aiUsage = {
      dailyCount: currentCount,
      remaining: 10 - currentCount
    };

    /* ================= BUILD AI PROMPT ================= */

    const userPrompt = `
## USER FINANCIAL DATA

${JSON.stringify(userContext, null, 2)}

## USER QUESTION
${query}

## INSTRUCTIONS
- Analyze the data above to answer the question
- Use markdown formatting with headings, bold, and bullets
- Keep response concise and mobile-friendly
- For long lists, show top 20 max and offer to show more
- Be conversational, helpful, and encouraging
- Never mention database IDs or internal technical details
- Refer to friends and groups by their names
`;

    /* ================= CALL AI WITH AUTO-FALLBACK ================= */

    // Recursive helper function to call AI with model fallback
    async function callAIWithFallback(userPrompt, attempt = 1) {
      // Reset model to primary at the start of a new day
      const today = new Date().toDateString();
      if (today !== lastSwitchDate) {
        activeModel = "llama-3.3-70b-versatile";
        triedFallbackToday = false;
        lastSwitchDate = today;
        console.log("🔄 New day - reset to llama-3.3-70b-versatile (Groq)");
      }

      try {
        if (activeModel.startsWith("llama") || activeModel.startsWith("mixtral") || activeModel.startsWith("gemma")) {
          // CALL GROQ
          console.log(`🚀 Calling Groq with model: ${activeModel}`);
          const chatCompletion = await groq.chat.completions.create({
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: userPrompt }
            ],
            model: activeModel,
            temperature: 0.1, // Keep it precise for financial data
            max_tokens: 1024,
            top_p: 1,
            stream: false,
          });

          const answer = chatCompletion.choices[0]?.message?.content;
          if (!answer) throw new Error("Empty response from Groq");

          console.log(`✅ AI Response generated using Groq (${activeModel})`);
          return { answer, modelUsed: activeModel };
        } else {
          // CALL GEMINI (Fallback)
          console.log(`🚀 Calling Gemini with model: ${activeModel}`);
          const model = genAI.getGenerativeModel({
            model: activeModel,
            systemInstruction: SYSTEM_PROMPT
          });

          const result = await model.generateContent(userPrompt);
          const answer = result.response.text();

          console.log(`✅ AI Response generated using Gemini (${activeModel})`);
          return { answer, modelUsed: activeModel };
        }

      } catch (err) {
        console.error(`❌ AI error on ${activeModel}:`, err.message);

        // Handle Groq Quota/Error (Switch to Gemini)
        if (activeModel.startsWith("llama") || activeModel.startsWith("mixtral")) {
          console.log("⚠️ Groq issue detected. Switching to Gemini fallback...");
          activeModel = "gemini-2.5-flash";
          triedFallbackToday = true;
          return callAIWithFallback(userPrompt, attempt + 1);
        }

        // Handle Gemini Quota
        if ((err.status === 429 || err.message?.includes('quota'))) {
          if (activeModel === "gemini-2.5-flash" && !triedFallbackToday) {
            console.log("⚠️ gemini-2.5-flash quota exceeded. Switching to gemini-2.5-pro...");
            activeModel = "gemini-2.5-pro";
            triedFallbackToday = true;
            return callAIWithFallback(userPrompt, attempt + 1);
          } else {
            console.log("⚠️ All quotas exhausted.");
            activeModel = "llama-3.3-70b-versatile"; // reset for next request
            throw err;
          }
        }

        throw err;
      }
    }

    // Call the AI with fallback logic
    const { answer, modelUsed } = await callAIWithFallback(userPrompt);

    // ✅ Increment usage ONLY AFTER successful response
    const finalCount = currentCount + 1;
    await User.updateOne(
      { _id: userId },
      {
        $set: {
          "aiChatUsage.count": finalCount,
          "aiChatUsage.lastUsed": new Date()
        }
      }
    );

    return res.json({
      answer,
      usageCount: finalCount,
      modelUsed
    });

  } catch (error) {
    console.error("❌ FairFare AI Error:", error);

    // Check if it's a quota exceeded error
    if (error.status === 429 || error.message?.includes('quota')) {
      return res.status(429).json({
        answer: `## 🚫 Service Temporarily Unavailable

There is a problem from our end. Please try again later.

Sorry for the inconvenience! 🙏`,
        errorType: 'UNEXPECTED_ERROR'
      });
    }

    // Check if it's a network/API error
    if (error.status === 500 || error.status === 503) {
      return res.status(503).json({
        answer: `## ⚠️ AI Service Temporarily Down

The AI service is experiencing technical difficulties.

**What happened?**
The Gemini AI servers are temporarily unavailable or overloaded.

**What can you do?**
- Wait a few minutes and try again
- The rest of FairFare works normally!
- Your data is safe and secure

We apologize for the inconvenience! 🙏`,
        errorType: 'SERVICE_ERROR'
      });
    }

    // Generic error (don't expose technical details to users)
    console.error('Full error details:', error.message || error);

    return res.status(500).json({
      answer: `## 😕 Something Went Wrong

We encountered an unexpected error while processing your request. Please try again later.

If this keeps happening, please contact support! 🙏`,
      errorType: 'UNKNOWN_ERROR'
    });
  }
}


// Models ordered by preference: cheapest/fastest first, heavier fallbacks last
const MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-2.0-flash",
  "gemini-2.5-flash",
  "gemini-flash-latest",
  "gemini-1.5-flash",
  "gemini-1.5-flash-latest",
];


// ---------------------------------------------------------------------------
// Helper: decide whether an error is retryable (next model should be tried)
// ---------------------------------------------------------------------------
function isRetryableError(err) {
  const msg = (err.message || "").toLowerCase();
  const status = err.status || err.httpStatusCode || 0;

  if (status === 429 || msg.includes("429") || msg.includes("too many requests")) return true;
  if (status === 503 || msg.includes("503") || msg.includes("unavailable")) return true;
  if (status === 404 || msg.includes("404") || msg.includes("not found")) return true;
  if (msg.includes("quota") || msg.includes("resource_exhausted") || msg.includes("exhausted")) return true;
  if (msg.includes("rate limit") || msg.includes("rate_limit")) return true;

  return false;
}

// Extract a short human-readable reason from a verbose Google API error
function shortErrorReason(err) {
  const msg = (err.message || "").toLowerCase();
  const status = err.status || err.httpStatusCode || 0;
  if (status === 429 || msg.includes("429") || msg.includes("quota")) return "429 quota";
  if (status === 503 || msg.includes("503")) return "503 unavailable";
  if (status === 404 || msg.includes("404") || msg.includes("not found")) return "404 not found";
  if (msg.includes("rate limit")) return "rate limited";
  return msg.slice(0, 60);
}

// ---------------------------------------------------------------------------
// Build the system prompt. Works for all three contexts.
// ---------------------------------------------------------------------------
function buildSystemPrompt({ context, groupList, memberNames }) {
  // Base instruction (always present)
  let prompt = `You are an AI expense parser for the "FairFare" app.
Your task is to extract expense details from a natural language voice transcript.
Return ONLY a valid JSON object — no markdown, no code fences, no explanation.

Fields to extract:
- "amount" (Number) — the monetary amount. REQUIRED. If you can't find one, set to null.
- "title" (String) — a short, clear description of the expense (e.g. "Dinner", "Uber ride"). REQUIRED.
`;

  // Group-related fields (only when relevant)
  if (context !== "personal") {
    if (groupList && groupList.length > 0) {
      prompt += `
- "groupId" (String|null) — match the mentioned group to this list and return the id. If no group is mentioned or no match, return null.
  Available Groups: ${JSON.stringify(groupList)}
`;
    } else {
      prompt += `- "groupId": null (no groups available)\n`;
    }
  }

  // Detailed group fields (addExpense page)
  if (context === "group_detailed") {
    prompt += `
- "paidBy" (String|null) — who paid. Return "current_user" if the speaker says "I", "me", or "I paid". Otherwise return the person's name as spoken. null if not mentioned.
- "splitMode" (String|null) — "equally" or "unequally". Default null if not mentioned.
- "splitWith" (Array|null) — list of names to split with, or ["ALL"] / ["everyone"] if they say "everyone" / "all". null if not mentioned.
- "splitDetails" (Array|null) — for unequal splits only: [{"name": "...", "amount": ...}]. null if not applicable.
`;
    if (memberNames && memberNames.length > 0) {
      prompt += `  Known group members: ${JSON.stringify(memberNames)}\n`;
    }
  }

  // Output format example based on context
  if (context === "personal") {
    prompt += `
Expected JSON format:
{
  "amount": 500,
  "title": "Groceries"
}`;
  } else if (context === "group_detailed") {
    prompt += `
Expected JSON format:
{
  "amount": 500,
  "title": "Dinner",
  "groupId": "id_or_null",
  "paidBy": "current_user",
  "splitMode": "equally",
  "splitWith": ["ALL"],
  "splitDetails": null
}`;
  } else {
    // group_quick or default
    prompt += `
Expected JSON format:
{
  "amount": 500,
  "title": "Dinner",
  "groupId": "matching_id_or_null"
}`;
  }

  return prompt;
}

// ---------------------------------------------------------------------------
// Main controller: POST /ai/parse-expense
// ---------------------------------------------------------------------------
export const parseExpensePrompt = async (req, res) => {
  try {
    // 1. Normalise input — accept both "prompt" and "text" from frontends
    const prompt = req.body.prompt || req.body.text;
    const userId = req.body.userId || req.user?._id || req.user?.id;
    const context = req.body.context || "group_quick"; // personal | group_quick | group_detailed
    const memberNames = req.body.memberNames || [];

    if (!prompt) {
      return res.status(400).json({ message: "Prompt/text is required" });
    }

    // 2. Fetch user's groups for context (only for group contexts)
    let groupList = [];
    if (context !== "personal" && userId) {
      try {
        const userGroups = await Group.find({ members: userId }).select("name _id");
        groupList = userGroups.map((g) => ({ name: g.name, id: g._id }));
      } catch (dbErr) {
        console.warn("Could not fetch user groups for AI context:", dbErr.message);
        // Non-fatal — continue without group list
      }
    }

    // 3. Build the system prompt
    const systemPrompt = buildSystemPrompt({ context, groupList, memberNames });

    // 4. Try models in order — skip to next on retryable errors
    let lastError = null;

    for (const modelName of MODELS) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent([
          systemPrompt,
          `User voice transcript: "${prompt}"`,
        ]);

        const responseText = result.response.text().trim();
        const cleanJson = responseText
          .replace(/```json/gi, "")
          .replace(/```/g, "")
          .replace(/^JSON\s*/i, "")
          .trim();

        let parsedData;
        try {
          parsedData = JSON.parse(cleanJson);
        } catch (_jsonErr) {
          // Fallback: regex extraction for malformed JSON
          const amountMatch = cleanJson.match(/"amount"\s*:\s*(\d+(?:\.\d+)?)/);
          const titleMatch = cleanJson.match(/"title"\s*:\s*"([^"]+)"/);
          const groupMatch = cleanJson.match(/"groupId"\s*:\s*"([^"]+)"/);
          const paidByMatch = cleanJson.match(/"paidBy"\s*:\s*"([^"]+)"/);
          const splitModeMatch = cleanJson.match(/"splitMode"\s*:\s*"([^"]+)"/);

          parsedData = {
            amount: amountMatch ? Number(amountMatch[1]) : null,
            title: titleMatch ? titleMatch[1] : "Expense",
            groupId: groupMatch ? groupMatch[1] : null,
          };

          if (context === "group_detailed") {
            parsedData.paidBy = paidByMatch ? paidByMatch[1] : null;
            parsedData.splitMode = splitModeMatch ? splitModeMatch[1] : null;
            parsedData.splitWith = null;
            parsedData.splitDetails = null;
          }
        }

        // Success — send response and return
        console.log(`✅ NLP model used: "${modelName}" for prompt: "${prompt}"`);
        return res.status(200).json(parsedData);
      } catch (modelErr) {
        lastError = modelErr;

        if (isRetryableError(modelErr)) {
          console.warn(`⚡ Skipping "${modelName}" (${shortErrorReason(modelErr)})`);
          continue;
        }
        // Non-retryable error — log full detail and break
        console.error(`Model "${modelName}" failed (non-retryable):`, modelErr.message);
        break;
      }
    }

    // All models exhausted or non-retryable error
    console.error(`All ${MODELS.length} AI models failed. Reason: ${shortErrorReason(lastError)}`);
    return res.status(503).json({
      message: "AI service is temporarily unavailable. Please try again in a moment.",
      error: lastError?.message || "All models exhausted",
    });
  } catch (error) {
    console.error("AI Parsing Error:", error);
    return res.status(500).json({
      message: "Failed to parse expense with AI",
      error: error.message,
    });
  }
};
