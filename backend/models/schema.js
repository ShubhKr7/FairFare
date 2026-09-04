import mongoose from "mongoose";
import bcrypt from "bcrypt";

//Expense Schema
const expenseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    amount: { type: Number, required: true },
    category: { type: String, default: null, index: true },
    subcategory: { type: String, default: null, index: true },
    date: { type: Date, default: Date.now },
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    owedBy: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        amount: { type: Number, required: true },
      },
    ],
    group: { type: mongoose.Schema.Types.ObjectId, ref: "Group" }, // optional, if expense is part of a group
  },
  { timestamps: true }
);

// Group schema
const groupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
    from: { type: Date },
    to: { type: Date },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    tripTotal: { type: Number, default: 0 },
    expenses: [{ type: mongoose.Schema.Types.ObjectId, ref: "Expense" }],
    hiddenBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // users who archived this group
    bannerUrl: { type: String, default: null }, // secure_url from Cloudinary
    bannerId: { type: String, default: null }, // public_id used for deletion
  },
  { timestamps: true }
);

// Friend Request Schema
const friendRequestSchema = new mongoose.Schema(
  {
    from: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    to: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

// User schema
const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    legalAgreements: [
      {
        version: { type: String, required: true },
        documentId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Terms",
          required: true,
        },
        agreedAt: { type: Date, default: Date.now },
      },
    ],
    googleId: { type: String, default: null },
    authProvider: { type: String, enum: ['local', 'google'], default: 'local' },
    password: { type: String, required: true, select: false },
    fcmToken: { type: String, default: null },
    friends: [
      {
        friend: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        balance: { type: Number, default: 0 },
      },
    ],
    requests: { type: Number, default: 0 },
    groups: [{ type: mongoose.Schema.Types.ObjectId, ref: "Group" }],
    recentExpense: [{ type: mongoose.Schema.Types.ObjectId, ref: "Expense" }],
    upiId: { type: String },
    aiChatUsage: {
      count: { type: Number, default: 0 },
      lastUsed: { type: Date, default: null },
    },
    profilePhotoUrl: { type: String, default: null }, // secure_url from Cloudinary
    profilePhotoId: { type: String, default: null }, // public_id used for deletion
    lastActive: { type: Date, default: null },
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Do not disclose'],
      // default: 'Do not disclose' // Removed default to force selection
    },
  },
  { timestamps: true }
);

//Label schema
const LabelCategorySchema = new mongoose.Schema({
  label: { type: String, unique: true, index: true },
  category: String,
  subcategory: String,
},
  { timestamps: true });

const UserFinancialSnapshotSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    unique: true,
    index: true,
    required: true
  },

  profile: {
    username: String,
    groupsCount: Number,
    upiLinked: Boolean
  },

  friends: [
    {
      friendId: mongoose.Schema.Types.ObjectId,
      friendName: String,
      netBalance: { type: Number, default: 0 }
    }
  ],

  groups: [
    {
      groupId: mongoose.Schema.Types.ObjectId,
      yourTotalSpend: { type: Number, default: 0 },
      groupTotal: { type: Number, default: 0 },
      topCategory: String,
      groupName: String,

      // Optional but powerful
      categoryTotals: {
        type: Map,
        of: Number,
        default: {}
      }
    }
  ],

  spending: {
    totalSpend: { type: Number, default: 0 },
    categoryTotals: {
      type: Map,
      of: Number,
      default: {}
    }
  },

  trends: {
    monthlyTotal: { type: Number, default: 0 },
    lastMonthTotal: { type: Number, default: 0 }
  },

  version: { type: Number, default: 1 },
  lastUpdated: { type: Date, default: Date.now }

}, { timestamps: true });

// Terms Schema
const termsSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["terms", "privacy"], required: true },
    version: { type: String, required: true },
    content: { type: String, required: true }, // Markdown content
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
    },
    isActive: { type: Boolean, default: false },
    publishedAt: { type: Date, default: null }, // When the document was published
  },
  { timestamps: true }
);

// Password hashing middleware
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

// Notification schema
const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    type: {
      type: String,
      enum: [
        "friend_request",
        "friend_added",
        "expense_added",
        "payment_received",
        "payment_reminder",
        "group_invite",
        "expense_edited",
        "expense_deleted",
        "group_expense_added",
      ],
      required: true,
    },
    message: { type: String, required: true },
    referenceId: { type: mongoose.Schema.Types.ObjectId }, // expenseId / groupId etc
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isRead: 1 });

expenseSchema.index({ paidBy: 1, "owedBy.user": 1 });

const Expense = mongoose.model("Expense", expenseSchema);
const User = mongoose.model("User", userSchema);
const Group = mongoose.model("Group", groupSchema);
const FriendRequest = mongoose.model("FriendRequest", friendRequestSchema);
const LabelCategory = mongoose.model("LabelCategory", LabelCategorySchema);
const Notification = mongoose.model("Notification", notificationSchema);
const UserFinancialSnapshot = mongoose.model(
  "UserFinancialSnapshot",
  UserFinancialSnapshotSchema
);

const Terms = mongoose.model("Terms", termsSchema);

export { User, Group, Expense, FriendRequest, LabelCategory, Terms, Notification, UserFinancialSnapshot };
