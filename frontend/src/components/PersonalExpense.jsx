import { useNavigate, Link } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import toast from "react-hot-toast";
import { FaArrowDown, FaCopy } from "react-icons/fa";
import { Mic, Loader2, Trash2, Pencil } from "lucide-react";
import Cookies from "js-cookie";
import api from "../utils/api";
import { motion, AnimatePresence } from "framer-motion";
import DatePicker from "./DatePicker";

const handleScrollTop = () => {
  window.scrollTo({
    top: 0,
    left: 0,
    behavior: "smooth",
  });
};

const API_BASE = import.meta.env.VITE_API_BASE_URL;
const PAGE_SIZE = 20;

const PersonalExpense = () => {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [totalSpending, setTotalSpending] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [txLoading, setTxLoading] = useState(true);

  const chatContainerRef = useRef(null);
  const bottomRef = useRef(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [storedUser, setStoredUser] = useState(
    JSON.parse(localStorage.getItem("user")) || null
  );

  // Pagination
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);

  // Input bar
  const [amount, setAmount] = useState(0);
  const [text, setText] = useState("");

  // Modals / overlays
  const [successOverlay, setSuccessOverlay] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleteOverlay, setDeleteOverlay] = useState(null);
  const [editExpense, setEditExpense] = useState(null);
  const [editForm, setEditForm] = useState({
    description: "",
    amount: "",
    date: "",
    time: "",
  });

  // Voice
  const [isListening, setIsListening] = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const recognitionRef = useRef(null);

  const userId = storedUser?._id;

  // ---------- SCROLL HANDLING ----------
  const handleScroll = () => {
    const el = chatContainerRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const atBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 100;
    setIsAtBottom(atBottom);

    if (scrollTop < 80 && hasMore && !loadingMore) {
      loadMoreTransactions();
    }
  };

  const scrollToBottom = () => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
      setIsAtBottom(true);
    }
  };

  // ---------- DATA FETCHING ----------
  async function fetchData(silent = false) {
    try {
      const currentUserId = Cookies.get("id");
      if (!currentUserId) {
        toast.error("User session expired. Please log in again.");
        navigate("/login");
        return;
      }

      // Sync user data
      try {
        const response = await api.get(`${API_BASE}/user/${currentUserId}`);
        if (response.status === 200) {
          setStoredUser(response.data.user);
          localStorage.setItem("user", JSON.stringify(response.data.user));
        }
      } catch (syncErr) {
        console.error("Failed to sync user data:", syncErr);
      }

      if (!silent) setLoading(false);
      if (!silent) setTxLoading(true);

      const txRes = await api.get(
        `${API_BASE}/expenses/personal?limit=${PAGE_SIZE}`
      );

      const expenses = txRes.data.expenses || [];
      // API returns newest-first; reverse for chat-style (oldest at top)
      const sorted = [...expenses].sort(
        (a, b) => new Date(a.date) - new Date(b.date)
      );
      setTransactions(sorted);
      setHasMore(txRes.data.hasMore || false);
      setNextCursor(txRes.data.nextCursor || null);
      setTotalSpending(txRes.data.totalSpending || 0);
      setTotalCount(txRes.data.totalCount || 0);
    } catch (err) {
      toast.error("Error fetching data!");
      console.error(err);
    } finally {
      setTxLoading(false);
    }
  }

  async function loadMoreTransactions() {
    if (!hasMore || loadingMore || !nextCursor) return;
    setLoadingMore(true);
    try {
      const el = chatContainerRef.current;
      const prevScrollHeight = el ? el.scrollHeight : 0;

      const txRes = await api.get(
        `${API_BASE}/expenses/personal?limit=${PAGE_SIZE}&cursor=${nextCursor}`
      );

      const olderExpenses = (txRes.data.expenses || []).sort(
        (a, b) => new Date(a.date) - new Date(b.date)
      );

      setTransactions((prev) => [...olderExpenses, ...prev]);
      setHasMore(txRes.data.hasMore || false);
      setNextCursor(txRes.data.nextCursor || null);

      requestAnimationFrame(() => {
        if (el) {
          el.scrollTop = el.scrollHeight - prevScrollHeight;
        }
      });
    } catch (err) {
      console.error("Error loading more transactions:", err);
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    handleScrollTop();
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!transactions || transactions.length === 0) return;
    requestAnimationFrame(() => {
      scrollToBottom();
      handleScroll();
    });
  }, [txLoading]);

  useEffect(() => {
    handleScroll();
    const el = chatContainerRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  // ---------- ADD EXPENSE ----------
  const handleAddExpense = async () => {
    if (amount === "" || amount === 0) {
      toast.error("Please enter a valid amount.");
      return;
    }
    if (text === "" || text.trim() === "") {
      toast.error("Please enter a description.");
      return;
    }
    const paidAmount = Math.abs(amount);
    if (paidAmount > 500000) {
      toast.error("Amount cannot be more than 5,00,000");
      return;
    }

    try {
      setLoading(true);
      const response = await api.post(`${API_BASE}/expenses/personal`, {
        description: text,
        amount: paidAmount,
        date: new Date(),
      });

      setSuccessOverlay({ amount: paidAmount, description: text });
      setTimeout(() => setSuccessOverlay(null), 2200);
      setAmount(0);
      setText("");

      // Append the new expense at the bottom
      setTransactions((prev) => [...prev, response.data]);
      setTotalSpending((prev) => prev + paidAmount);
      setTotalCount((prev) => prev + 1);

      // Scroll to bottom after a small delay
      setTimeout(() => scrollToBottom(), 300);
    } catch (error) {
      toast.error("Error adding expense");
      console.error("Error adding expense:", error);
    } finally {
      setLoading(false);
    }
  };

  // ---------- DELETE ----------
  const confirmDelete = (expense) => {
    setDeleteConfirm(expense);
  };

  const deleteExpense = async () => {
    if (!deleteConfirm) return;
    try {
      await api.delete(`${API_BASE}/expenses/personal/${deleteConfirm._id}`);
      setTransactions((prev) =>
        prev.filter((e) => e._id !== deleteConfirm._id)
      );
      setTotalSpending((prev) => prev - deleteConfirm.amount);
      setTotalCount((prev) => prev - 1);
      setDeleteOverlay({ status: "success" });
      setTimeout(() => setDeleteOverlay(null), 2000);
    } catch (error) {
      console.error("Error deleting expense:", error);
      setDeleteOverlay({
        status: "error",
        message: error.response?.data?.message || "Purge Failed",
      });
    } finally {
      setDeleteConfirm(null);
    }
  };

  // ---------- EDIT ----------
  const openEdit = (expense) => {
    const d = new Date(expense.date);
    setEditExpense(expense);
    setEditForm({
      description: expense.title || expense.description || "",
      amount: expense.amount.toString(),
      date: d.toLocaleDateString("en-CA"),
      time: d.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    });
  };

  const saveEditExpense = async () => {
    if (!editExpense) return;
    if (
      !editForm.description.trim() ||
      !editForm.amount ||
      parseFloat(editForm.amount) <= 0
    ) {
      toast.error("Please fill description and a valid amount");
      return;
    }
    try {
      const combinedDate = new Date(`${editForm.date}T${editForm.time}`);
      const { data } = await api.put(
        `${API_BASE}/expenses/personal/${editExpense._id}`,
        {
          description: editForm.description,
          amount: parseFloat(editForm.amount),
          date: combinedDate,
        }
      );
      setTransactions((prev) =>
        prev.map((e) => (e._id === data._id ? data : e))
      );
      // Recalculate total spending
      const amountDiff = data.amount - editExpense.amount;
      setTotalSpending((prev) => prev + amountDiff);

      setSuccessOverlay({
        amount: data.amount,
        description: data.title || data.description || "Expense updated",
        isEdit: true,
      });
      setTimeout(() => setSuccessOverlay(null), 2200);
    } catch (error) {
      console.error("Error updating expense:", error);
      setDeleteOverlay({
        status: "error",
        message: "Failed to update entry",
      });
    } finally {
      setEditExpense(null);
    }
  };

  // ---------- VOICE ----------
  const handleStopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  const handleVoiceInput = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Voice recognition not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      toast("Listening...", { icon: "🎤", id: "voice-toast" });
    };
    recognition.onend = () => setIsListening(false);
    recognition.onresult = async (event) => {
      const transcript = event.results[0][0].transcript;
      toast.success(`Heard: "${transcript}"`, { id: "voice-toast" });
      setIsListening(false);
      setIsProcessingVoice(true);
      processVoiceExpense(transcript);
    };
    recognition.onerror = (event) => {
      setIsListening(false);
      console.error("Voice error:", event.error);
      if (event.error === "not-allowed") {
        toast.error("Mic access blocked. Check your browser permissions.", {
          id: "voice-toast",
          duration: 5000,
        });
      } else {
        toast.error("Error capturing voice. Try again.", {
          id: "voice-toast",
        });
      }
    };
    recognition.start();
  };

  const processVoiceExpense = async (transcript) => {
    const toastId = toast.loading("Analyzing expense...");
    const safetyTimeout = setTimeout(() => {
      setIsProcessingVoice(false);
      toast.error("AI is taking too long. Please try again.", { id: toastId });
    }, 15000);

    try {
      const voiceUserId = Cookies.get("id");
      const { data } = await api.post(`${API_BASE}/ai/parse-expense`, {
        prompt: transcript,
        userId: voiceUserId,
        context: "personal",
      });

      if (data.amount) setAmount(parseFloat(data.amount));
      if (data.title) setText(data.title);
      toast.success("Expense details filled!", { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error(
        err.response?.data?.error || "Failed to parse voice command.",
        { id: toastId }
      );
    } finally {
      clearTimeout(safetyTimeout);
      setIsProcessingVoice(false);
    }
  };

  // ========== RENDER ==========
  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-indigo-500/30 overflow-hidden relative">
      {/* --- BACKGROUND FX --- */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-indigo-900/20 rounded-full blur-[120px] pointer-events-none"></div>

      {/* --- SUCCESS CELEBRATION OVERLAY --- */}
      <AnimatePresence>
        {successOverlay && (
          <motion.div
            className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-zinc-950/90 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={() => setSuccessOverlay(null)}
          >
            <motion.div
              className="absolute w-44 h-44 rounded-full blur-3xl bg-emerald-500/20"
              initial={{ scale: 0 }}
              animate={{ scale: 2.5, opacity: 0 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            />
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-2 h-2 rounded-full bg-emerald-400"
                initial={{ scale: 0, x: 0, y: 0, opacity: 1 }}
                animate={{
                  scale: [0, 1, 0.5],
                  x: Math.cos((i * Math.PI * 2) / 8) * 80,
                  y: Math.sin((i * Math.PI * 2) / 8) * 80,
                  opacity: [1, 1, 0],
                }}
                transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
              />
            ))}
            <motion.div
              className="relative w-24 h-24 rounded-full border-2 border-emerald-500 flex items-center justify-center mb-5"
              initial={{ scale: 0, rotate: -60 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{
                type: "spring",
                stiffness: 200,
                damping: 14,
                delay: 0.1,
              }}
            >
              <motion.div
                className="absolute inset-0 rounded-full bg-emerald-600/20"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, duration: 0.3 }}
              />
              <svg
                className="w-12 h-12 text-emerald-400 z-10"
                viewBox="0 0 24 24"
                fill="none"
              >
                <motion.path
                  d="M5 13l4 4L19 7"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ delay: 0.4, duration: 0.5, ease: "easeOut" }}
                />
              </svg>
            </motion.div>
            <motion.p
              className="text-2xl font-bold text-white mb-1"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.35 }}
            >
              {successOverlay.isEdit ? "Updated! ✨" : "Recorded! 💸"}
            </motion.p>
            <motion.p
              className="text-sm text-zinc-400 mb-4"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.3 }}
            >
              {successOverlay.isEdit
                ? "Changes synchronized to ledger"
                : "Transaction added to your records"}
            </motion.p>
            <motion.div
              className="flex flex-col items-center bg-zinc-900/60 border border-white/10 rounded-2xl px-8 py-5 backdrop-blur-sm"
              initial={{ opacity: 0, y: 15, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                delay: 0.65,
                type: "spring",
                stiffness: 200,
                damping: 20,
              }}
            >
              <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-2">
                {successOverlay.isEdit ? "Revised Amount" : "Amount Recorded"}
              </span>
              <span className="text-3xl font-mono font-bold text-emerald-400">
                ₹{successOverlay.amount.toFixed(2)}
              </span>
              {successOverlay.description && (
                <span className="text-xs text-zinc-400 mt-2 truncate max-w-[200px] font-medium">
                  {successOverlay.description}
                </span>
              )}
            </motion.div>
            <motion.p
              className="text-xs text-zinc-600 mt-5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.0 }}
            >
              Tap anywhere to dismiss
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- DELETE CELEBRATION / ERROR OVERLAY --- */}
      <AnimatePresence>
        {deleteOverlay && (
          <motion.div
            className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-zinc-950/90 backdrop-blur-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDeleteOverlay(null)}
          >
            {deleteOverlay.status === "success" ? (
              <>
                <motion.div
                  className="w-24 h-24 rounded-full border-2 border-red-500/50 flex items-center justify-center mb-6 relative"
                  initial={{ scale: 0, rotate: -45 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", damping: 12 }}
                >
                  <motion.div
                    className="absolute inset-0 rounded-full bg-red-600/20"
                    animate={{
                      scale: [1, 1.4, 1],
                      opacity: [0.5, 0, 0.5],
                    }}
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
                <h3 className="text-xl font-bold text-white uppercase italic">
                  {deleteOverlay.message || "Action Failed"}
                </h3>
                <p className="text-zinc-500 text-xs mt-2 font-medium">
                  Transmission aborted
                </p>
                <button
                  onClick={() => setDeleteOverlay(null)}
                  className="mt-8 px-6 py-2 bg-zinc-900 border border-white/10 rounded-xl text-[10px] font-bold uppercase tracking-widest text-zinc-400 hover:text-white transition-all shadow-lg active:scale-95"
                >
                  Dismiss
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- HEADER --- */}
      <motion.div
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-20 bg-zinc-900/80 backdrop-blur-xl border-b border-white/5 shadow-lg shadow-black/20"
      >
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(-1)}
              className="p-1.5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>

            <Link
              to={`/public-profile/${storedUser?._id}`}
              className="flex items-center gap-2 group"
            >
              <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-indigo-500/30 overflow-hidden relative shadow-inner ring-2 ring-indigo-500/20">
                {storedUser?.profilePhotoUrl ? (
                  <img
                    src={storedUser.profilePhotoUrl}
                    alt="User"
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-indigo-400 font-bold">
                    {storedUser?.username?.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-white leading-none mb-2 mt-2 group-hover:text-indigo-300 transition-colors truncate">
                    {storedUser?.username}
                  </h2>
                  <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded-full mb-0.5">
                    YOU
                  </span>
                </div>
                <div className="flex items-center mt-0 overflow-hidden">
                  <span className="text-[10px] font-mono text-zinc-500 whitespace-nowrap">
                    Personal Ledger
                  </span>
                </div>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 bg-zinc-800 px-3 py-1.5 rounded-xl border border-white/5 font-mono">
              {totalCount} RECORDS
            </span>
          </div>
        </div>
      </motion.div>


      {/* --- STREAM AREA --- */}
      <div
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 custom-scrollbar relative z-0"
      >
        <div className="max-w-3xl mx-auto space-y-6">
          {txLoading || loading ? (
            <div className="h-full flex flex-col items-center justify-center space-y-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="w-full max-w-[70%] h-24 bg-zinc-900/50 rounded-xl border border-white/5 animate-pulse flex flex-col p-4 gap-2 self-end"
                >
                  <div className="w-1/3 h-3 bg-zinc-800 rounded"></div>
                  <div className="w-1/2 h-2 bg-zinc-800/50 rounded"></div>
                  <div className="mt-auto self-end w-1/4 h-6 bg-indigo-900/20 rounded"></div>
                </div>
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="h-full mt-20 flex flex-col items-center justify-center opacity-50">
              <div className="w-20 h-20 rounded-2xl bg-zinc-900 border border-dashed border-zinc-700 flex items-center justify-center mb-4">
                <span className="text-4xl">🧾</span>
              </div>
              <p className="text-zinc-500 font-mono text-sm">LEDGER_EMPTY</p>
              <p className="text-zinc-600 text-xs mt-1">
                Initialize your personal expense stream.
              </p>
            </div>
          ) : (
            <>
              {/* Load more skeleton at top */}
              {loadingMore && (
                <div className="flex flex-col items-center gap-3 mb-6">
                  {[1, 2].map((i) => (
                    <div
                      key={`load-more-${i}`}
                      className="w-full max-w-[70%] h-20 bg-zinc-900/50 rounded-xl border border-white/5 animate-pulse flex flex-col p-4 gap-2 self-end"
                    >
                      <div className="w-1/3 h-3 bg-zinc-800 rounded"></div>
                      <div className="w-1/2 h-2 bg-zinc-800/50 rounded"></div>
                      <div className="mt-auto self-end w-1/4 h-5 bg-indigo-900/20 rounded"></div>
                    </div>
                  ))}
                </div>
              )}

              {/* Beginning of history indicator */}
              {!hasMore && transactions.length > 0 && !loadingMore && (
                <div className="flex items-center gap-3 justify-center mb-6 opacity-40">
                  <div className="h-px w-12 bg-zinc-700"></div>
                  <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                    Beginning of history
                  </span>
                  <div className="h-px w-12 bg-zinc-700"></div>
                </div>
              )}

              {transactions.map((tx) => (
                <div
                  key={tx._id}
                  className="flex w-full items-center group justify-end animate-in slide-in-from-bottom-2 duration-500"
                >
                  {/* Digital Receipt Bubble - always right-aligned */}
                  <div className="relative max-w-[85%] sm:max-w-xs">
                    {/* Connector */}
                    <div className="absolute top-4 w-2 h-[1px] -right-2 bg-indigo-500/50"></div>

                    <div
                      className="relative p-4 rounded-xl border backdrop-blur-md shadow-lg transition-all duration-300 bg-indigo-950/30 border-indigo-500/30 rounded-tr-sm hover:border-indigo-500/50"
                    >
                      {/* Header: Title & Date */}
                      <div className="flex justify-between items-start gap-4 mb-2 border-b border-white/5 pb-2">
                        <span className="text-sm font-bold truncate text-indigo-200">
                          {tx.title || tx.description || "Untitled Expense"}
                        </span>
                        <div className="flex justify-between items-start gap-1">
                          <span className="text-[10px] font-mono text-zinc-500 whitespace-nowrap pt-0.5">
                            {new Date(tx.date).toLocaleDateString([])}
                          </span>
                          <span className="text-[10px] font-mono text-zinc-500 whitespace-nowrap pt-0.5">
                            {new Date(tx.date).toLocaleTimeString([])}
                          </span>
                        </div>
                      </div>

                      {/* Content: Amount */}
                      <div className="flex justify-between items-end">
                        <div className="flex flex-col mr-2">
                          <span className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">
                            You Paid
                          </span>
                        </div>
                        <div className="text-2xl font-mono font-medium tracking-tight text-indigo-400">
                          ₹{tx.amount.toFixed(2)}
                        </div>
                      </div>

                      {/* Action buttons - always visible */}
                      <div className="absolute -left-20 top-1/2 -translate-y-1/2 flex gap-1">
                        <button
                          onClick={() => openEdit(tx)}
                          className="p-2 rounded-lg bg-zinc-800/80 text-indigo-400 hover:text-white hover:bg-indigo-500/20 border border-white/5 transition-all"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => confirmDelete(tx)}
                          className="p-2 rounded-lg bg-zinc-800/80 text-red-400 hover:text-white hover:bg-red-500/20 border border-white/5 transition-all"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Corner Decoration */}
                      <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-l border-indigo-500/30 rounded-bl-lg"></div>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </>
          )}
        </div>
      </div>

      {/* --- SCROLL TO BOTTOM --- */}
      {!isAtBottom && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-36 left-1/2 -translate-x-1/2 z-50 p-3 rounded-full bg-zinc-800 text-indigo-400 shadow-lg border border-white/10 hover:bg-zinc-700 transition-all"
        >
          <FaArrowDown size={14} />
        </button>
      )}

      {/* --- COMMAND BAR (Input) --- */}
      <motion.div
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
        className="p-4 bg-zinc-950/80 backdrop-blur-xl border-t border-white/5 relative z-30"
      >
        <div className="max-w-3xl mx-auto flex flex-col gap-3">
          {/* Input Capsule */}
          <div className="flex items-center gap-3 p-1.5 bg-zinc-900 border border-white/10 rounded-2xl shadow-inner focus-within:border-indigo-500/50 transition-colors">
            {/* Amount Field */}
            <div className="relative pl-3">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 font-mono">
                ₹
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => {
                  let value = e.target.value;
                  if (value === "") return setAmount("");
                  if (
                    !value.startsWith("0.") &&
                    !value.startsWith("-0.") &&
                    value.length > 1 &&
                    !value.startsWith("-")
                  ) {
                    value = value.replace(/^0+/, "");
                  }
                  const parsed = parseFloat(value);
                  setAmount(isNaN(parsed) ? "" : parsed);
                }}
                className="w-24 bg-transparent text-white font-mono font-medium focus:outline-none pl-4 py-2 placeholder-zinc-600"
                placeholder="0.00"
              />
            </div>

            {/* Divider */}
            <div className="w-px h-6 bg-zinc-700"></div>

            {/* Description Field */}
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddExpense();
              }}
              className="flex-1 bg-transparent text-white text-sm focus:outline-none px-2 py-2 placeholder-zinc-600"
              placeholder="What did you spend on?"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleAddExpense}
              disabled={loading}
              className="flex-1 py-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 text-xs font-bold uppercase tracking-wider transition-all active:scale-[0.98]"
            >
              + Add Expense
            </button>
            <button
              onClick={handleVoiceInput}
              disabled={isListening || isProcessingVoice}
              className={`px-4 py-3 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all active:scale-[0.98] flex items-center gap-2 ${
                isListening
                  ? "bg-red-500/20 border-red-500/30 text-red-400 animate-pulse"
                  : "bg-indigo-500/10 border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20"
              }`}
              title="Voice Input"
            >
              {isProcessingVoice ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">Voice</span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* --- DELETE CONFIRMATION MODAL --- */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
            onClick={() => setDeleteConfirm(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{
                type: "spring",
                damping: 25,
                stiffness: 300,
                mass: 0.8,
              }}
              className="bg-zinc-900 border border-white/10 rounded-3xl p-8 max-w-sm w-full shadow-2xl relative overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />

              <div className="flex flex-col items-center text-center mb-6">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4 ring-2 ring-red-500/20 ring-offset-4 ring-offset-zinc-900">
                  <Trash2 className="w-7 h-7 text-red-400" />
                </div>
                <h3 className="text-xl font-black text-white uppercase tracking-tight">
                  Purge Records?
                </h3>
                <p className="text-zinc-500 text-xs mt-2 font-medium">
                  This action will permanently delete the transaction.
                </p>
              </div>

              <div className="bg-zinc-800/40 border border-white/5 rounded-2xl p-4 mb-8">
                <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest mb-1">
                  Transaction Label
                </p>
                <p className="text-zinc-100 font-bold text-base truncate">
                  {deleteConfirm.title || deleteConfirm.description}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest">
                    Cost
                  </p>
                  <p className="text-red-400 font-black text-2xl font-mono">
                    ₹{deleteConfirm.amount.toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 px-4 py-3.5 rounded-2xl bg-zinc-800 border border-white/5 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all font-bold text-xs uppercase tracking-widest"
                >
                  Retreat
                </button>
                <button
                  onClick={deleteExpense}
                  className="flex-1 px-4 py-3.5 rounded-2xl bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-500/20 transition-all font-bold text-xs uppercase tracking-widest active:scale-95"
                >
                  Purge
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- EDIT EXPENSE MODAL --- */}
      <AnimatePresence>
        {editExpense && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
            onClick={() => setEditExpense(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              transition={{
                type: "spring",
                damping: 25,
                stiffness: 300,
                mass: 0.8,
              }}
              className="bg-zinc-900 border border-white/10 rounded-3xl p-8 max-w-sm w-full shadow-2xl relative overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />

              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center border border-indigo-500/20 shadow-lg">
                  <Pencil className="w-6 h-6 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tight">
                    Edit Ledger
                  </h3>
                  <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">
                    Updating Entry ID: {editExpense._id.slice(-6)}
                  </p>
                </div>
              </div>

              <div className="space-y-5 mb-10">
                <div className="group">
                  <label className="text-[10px] font-bold text-zinc-500 mb-2 block uppercase tracking-[0.2em] ml-1">
                    Label
                  </label>
                  <input
                    type="text"
                    value={editForm.description}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        description: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3.5 bg-zinc-950 border border-white/10 rounded-2xl focus:outline-none focus:border-indigo-500/50 text-sm text-white font-medium transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 mb-2 block uppercase tracking-[0.2em] ml-1">
                    Credits (₹)
                  </label>
                  <input
                    type="number"
                    value={editForm.amount}
                    onChange={(e) =>
                      setEditForm({ ...editForm, amount: e.target.value })
                    }
                    className="w-full px-4 py-3.5 bg-zinc-950 border border-white/10 rounded-2xl focus:outline-none focus:border-green-500/50 text-lg font-black text-white font-mono transition-colors"
                  />
                </div>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <DatePicker
                      label="Date"
                      placeholder="Pick date"
                      value={editForm.date}
                      onChange={(val) =>
                        setEditForm({ ...editForm, date: val })
                      }
                      labelClassName="text-[10px] font-bold text-zinc-500 mb-2 block uppercase tracking-[0.2em] ml-1"
                      buttonClassName="bg-zinc-950 border border-white/10 rounded-2xl py-3.5"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] font-bold text-zinc-500 mb-2 block uppercase tracking-[0.2em] ml-1">
                      Time
                    </label>
                    <input
                      type="time"
                      value={editForm.time}
                      onChange={(e) =>
                        setEditForm({ ...editForm, time: e.target.value })
                      }
                      className="w-full px-3 py-3 bg-zinc-950 border border-white/10 rounded-2xl focus:outline-none focus:border-indigo-500/50 text-sm text-zinc-300 font-mono [color-scheme:dark]"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setEditExpense(null)}
                  className="flex-1 px-4 py-4 rounded-2xl bg-zinc-800 border border-white/5 text-zinc-400 hover:text-zinc-200 transition-all font-bold text-xs uppercase tracking-widest"
                >
                  Discard
                </button>
                <button
                  onClick={saveEditExpense}
                  className="flex-1 px-4 py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-500/20 transition-all font-bold text-xs uppercase tracking-widest active:scale-95"
                >
                  Commit
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- VOICE LISTENING MODAL --- */}
      {isListening && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative">
            <div className="absolute inset-0 bg-indigo-500 rounded-full animate-ping opacity-75 blur-xl"></div>
            <div className="absolute inset-0 bg-cyan-500 rounded-full animate-ping delay-75 opacity-50 blur-lg"></div>
            <div className="relative w-24 h-24 bg-gradient-to-br from-indigo-600 to-cyan-500 rounded-full flex items-center justify-center shadow-2xl border-4 border-white/10">
              <Mic className="w-10 h-10 text-white animate-bounce" />
            </div>
          </div>
          <h3 className="mt-8 text-2xl font-bold text-white tracking-tight animate-pulse">
            Listening...
          </h3>
          <p className="text-zinc-400 mt-2 text-sm italic">
            Say "Groceries 500"
          </p>
          <div className="flex flex-col items-center gap-4 mt-8 w-full max-w-xs">
            <button
              onClick={handleStopListening}
              className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-full font-bold shadow-lg transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
            >
              <div className="w-4 h-4 bg-white rounded-sm"></div>
              Stop Listening
            </button>
            <button
              onClick={() => {
                if (recognitionRef.current) recognitionRef.current.abort();
                setIsListening(false);
                toast.dismiss("voice-toast");
              }}
              className="text-zinc-500 hover:text-white text-sm transition-colors py-2 px-4"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* --- PROCESSING MODAL --- */}
      {isProcessingVoice && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative mb-8 w-24 h-24 animate-glow-pulse">
            <div className="absolute inset-0 border-4 border-indigo-500/30 rounded-full"></div>
            <div className="absolute inset-0 border-t-4 border-cyan-400 rounded-full animate-spin"></div>
            <div className="absolute inset-2 border-b-4 border-indigo-400 rounded-full animate-spin-reverse"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
            </div>
          </div>
          <h3 className="text-2xl font-bold text-white tracking-tight animate-pulse text-center px-4">
            Processing... 🤖
          </h3>
          <p className="text-zinc-400 mt-4 text-sm max-w-xs text-center">
            Decoding your expense details.
          </p>
        </div>
      )}
    </div>
  );
};

export default PersonalExpense;
