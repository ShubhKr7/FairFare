<div align="center">

# 💰 FairFare - Split Expenses Made Simple

<p align="center">
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Express.js-404D59?style=for-the-badge&logo=express&logoColor=white" alt="Express" />
  <img src="https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB" />
  <img src="https://img.shields.io/badge/TailwindCSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind" />
</p>

<p align="center">
  <strong>A modern, feature-rich expense splitting application that helps friends and groups manage shared expenses effortlessly.</strong>
</p>

[Features](#-features) • [Tech Stack](#-tech-stack) • [Installation](#-installation) • [Usage](#-usage) • [API Documentation](#-api-documentation) • [Contributing](#-contributing)

</div>

---

## ✨ Features

### 🤝 Friend Management
- **Friend Requests System** - Send and receive friend requests with real-time notifications
- **Search Users** - Find friends by username with instant search
- **Public Profiles** - View friend profiles with QR codes for easy sharing
- **Email Invitations** - Invite non-users via email

### 💸 Expense Tracking
- **Split Expenses** - Divide costs among friends or group members
- **Transaction History** - View detailed transaction logs with timestamps
- **Balance Tracking** - Real-time balance updates between friends
- **Settlement Reminders** - Send payment reminders via push notifications
- **Multiple Categories** - Organize expenses by category and subcategory

### 👥 Group Management
- **Create Groups** - Set up groups for trips, events, or shared living
- **Group Expenses** - Track shared expenses within groups
- **Member Management** - Add/remove members from groups
- **Group Analytics** - Visualize group spending patterns

### 📊 Analytics & Insights
- **Spending Analytics** - Interactive charts and graphs
- **Category Breakdown** - See where your money goes
- **Time-based Filtering** - View expenses by day, week, month, or custom range
- **Export Data** - Download transaction history

### 🔔 Smart Notifications
- **Push Notifications** - Real-time updates via Firebase Cloud Messaging
- **Payment Reminders** - Gentle nudges for unsettled balances
- **Friend Request Alerts** - Instant notifications for new requests
- **Expense Updates** - Get notified when expenses are added

### 🤖 AI Assistant
- **FAIR AI** - AI chatbot to help with expense queries
- **Natural Language Processing** - Ask questions about your spending
- **Usage Limits** - Fair usage policy with daily limits

### 🔐 Security & Privacy
- **JWT Authentication** - Secure user sessions
- **Password Hashing** - bcrypt encryption for passwords
- **Email Verification** - OTP-based email verification
- **Password Recovery** - Secure password reset flow

### 🎨 Modern UI/UX
- **Responsive Design** - Works seamlessly on mobile and desktop
- **Dark Theme** - Eye-friendly dark mode interface
- **Smooth Animations** - Framer Motion powered transitions
- **Toast Notifications** - User-friendly feedback messages
- **Profile Photos** - Cloudinary-powered image uploads

---

## 🛠 Tech Stack

### Frontend
- **React 18** - UI library
- **React Router DOM** - Client-side routing
- **TailwindCSS** - Utility-first CSS framework
- **Framer Motion** - Animation library
- **React Hot Toast** - Toast notifications
- **Lucide React** - Icon library
- **React Icons** - Additional icons
- **Axios** - HTTP client
- **React Window** - Virtualized lists
- **Vite** - Build tool

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - NoSQL database
- **Mongoose** - MongoDB ODM
- **JWT** - Authentication tokens
- **bcrypt** - Password hashing
- **Cloudinary** - Image storage
- **Firebase Admin** - Push notifications
- **Google Gemini AI** - AI chatbot integration
- **Multer** - File uploads
- **CORS** - Cross-origin resource sharing

---

## 🚀 Installation

### Prerequisites
- Node.js (v16 or higher) or Docker Desktop (Recommended)
- MongoDB (local or Atlas)
- npm or yarn (if not using Docker)

### Setup Instructions

#### Option A: Running with Docker (Recommended)

To run the application inside Docker containers (avoiding local machine node version mismatches), follow these simple steps:

> [!IMPORTANT]
> Make sure that **Docker Desktop** is launched and running on your PC before executing the build command.

1. **Launch Containers**
   From the root repository directory (`SplitWise`), run:
   ```bash
   docker compose up --build
   ```
   This single command builds and starts the backend and frontend services in isolated containers, using virtual volumes to support **real-time hot-reloading**.

2. **Access the application**
   - Frontend: `http://localhost:5173` (with HMR enabled)
   - Backend: `http://localhost:8000` (with nodemon hot-reloading enabled)

---

#### Option B: Local Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/HarshPathak11/SplitWise.git
   cd SplitWise
   ```

2. **Install dependencies**

   Using the root-level concurrent script:
   ```bash
   npm install
   npm run dev
   ```

   Or manually:
   ```bash
   # Backend
   cd backend
   npm install
   npm start

   # Frontend (in a new terminal)
   cd frontend
   npm install
   npm run dev
   ```

3. **Access the application**
   - Frontend: `http://localhost:5173`
   - Backend: `http://localhost:8000`

---

## 📱 Usage

### Getting Started

1. **Sign Up**
   - Create an account with email and password
   - Verify your email with OTP

2. **Add Friends**
   - Search for friends by username
   - Send friend requests
   - Invite via email if they're not on the platform

3. **Create Expenses**
   - Add individual expenses with friends
   - Or create groups for shared expenses
   - Categorize your spending

4. **Track Balances**
   - View who owes you and who you owe
   - Send payment reminders
   - Settle balances with one click

5. **Analyze Spending**
   - View analytics by category
   - Filter by time period
   - Export transaction history

---

## 📚 API Documentation

### Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/user/register` | Register new user |
| POST | `/user/verify-otp` | Verify email OTP |
| POST | `/user/login` | User login |
| POST | `/user/forgot-password` | Request password reset |
| POST | `/user/verify-forgot-password` | Verify reset OTP |
| POST | `/user/change-password` | Change password |

### User Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/user/:id` | Get user details |
| PUT | `/user/:id` | Update user profile |
| POST | `/user/upload-profile-photo/:id` | Upload profile photo |

### Friend Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/user/friend-requests/send` | Send friend request |
| GET | `/user/friend-requests/:userId` | List friend requests |
| POST | `/user/friend-requests/respond` | Accept/deny request |
| POST | `/user/remove-friend` | Remove friend |
| POST | `/user/update-friend-balance` | Update balance |

### Expense Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/expenses/:userId/:friendId` | Get transaction history |
| POST | `/user/expenses-by-subcategory` | Filter by category |
| GET | `/user/expenses/:userId` | Get all user expenses |

### Group Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/group/create` | Create new group |
| GET | `/group/get-group/:id` | Get group details |
| POST | `/group/add-expense` | Add group expense |
| POST | `/group/add-members/:id` | Add members |
| POST | `/group/remove-members/:id` | Remove members |

---

## 🎯 Project Structure

```
splitwise/
├── backend/
│   ├── controllers/        # Request handlers
│   ├── models/            # Database schemas
│   ├── routes/            # API routes
│   ├── middleware/        # Custom middleware
│   ├── utils/             # Helper functions
│   └── index.js           # Entry point
│
├── frontend/
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── utils/         # Utility functions
│   │   ├── App.jsx        # Main app component
│   │   └── main.jsx       # React entry point
│   └── public/            # Static assets
│
└── README.md
```

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 🙏 Acknowledgments

- Icons from [Lucide](https://lucide.dev/) and [React Icons](https://react-icons.github.io/react-icons/)
- UI inspiration from modern fintech apps
- Community feedback and contributions

---

## 📞 Support

For support, email fairfare007@gmail.com

---

<div align="center">

**⭐ Star this repo if you find it helpful!**

Made with ❤️ by the FairFare Team

</div>