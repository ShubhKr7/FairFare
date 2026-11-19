/* eslint-disable react/prop-types */
import { Link } from "react-router-dom";
import { UserPlus, Users, Banknote } from "lucide-react";
import { guardOfflineAction } from "../utils/offlineGuard";

const QuickActions = ({ onQuickExpenseClick }) => {
  return (
    <div className="w-full bg-zinc-900/30 backdrop-blur-sm border border-white/5 rounded-2xl py-2 px-3 mb-2 flex items-center justify-between shadow-lg">
      <div className="flex w-full items-center justify-between gap-2">
        {/* Action 1: Add Expense */}
        <button
          onClick={(event) => {
            if (guardOfflineAction(event)) onQuickExpenseClick();
          }}
          className="flex-1 flex items-center justify-center gap-2 py-2 px-2 sm:px-4 rounded-xl hover:bg-white/5 transition-all text-zinc-400 hover:text-white group"
        >
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-all duration-300">
            <Banknote className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <span className="text-[10px] sm:text-xs font-medium">+Expense</span>
        </button>

        {/* Divider */}
        <div className="h-6 w-px bg-white/10" />

        {/* Action 2: Add Friend */}
        <Link
          to="/addFriend"
          onClick={(event) => {
            guardOfflineAction(event);
          }}
          aria-disabled={typeof navigator !== "undefined" && !navigator.onLine}
          className="flex-1 flex items-center justify-center gap-2 py-2 px-2 sm:px-4 rounded-xl hover:bg-white/5 transition-all text-zinc-400 hover:text-white group"
        >
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-300">
            <UserPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <span className="text-[10px] sm:text-xs font-medium">+Friend</span>
        </Link>

        {/* Divider */}
        <div className="h-6 w-px bg-white/10" />

        {/* Action 3: New Group */}
        <Link
          to="/addTrip"
          onClick={(event) => {
            guardOfflineAction(event);
          }}
          aria-disabled={typeof navigator !== "undefined" && !navigator.onLine}
          className="flex-1 flex items-center justify-center gap-2 py-2 px-2 sm:px-4 rounded-xl hover:bg-white/5 transition-all text-zinc-400 hover:text-white group"
        >
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400 group-hover:bg-purple-500 group-hover:text-white transition-all duration-300">
            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <span className="text-[10px] sm:text-xs font-medium">+Group</span>
        </Link>
      </div>
    </div>
  );
};

export default QuickActions;
