import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import Cookie from "js-cookie";
import {
  Calendar,
  TrendingUp,
  Receipt,
  Search,
  Filter,
  ArrowLeft,
  Clock,
  CreditCard,
  Users,
  Layers,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "react-hot-toast";
import api from "../utils/api";

const handleScrollTop = () => {
  window.scrollTo({
    top: 0,
    left: 0,
    behavior: "smooth",
  });
};
import { motion, AnimatePresence } from "framer-motion";

export default function Expenses() {
  const location = useLocation();
  const navigate = useNavigate();
  const { category, subcategory, timeframe, startDate, endDate } =
    location.state || {};
  const userId = Cookie.get("id");
  const API_BASE = import.meta.env.VITE_API_BASE_URL;
  const group = location?.state?.group;

  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [expandedExpenseId, setExpandedExpenseId] = useState(null);
  const [deleteOverlay, setDeleteOverlay] = useState(null); // null | 'success' | 'error'

  useEffect(() => {
    handleScrollTop();
  }, []);

  useEffect(() => {
    if (!userId) return;

    const fetchExpenses = async () => {
      setLoading(true);
      try {
        if (group) {
          const response = await api.post(
            `${API_BASE}/group/expenses-by-subcategory`,
            {
              category: category,
              groupId: group._id,
              subcategory: subcategory,
              ...(startDate && { startDate, endDate }),
            }
          );
          setExpenses(response.data.expenses);
        } else {
          const response = await api.post(
            `${API_BASE}/user/expenses-by-subcategory`,
            {
              userId,
              category: category,
              subcategory: subcategory,
              ...(startDate && { startDate, endDate }),
            }
          );
          setExpenses(response.data.expenses || []);
        }
      } catch (error) {
        console.error("Error fetching expenses:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchExpenses();
  }, [userId, category, subcategory, API_BASE, startDate, endDate]);

  const handleDelete = async (id, isPersonal) => {
    if (!window.confirm("Are you sure you want to delete this transaction?")) return;
    try {
      const deleteUrl = isPersonal 
        ? `${API_BASE}/expenses/personal/${id}`
        : `${API_BASE}/group/del-expense/${id}`;
      
      await api.delete(deleteUrl);
      setExpenses(prev => prev.filter(e => e._id !== id));
      setDeleteOverlay('success');
      
      setTimeout(() => {
        setDeleteOverlay(null);
      }, 2000);
    } catch (err) {
      console.error(err);
      setDeleteOverlay('error');
    }
  };

  const handleEdit = (exp) => {
    const isPersonal = !exp.group;
    if (isPersonal) {
      navigate("/personal-expense/edit", { state: { originalExpense: { ...exp, time: exp.createdAt } } });
    } else {
      navigate("/expense/edit", { state: { originalExpense: exp } });
    }
  };

  const filteredExpenses = expenses
    .filter((exp) => exp.title.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "date") {
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      } else if (sortBy === "amount-high") {
        return b.amount - a.amount;
      } else if (sortBy === "amount-low") {
        return a.amount - b.amount;
      }
      return 0;
    });

  // ✅ Calculate total only for the current user’s owed amounts
  const totalAmount = filteredExpenses.reduce((sum, exp) => {
    const owedEntry = exp.owedBy?.find(
      (o) => o.user?._id === userId || o.user === userId
    );
    return sum + (owedEntry?.amount || 0);
  }, 0);

  // ✅ Average based on how many expenses involve this user
  const userExpenses = filteredExpenses.filter((exp) =>
    exp.owedBy?.some((o) => o.user?._id === userId || o.user === userId)
  );

  const averageAmount =
    userExpenses.length > 0 ? totalAmount / userExpenses.length : 0;

  const getTimePeriodLabel = () => {
    if (!timeframe || timeframe === "all") return "All Time";
    if (timeframe === "day") return "Today";
    if (timeframe === "week") return "This Week";
    if (timeframe === "month") return "This Month";
    if (timeframe === "custom" && startDate && endDate) {
      return `${new Date(startDate).toLocaleDateString()} - ${new Date(
        endDate
      ).toLocaleDateString()}`;
    }
    return "All Time";
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-indigo-500/30 relative overflow-hidden p-4 sm:p-6 lg:p-8">
      {/* --- BACKGROUND FX: Deep Space Atmosphere --- */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-20%] right-[20%] w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] animate-pulse-slow"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-cyan-600/10 rounded-full blur-[100px]"></div>
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03]"></div>
      </div>

      <div className="relative z-10 max-w-5xl mx-auto">
        {/* --- HEADER --- */}
        <div className="flex items-center gap-4 mb-6">
          <button 
            onClick={() => navigate(-1)}
            className="group p-3 rounded-full bg-zinc-900/50 border border-white/10 hover:border-indigo-500/50 hover:bg-indigo-500/10 transition-all duration-300 backdrop-blur-md shadow-lg"
          >
            <ArrowLeft className="w-5 h-5 text-zinc-400 group-hover:text-indigo-400 transition-colors" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight uppercase flex items-center gap-3">
              {subcategory || "Expenses Protocol"}
            </h1>
            <p className="text-xs text-zinc-500 font-mono tracking-wider uppercase mt-1">
              TRANSACTION LOGS // DETAILED VIEW
            </p>
          </div>
        </div>

        {/* --- TIMEFRAME BADGE --- */}
        {timeframe && timeframe !== "all" && (
          <div className="mb-8 flex items-center gap-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-4 py-3 w-fit animate-in fade-in slide-in-from-left-4">
            <Calendar size={16} className="text-indigo-400" />
            <span className="text-indigo-200 text-xs font-mono font-bold uppercase tracking-wide">
              Temporal Filter Active:{" "}
              <span className="text-white">{getTimePeriodLabel()}</span>
            </span>
          </div>
        )}

        {/* --- TELEMETRY GRID (Stats) --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* Total Share */}
          <div className="relative overflow-hidden bg-zinc-900/40 border border-white/5 rounded-2xl p-5 hover:border-indigo-500/30 transition-colors group">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="text-indigo-400" size={18} />
              <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">
                Your Total Share
              </p>
            </div>
            <p className="text-white text-2xl sm:text-3xl font-black font-mono tracking-tight">
              ₹{totalAmount.toLocaleString()}
            </p>
          </div>

          {/* Count */}
          <div className="relative overflow-hidden bg-zinc-900/40 border border-white/5 rounded-2xl p-5 hover:border-fuchsia-500/30 transition-colors group">
            <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-center gap-2 mb-2">
              <Receipt className="text-fuchsia-400" size={18} />
              <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">
                Total Entries
              </p>
            </div>
            <p className="text-white text-2xl sm:text-3xl font-black font-mono tracking-tight">
              {filteredExpenses.length}
            </p>
          </div>

          {/* Average */}
          <div className="relative overflow-hidden bg-zinc-900/40 border border-white/5 rounded-2xl p-5 hover:border-cyan-500/30 transition-colors group">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="text-cyan-400" size={18} />
              <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">
                Mean Value
              </p>
            </div>
            <p className="text-white text-2xl sm:text-3xl font-black font-mono tracking-tight">
              ₹{Math.round(averageAmount).toLocaleString()}
            </p>
          </div>
        </div>

        {/* --- QUERY CONTROLS (Search & Filter) --- */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1 group">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-indigo-400 transition-colors"
              size={18}
            />
            <input
              type="text"
              placeholder="Search Expense"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-xl bg-zinc-900/60 border border-white/10 text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all font-mono text-sm"
            />
          </div>
          <div className="relative sm:w-56 group">
            <Filter
              className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-indigo-400 transition-colors z-10 pointer-events-none"
              size={18}
            />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full appearance-none pl-12 pr-10 py-3 rounded-xl bg-zinc-900/60 border border-white/10 text-white focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all cursor-pointer font-mono text-sm uppercase"
            >
              <option value="date">Latest Sequence</option>
              <option value="amount-high">Value (High-Low)</option>
              <option value="amount-low">Value (Low-High)</option>
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
              <svg
                width="10"
                height="10"
                viewBox="0 0 10 10"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M1 3L5 7L9 3"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* --- DATA STREAM (List) --- */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center space-y-4">
              <div className="w-12 h-12 border-2 border-zinc-800 border-t-indigo-500 rounded-full animate-spin mx-auto"></div>
              <p className="text-zinc-500 font-mono text-xs animate-pulse">
                FETCHING RECORDS...
              </p>
            </div>
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-white/10 rounded-3xl bg-zinc-900/20">
            <div className="w-16 h-16 bg-zinc-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search size={32} className="text-zinc-600" />
            </div>
            <p className="text-zinc-300 font-bold text-lg uppercase tracking-wide">
              No Matches Found
            </p>
            <p className="text-zinc-600 text-sm mt-2 font-mono">
              {searchTerm ? "ADJUST QUERY PARAMETERS" : "AWAITING NEW INPUTS"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredExpenses.map((exp) => {
              const isRecent =
                new Date().getTime() - new Date(exp.createdAt).getTime() <
                86400000;
              const isExpanded = expandedExpenseId === exp._id;

              return (
                <div
                  key={exp._id}
                  onClick={() =>
                    setExpandedExpenseId((prev) =>
                      prev === exp._id ? null : exp._id
                    )
                  }
                  className={`group relative overflow-hidden rounded-xl border transition-all duration-300 cursor-pointer ${
                    isExpanded
                      ? "bg-zinc-900/80 border-indigo-500/30 shadow-[0_0_20px_rgba(99,102,241,0.1)]"
                      : "bg-zinc-900/40 border-white/5 hover:border-indigo-500/20 hover:bg-zinc-900/60"
                  }`}
                >
                  {/* Glowing accent bar on left */}
                  <div
                    className={`absolute left-0 top-0 bottom-0 w-1 transition-colors duration-300 ${
                      isExpanded
                        ? "bg-indigo-500"
                        : "bg-transparent group-hover:bg-indigo-500/50"
                    }`}
                  />

                  <div className="p-4 sm:p-5">
                    {/* Main expense row */}
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0 flex items-center gap-4">
                        {/* Icon Box */}
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center border transition-colors ${
                            isExpanded
                              ? "bg-indigo-500/20 border-indigo-500/30 text-indigo-400"
                              : "bg-zinc-800/50 border-white/5 text-zinc-500 group-hover:text-zinc-300"
                          }`}
                        >
                          <Receipt size={18} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-bold text-base truncate tracking-tight">
                              {exp.title}
                            </span>
                            {isRecent && (
                              <span className="px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded text-emerald-400 text-[10px] font-mono font-bold uppercase">
                                New
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Clock size={12} className="text-zinc-600" />
                            <span className="text-zinc-500 text-xs font-mono">
                              {new Date(exp.createdAt).toLocaleDateString(
                                "en-US",
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                }
                              )}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right ml-4">
                        <span className="text-white font-bold text-xl block font-mono">
                          ₹{exp.amount.toLocaleString()}
                        </span>
                        <span className="text-zinc-600 text-xs font-mono group-hover:text-indigo-400 transition-colors">
                          {((exp.amount / totalAmount) * 100).toFixed(1)}% SHARE
                        </span>
                        
                        <div className="flex items-center gap-2 mt-2 justify-end opacity-100 transition-opacity">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleEdit(exp); }}
                            className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500 hover:text-white transition-all"
                            title="Edit"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(exp._id, !exp.group); }}
                            className="p-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all"
                            title="Delete"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Details Panel */}
                    <div
                      className={`grid transition-all duration-300 ease-in-out overflow-hidden ${
                        isExpanded
                          ? "grid-rows-[1fr] opacity-100 mt-4 pt-4 border-t border-white/5"
                          : "grid-rows-[0fr] opacity-0"
                      }`}
                    >
                      <div className="min-h-0 space-y-3">
                        {/* Paid By */}
                        {exp.paidBy && (
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2 text-zinc-400">
                              <CreditCard size={14} />
                              <span className="text-xs uppercase tracking-wider font-bold">
                                Paid By
                              </span>
                            </div>
                            <span className="text-indigo-300 font-mono">
                              {exp.paidBy.username ||
                                exp.paidBy.name ||
                                "Unknown Entity"}
                            </span>
                          </div>
                        )}

                        {/* Beneficiaries */}
                        {exp.owedBy?.length > 0 && (
                          <div className="flex flex-col gap-2 text-sm">
                            <div className="flex items-center gap-2 text-zinc-400">
                              <Users size={14} />
                              <span className="text-xs uppercase tracking-wider font-bold">
                                Split Targets
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-2 pl-6">
                              {exp.owedBy.map((o, idx) => (
                                <span
                                  key={idx}
                                  className="bg-zinc-950 border border-white/10 rounded px-2 py-1 text-xs text-zinc-300 font-mono"
                                >
                                  {o.user?.username ||
                                    o.user?.name ||
                                    "Unknown"}
                                  <span className="text-zinc-600 ml-1">
                                    ₹{o.amount}
                                  </span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Group */}
                        {exp?.group && (
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2 text-zinc-400">
                              <Layers size={14} />
                              <span className="text-xs uppercase tracking-wider font-bold">
                                Group Link
                              </span>
                            </div>
                            <span className="text-cyan-300 font-mono">
                              {exp.group?.name || "Unassigned"}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Deletion Feedback Overlay */}
      <AnimatePresence>
        {deleteOverlay && (
          <motion.div
            className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-zinc-950/90 backdrop-blur-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {deleteOverlay === 'success' ? (
              <>
                <motion.div
                  className="w-24 h-24 rounded-full border-2 border-red-500/50 flex items-center justify-center mb-6 relative"
                  initial={{ scale: 0, rotate: -45 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", damping: 12 }}
                >
                  <motion.div 
                    className="absolute inset-0 rounded-full bg-red-600/20"
                    animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                  <Trash2 className="w-10 h-10 text-red-500 z-10" />
                </motion.div>
                <motion.h3
                  className="text-2xl font-black text-white uppercase tracking-tighter"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                >
                  Entry Purged 💀
                </motion.h3>
                <motion.p
                   className="text-[10px] text-zinc-500 font-mono tracking-[0.3em] uppercase mt-2"
                   initial={{ opacity: 0 }}
                   animate={{ opacity: 1 }}
                   transition={{ delay: 0.2 }}
                >
                  Ledger data erased
                </motion.p>
              </>
            ) : (
              <>
                <motion.div
                  className="w-20 h-20 rounded-full border-2 border-zinc-700 flex items-center justify-center mb-6"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                >
                  <div className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center">
                    <span className="text-2xl">⚠️</span>
                  </div>
                </motion.div>
                <h3 className="text-xl font-bold text-white uppercase italic">Purge Failed</h3>
                <p className="text-zinc-500 text-xs mt-2 font-medium">Transmission aborted</p>
                <button 
                  onClick={() => setDeleteOverlay(null)}
                  className="mt-8 px-6 py-2 bg-zinc-900 border border-white/10 rounded-xl text-[10px] font-bold uppercase tracking-widest text-zinc-400 hover:text-white transition-all"
                >
                  Rescue Protocol
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
