import ExpenseCard from "./expenseCard"; // Make sure this path is correct based on your folder structure
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";

const RecentExpenses = (user) => {
  const [recentExpenses, setRecentExpenses] = useState([]);

  useEffect(() => {
    if (user) {
      try {
        const parsedUser = user?.user;

        if (
          parsedUser?.recentExpense &&
          Array.isArray(parsedUser.recentExpense)
        ) {
          // Sort expenses by createdAt in descending order (most recent first)
          const sortedExpenses = [...parsedUser.recentExpense].sort(
            (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
          );
          // Take the top 4 expenses after sorting.
          const topExpenses = sortedExpenses.slice(0, 3);
          setRecentExpenses(topExpenses);
        }
      } catch (error) {
        console.error("Error parsing user from localStorage:", error);
      }
    }
  }, [user]);

  return (
    <div className="flex flex-col bg-transparent">
      {/* --- Header --- */}
      <div className="flex justify-between items-center mb-4 md:mb-6">
        <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
          Recent Expenses
        </h2>
<div className="flex items-center gap-3 md:gap-4">
        <Link to="/allExpenses">
          <button
            type="button"
            className="text-xs font-medium text-zinc-400 hover:text-white transition-colors flex items-center gap-1 group py-1"
          >
            View All
            <span className="hidden sm:inline-block group-hover:translate-x-0.5 transition-transform">
              →
            </span>
          </button>
        </Link>

        <Link to="/personal-expenses">
          <button
            type="button"
            className="w-9 h-9 md:w-8 md:h-8 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center transition-all shadow-lg shadow-indigo-500/20 hover:scale-105 active:scale-95"
            title="Add personal expense"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 md:h-4 md:w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4v16m8-8H4"
              />
            </svg>
          </button>
        </Link>
        </div>
      </div>

      {/* --- Expenses List --- */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 -mr-1 space-y-3 custom-scrollbar">
        {recentExpenses && recentExpenses.length > 0 ? (
          recentExpenses.map((expense, index) => (
            <ExpenseCard
              key={expense?.id || expense?._id || index}
              title={expense?.title}
              description={expense?.description}
              category={expense?.category}
              subcategory={expense?.subcategory}
              time={expense?.createdAt}
              amount={expense?.amount}
              // Updated to match theme
              iconColor={"bg-indigo-500"}
              paidBy={expense?.paidBy}
              beneficiaries={expense?.owedBy}
              isPersonal={!expense?.group}
            />
          ))
        ) : (
          /* --- Empty State --- */
          <div className="h-32 md:h-40 flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 rounded-xl bg-zinc-900/30 text-center p-4">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-zinc-800 flex items-center justify-center mb-2 md:mb-3">
              <svg
                className="w-4 h-4 md:w-5 md:h-5 text-zinc-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <p className="text-sm text-zinc-400 font-medium">
              No recent transactions
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecentExpenses;
