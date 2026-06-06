import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Mic, Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
const API_BASE = import.meta.env.VITE_API_BASE_URL;
import api from "../utils/api";

const handleScrollTop = () => {
  window.scrollTo({
    top: 0,
    left: 0,
    behavior: "smooth",
  });
};

// Accepts an optional groupId prop so that it can be passed directly if available
const AddExpense = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { propGroupId, prefillTitle, prefillAmount } = location.state || {};

  // State variables
  const [splitMode, setSplitMode] = useState("equally");
  const [selected, setSelected] = useState([]); // Array of selected member _ids (for splitting)
  const [amounts, setAmounts] = useState({}); // For uneven split: maps member _id => custom amount
  const [selectAll, setSelectAll] = useState(false);
  const [paidBy, setPaidBy] = useState(""); // _id of the payer
  const [members, setMembers] = useState([]); // Combined list: logged-in user + friends
  const [title, setTitle] = useState("");
  const [mainAmount, setMainAmount] = useState("");

  useEffect(() => {
    handleScrollTop();
  }, []);

  // Pre-fill effect from location state
  useEffect(() => {
    if (prefillTitle) setTitle(prefillTitle);
    if (prefillAmount) setMainAmount(prefillAmount);
  }, [prefillTitle, prefillAmount]);

  const [isLoading, setIsLoading] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [calcExpr, setCalcExpr] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [resultOverlay, setResultOverlay] = useState(null); // { type: 'success'|'error', amount?: number, message?: string }
  const recognitionRef = useRef(null); // Ref to store recognition instance

  const handleStopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      // The onend event will handle resetting state, but we can force it here for immediate feedback if needed
      // setIsListening(false); 
    }
  };

  // Determine groupId: either from prop or from localStorage ("currentGroup")
  const currentGroup = JSON.parse(
    localStorage.getItem("currentGroup") || "null"
  );
  const groupId = propGroupId || (currentGroup ? currentGroup._id : null);

  // Retrieve user info from localStorage and build a combined members list.
  // This list contains the logged-in user plus his friends.
  useEffect(() => {
    try {
      const currentGroup = localStorage.getItem("currentGroup");
      const groupMembers = currentGroup ? JSON.parse(currentGroup).members : [];
      setMembers(groupMembers);
    } catch (err) {
      console.error("Error loading user and friends from localStorage:", err);
    }
  }, []);

  // Checkbox handlers for selecting/deselecting a member (by _id)
  const handleCheckboxChange = (memberId) => {
    if (selected.includes(memberId)) {
      setSelected(selected.filter((id) => id !== memberId));
    } else {
      setSelected([...selected, memberId]);
    }
  };

  // "Select All" toggle handler
  const handleSelectAll = () => {
    if (selectAll) {
      setSelected([]);
    } else {
      const allMemberIds = members.map((member) => member._id);
      setSelected(allMemberIds);
    }
  };

  // Keep the state of "Select All" in sync
  useEffect(() => {
    const memberIds = members.map((member) => member._id);
    setSelectAll(selected.length === memberIds.length);
  }, [selected, members]);

  // Handler to capture custom amounts for uneven split. Only allows up to two decimals.
  const handleAmountChange = (e, memberId) => {
    const value = e.target.value;
    if (/^\d*\.?\d{0,2}$/.test(value)) {
      setAmounts({ ...amounts, [memberId]: value });
    }
  };

  // Calculator helpers
  const appendToCalc = (char) => {
    // allow only safe characters
    if (/^[0-9.+\-*/() ]$/.test(char)) setCalcExpr((s) => s + char);
  };

  const handleCalcBackspace = () => setCalcExpr((s) => s.slice(0, -1));
  const handleCalcClear = () => setCalcExpr("");

  const evaluateExpression = (expr) => {
    // sanitize: allow digits, whitespace, . and +-*/() only
    const safe = expr.replace(/[^0-9.+\-*/() ]/g, "");
    try {
      // eslint-disable-next-line no-new-func
      const result = Function(`"use strict"; return (${safe})`)();
      if (typeof result === "number" && Number.isFinite(result)) return result;
      return null;
    } catch (err) {
      return null;
    }
  };

  const handleCalcEqual = () => {
    const res = evaluateExpression(calcExpr);
    if (res === null) {
      toast.error("Invalid expression");
      return false;
    }
    // Just show result in calculator, don't update amount field
    const formatted = Number(res);
    setCalcExpr(formatted.toString());
    return true;
  };

  // handle keyboard input when calculator is open (supports numpad)
  useEffect(() => {
    if (!showCalculator) return;

    const onKey = (e) => {
      const k = e.key;
      if (k === "Enter") {
        e.preventDefault();
        handleCalcEqual();
        return;
      }
      if (k === "Backspace") {
        e.preventDefault();
        handleCalcBackspace();
        return;
      }
      // Allow digits, operators and parentheses and dot
      if (/^[0-9.+\-*/() ]$/.test(k)) {
        e.preventDefault();
        appendToCalc(k);
        return;
      }
      // Numpad keys may appear as e.code like 'Numpad1' but e.key is same as '1'
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showCalculator, calcExpr]);

  // Calculate total of custom amounts for uneven splitting
  const calculateCustomTotal = () => {
    return selected.reduce((sum, memberId) => {
      const value = parseFloat(amounts[memberId]) || 0;
      return sum + value;
    }, 0);
  };

  // Main handler to add an expense
  const handleAddExpense = async () => {
    const totalEntered = parseFloat(mainAmount) || 0;
    const customTotal = calculateCustomTotal();

    // For uneven split, total of custom amounts must equal the main entered amount.
    if (
      splitMode === "unequally" &&
      totalEntered.toFixed(2) !== customTotal.toFixed(2)
    ) {
      const diff = (customTotal - totalEntered).toFixed(2);
      toast.error(
        `Calculation mismatch of ₹${Math.abs(diff)}. Please correct the values.`
      );
      return;
    }

    // Construct the payload to send to the backend.
    // The payload includes title, main amount, payer's _id, groupId (if available),
    // splitMode, the list of involved member _ids, and customAmounts if needed.
    const payload = {
      title: title,
      amount: totalEntered,
      paidBy: paidBy, // _id of the payer
      groupId: groupId, // may be null if not applicable
      splitMode: splitMode,
      involvedMembers: selected, // array of _ids (which may include the payer as well)
      customAmounts: splitMode === "unequally" ? amounts : {},
    };

    if (totalEntered > 500000) {
      toast.error("Amount must be smaller than 5,00,000");
      return;
    }

    try {
      setIsLoading(true); // ✅ Start loading
      // Replace with your backend endpoint
      const response = await api.post(
        `${API_BASE}/group/add-expense`,
        // '//http://localhost:8000/group/add-expense',
        payload
      );

      if (response.status === 400) {
        toast.error(`${response.data.message}`);
        return;
      }

      if (response.status === 200) {
        const addedAmount = parseFloat(mainAmount) || 0;
        setResultOverlay({ type: "success", amount: addedAmount, message: "Expense Added!" });
      }
      // Reset form fields
      setTitle("");
      setMainAmount("");
      setPaidBy("");
      setSelected([]);
      setAmounts({});

      //Force refresh needed to update the expenses card details
      localStorage.removeItem("currentGroup");

      setTimeout(() => {
        setResultOverlay(null);
        navigate(-1);
      }, 1800);
    } catch (error) {
      console.error("Error creating expense:", error);
      const errorMsg =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        "Error creating expense. Please try again.";
      toast.error(errorMsg);
      setResultOverlay({ type: "error", message: errorMsg });
      setTimeout(() => setResultOverlay(null), 2500);
    } finally {
      setIsLoading(false); // ✅ Stop loading
    }
  };

  const equalSplitAmount =
    splitMode === "equally" && selected.length > 0
      ? (parseFloat(mainAmount || 0) / selected.length).toFixed(2)
      : 0;

  const handleVoiceInput = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast.error("Voice recognition not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition; // Store instance in ref
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      toast.loading("Listening...", { id: "voice-toast" });
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onresult = async (event) => {
      const transcript = event.results[0][0].transcript;
      toast.success(`Heard: "${transcript}"`, { id: "voice-toast" });
      setIsListening(false); // Stop listening UI
      setIsProcessingVoice(true); // Start processing UI immediately to prevent flicker
      processVoiceExpense(transcript);
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      console.error("Voice error:", event.error);
      if (event.error === 'not-allowed') {
        toast.error("Mic access blocked. Check your browser permissions.", { id: "voice-toast", duration: 5000 });
      } else {
        toast.error("Error capturing voice. Try again.", { id: "voice-toast" });
      }
    };

    recognition.start();
  };

  const processVoiceExpense = async (transcript) => {
    // setIsProcessingVoice(true); // Already set in onresult
    const toastId = toast.loading("Analyzing expense...");

    // Safety Timeout (15 seconds)
    const safetyTimeout = setTimeout(() => {
        setIsProcessingVoice(false);
        toast.error("AI is taking too long. Please try again.", { id: toastId });
    }, 15000);

    try {
      const { data } = await api.post("/ai/parse-expense", {
        prompt: transcript,
        context: "group_detailed",
        memberNames: members.filter(m => m).map((m) => m.username),
      });

      // 1. Amount
      if (data.amount) setMainAmount(data.amount.toString());

      // 2. Title
      if (data.title) setTitle(data.title);

      // 3. Paid By
      if (data.paidBy) {
        if (data.paidBy === "current_user") {
          const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
          if (storedUser._id) setPaidBy(storedUser._id);
        } else {
          // Fuzzy match name in members list
          const payer = members.find((m) =>
            m && m.username.toLowerCase().includes(data.paidBy.toLowerCase())
          );
          if (payer) setPaidBy(payer._id);
        }
      }

      // 4. Split Mode & Details
      if (data.splitMode === "unequally") {
        setSplitMode("unequally");
        if (data.splitDetails && Array.isArray(data.splitDetails)) {
          const newAmounts = {};
          const newSelected = [];

          data.splitDetails.forEach((detail) => {
            let memberId;
            if (detail.name === "current_user" || detail.name === "me" || detail.name === "I") {
              const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
              memberId = storedUser._id;
            } else {
              const friend = members.find((m) =>
                m && m.username.toLowerCase().includes(detail.name.toLowerCase())
              );
              if (friend) memberId = friend._id;
            }

            if (memberId) {
              newAmounts[memberId] = detail.amount.toString();
              newSelected.push(memberId);
            }
          });

          if (newSelected.length > 0) {
            setSelected(newSelected);
            setAmounts(newAmounts);
            toast.success("Split unequally!", { id: toastId });
          }
        }
      } else {
        setSplitMode("equally");
        // 5. Split Participants (Only for Equal Split usually, but can be used for Unequal if amounts not specified)
        if (data.splitWith && Array.isArray(data.splitWith)) {
            if (
            data.splitWith.includes("ALL") ||
            data.splitWith.includes("everyone")
            ) {
            const allIds = members.map((m) => m._id);
            setSelected(allIds);
            toast.success("Selected everyone!", { id: toastId });
            } else {
            const newSelected = [];
            data.splitWith.forEach((name) => {
                const friend = members.find((m) =>
                    m && m.username.toLowerCase().includes(name.toLowerCase())
                );
                if (friend) newSelected.push(friend._id);
            });

            if (newSelected.length > 0) {
                setSelected(newSelected);
                toast.success(`Selected ${newSelected.length} people`, {
                id: toastId,
                });
            }
            }
        } else if (data.friendName && !data.splitDetails) {
            // Fallback for simple case
            const friend = members.find(
            (m) =>
                m && m.username.toLowerCase().includes(data.friendName.toLowerCase())
            );

            if (friend) {
            if (!selected.includes(friend._id)) {
                setSelected((prev) => [...prev, friend._id]);
            }
            toast.success(`Selected ${friend.username}`, { id: toastId });
            }
        } else if (!data.splitDetails) {
             toast.success("Expense details filled!", { id: toastId });
        }
      }

    } catch (err) {
      console.error(err);
      const errorMsg =
        err.response?.data?.error || "Failed to parse voice command.";
      toast.error(errorMsg, { id: toastId });
    } finally {
      clearTimeout(safetyTimeout);
      setIsProcessingVoice(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-indigo-500/30 flex flex-col relative pb-20 md:pb-0">
      {/* --- BACKGROUND FX --- */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[20%] w-[500px] h-[500px] bg-indigo-900/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-fuchsia-900/10 rounded-full blur-[100px]"></div>
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03]"></div>
      </div>

      <div className="relative z-10 w-full max-w-2xl mx-auto flex flex-col h-full flex-1 p-4 sm:p-6">
        {/* --- HEADER --- */}
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center gap-4 mb-8"
        >
          <button
            onClick={() => navigate(-1)}
            className="group p-3 rounded-full bg-zinc-900/50 border border-white/10 hover:border-indigo-500/50 hover:bg-indigo-500/10 transition-all duration-300 backdrop-blur-md shadow-lg"
          >
            <ArrowLeft className="w-5 h-5 text-zinc-400 group-hover:text-indigo-400 transition-colors" />
          </button>
          <h1 className="text-xl font-bold text-white tracking-tight uppercase">
            New Transaction
          </h1>
        </motion.div>

        {/* --- MAIN FORM --- */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
          className="flex-1 space-y-6"
        >
          {/* 1. AMOUNT INPUT (Hero) */}
          <div className="flex flex-col items-center justify-center py-8">
            <span className="text-zinc-500 text-sm font-medium uppercase tracking-widest mb-2">
              Total Amount
            </span>
            <div className="relative flex items-center justify-center">
              <span className="text-4xl sm:text-6xl text-zinc-600 font-mono font-light mr-2">
                ₹
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={mainAmount}
                onChange={(e) => setMainAmount(e.target.value)}
                placeholder="0"
                className="bg-transparent text-5xl sm:text-7xl font-mono font-bold text-white placeholder-zinc-800 text-center focus:outline-none w-full max-w-[300px]"
                autoFocus
              />
            </div>

            {/* Voice Command Button (Emergency Style) */}
            <button
                type="button"
                onClick={handleVoiceInput}
                disabled={isListening || isProcessingVoice}
                className={`mt-6 sm:mt-8 w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl ${
                  isListening
                    ? "bg-red-500 animate-pulse ring-4 ring-red-500/50 shadow-[0_0_50px_rgba(220,38,38,0.6)] scale-110"
                    : "bg-gradient-to-br from-red-600 to-red-800 text-white hover:scale-110 hover:shadow-[0_0_30px_rgba(220,38,38,0.5)] border-4 border-red-900/30 active:scale-95"
                }`}
                title="Use Voice Command"
            >
                {isProcessingVoice ? (
                  <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 animate-spin text-white/90" />
                ) : (
                  <Mic className={`w-6 h-6 sm:w-8 sm:h-8 text-white drop-shadow-md ${isListening ? "animate-bounce" : ""}`} />
                )}
            </button>
            <p className="text-zinc-500 text-xs mt-3 font-medium tracking-wide uppercase opacity-60">
                Tap to Speak
            </p>
          </div>

          {/* 2. DETAILS CARD (Title & Payer) */}
          <div className="bg-zinc-900/40 border border-white/5 rounded-2xl overflow-hidden backdrop-blur-sm">
            {/* Title Input */}
            <div className="border-b border-white/5 p-1">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What is this for? (e.g. Dinner, Uber)"
                className="w-full bg-transparent px-3 sm:px-4 py-3 sm:py-4 text-base sm:text-lg text-white placeholder-zinc-600 focus:outline-none focus:bg-white/5 transition-colors rounded-xl"
              />
            </div>

            {/* Payer Selector */}
            <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 bg-zinc-900/60">
              <span className="text-sm text-zinc-400 font-medium">Paid by</span>
              <div className="relative">
                <select
                  value={paidBy}
                  onChange={(e) => setPaidBy(e.target.value)}
                  className="appearance-none bg-indigo-600/10 border border-indigo-500/30 text-indigo-300 py-1.5 pl-3 pr-8 rounded-lg text-sm font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer hover:bg-indigo-600/20 transition-colors"
                >
                  <option value="" disabled>
                    Select
                  </option>
                  {members.map((member) => (
                    <option
                      key={member._id}
                      value={member._id}
                      className="bg-zinc-900 text-white"
                    >
                      {member.username}
                    </option>
                  ))}
                </select>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-indigo-400">
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* 3. SPLIT ENGINE */}
          <div className="space-y-4">
            {/* Split Toggle */}
            <div className="bg-zinc-900 border border-white/10 p-1 rounded-xl flex relative">
              <button
                onClick={() => setSplitMode("equally")}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-300 relative z-10 ${
                  splitMode === "equally"
                    ? "text-white shadow-lg bg-zinc-800"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                Split Equally
              </button>
              <button
                onClick={() => setSplitMode("unequally")}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-300 relative z-10 ${
                  splitMode === "unequally"
                    ? "text-white shadow-lg bg-zinc-800"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                Split Unequally
              </button>
            </div>

            {/* Select All Toggle */}
            <div className="flex justify-end px-2">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div
                  className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                    selectAll
                      ? "bg-indigo-600 border-indigo-600"
                      : "border-zinc-600 group-hover:border-zinc-400"
                  }`}
                >
                  {selectAll && (
                    <svg
                      className="w-3 h-3 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </div>
                <input
                  type="checkbox"
                  checked={selectAll}
                  onChange={handleSelectAll}
                  className="hidden"
                />
                <span className="text-xs font-medium text-zinc-400 group-hover:text-zinc-200 transition-colors">
                  Select All
                </span>
              </label>
            </div>

            {/* Members List */}
            <div className="space-y-2">
              {members.map((member) => {
                const isSelected = selected.includes(member._id);
                return (
                  <div
                    key={member._id}
                    onClick={() => handleCheckboxChange(member._id)}
                    className={`group flex items-center justify-between p-2.5 sm:p-3 rounded-xl border transition-all duration-200 cursor-pointer ${
                      isSelected
                        ? "bg-indigo-900/10 border-indigo-500/30 shadow-[0_0_15px_-5px_rgba(99,102,241,0.1)]"
                        : "bg-zinc-900/20 border-white/5 hover:border-white/10"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Checkbox Visual */}
                      <div
                        className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                          isSelected
                            ? "bg-indigo-500 border-indigo-500"
                            : "border-zinc-700 bg-zinc-900"
                        }`}
                      >
                        {isSelected && (
                          <svg
                            className="w-3.5 h-3.5 text-white"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={3}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        )}
                      </div>
                      <span
                        className={`text-sm sm:text-base font-medium ${
                          isSelected
                            ? "text-white"
                            : "text-zinc-500 group-hover:text-zinc-300"
                        }`}
                      >
                        {member.username}
                      </span>
                    </div>

                    {/* Amount Input/Display */}
                    {isSelected && (
                      <div onClick={(e) => e.stopPropagation()}>
                        {splitMode === "equally" ? (
                          <span className="text-emerald-400 font-mono font-medium text-sm sm:text-base">
                            ₹{equalSplitAmount}
                          </span>
                        ) : (
                          <div className="relative w-20 sm:w-24">
                            <span className="absolute left-1.5 sm:left-2 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">
                              ₹
                            </span>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={amounts[member._id] || ""}
                              onChange={(e) =>
                                handleAmountChange(e, member._id)
                              }
                              placeholder="0"
                              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg py-1 sm:py-1.5 pl-4 sm:pl-5 pr-2 text-right text-white font-mono text-xs sm:text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>

        {/* --- FOOTER ACTIONS --- */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.16 }}
          className="mt-8 sticky bottom-4 z-20"
        >
          {/* Unequal Split Validator Bar */}
          {splitMode === "unequally" && (
            <div
              className={`mb-3 px-4 py-2 rounded-lg border flex justify-between items-center text-xs font-bold uppercase tracking-wide backdrop-blur-md ${
                (parseFloat(mainAmount || 0) - calculateCustomTotal()).toFixed(
                  2
                ) === "0.00"
                  ? "bg-emerald-900/30 border-emerald-500/30 text-emerald-400"
                  : "bg-red-900/30 border-red-500/30 text-red-400"
              }`}
            >
              <span>Amount Remaining</span>
              <span className="font-mono text-sm">
                ₹
                {Math.abs(
                  parseFloat(mainAmount || 0) - calculateCustomTotal()
                ).toFixed(2)}
              </span>
            </div>
          )}

          <button
            onClick={handleAddExpense}
            disabled={!mainAmount || !title || !paidBy || isLoading}
            className={`w-full py-4 rounded-xl font-bold text-sm uppercase tracking-widest shadow-xl transition-all duration-300 transform active:scale-[0.98] ${
              !mainAmount || !title || !paidBy || isLoading
                ? "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-white/5"
                : "bg-white text-black hover:bg-zinc-200 hover:shadow-white/10"
            }`}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-zinc-400 border-t-zinc-800 rounded-full animate-spin"></span>
                Processing...
              </span>
            ) : (
              "Confirm Transaction"
            )}
          </button>
        </motion.div>
      </div>

      {/* --- SUCCESS / ERROR OVERLAY --- */}
      <AnimatePresence>
        {resultOverlay && (
          <motion.div
            className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-zinc-950/90 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={() => setResultOverlay(null)}
          >
            {resultOverlay.type === "success" ? (
              <>
                {/* Glow */}
                <motion.div
                  className="absolute w-44 h-44 rounded-full blur-3xl bg-emerald-500/20"
                  initial={{ scale: 0 }}
                  animate={{ scale: 2.5, opacity: 0 }}
                  transition={{ duration: 1.2, ease: "easeOut" }}
                />
                {/* Particles */}
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
                {/* Checkmark */}
                <motion.div
                  className="relative w-24 h-24 rounded-full border-2 border-emerald-500 flex items-center justify-center mb-5"
                  initial={{ scale: 0, rotate: -60 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 200, damping: 14, delay: 0.05 }}
                >
                  <motion.div
                    className="absolute inset-0 rounded-full bg-emerald-600/20"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.25, duration: 0.3 }}
                  />
                  <svg className="w-12 h-12 text-emerald-400" viewBox="0 0 24 24" fill="none">
                    <motion.path
                      d="M5 13l4 4L19 7"
                      stroke="currentColor"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ delay: 0.35, duration: 0.4, ease: "easeOut" }}
                    />
                  </svg>
                </motion.div>
                <motion.p
                  className="text-xl font-bold text-white mb-1"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  {resultOverlay.message}
                </motion.p>
                {resultOverlay.amount && (
                  <motion.p
                    className="text-3xl font-mono font-bold text-emerald-400 tracking-tight"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                  >
                    ₹{resultOverlay.amount.toFixed(2)}
                  </motion.p>
                )}
              </>
            ) : (
              <>
                {/* Error glow */}
                <motion.div
                  className="absolute w-44 h-44 rounded-full blur-3xl bg-red-500/20"
                  initial={{ scale: 0 }}
                  animate={{ scale: 2, opacity: 0 }}
                  transition={{ duration: 1, ease: "easeOut" }}
                />
                {/* X mark */}
                <motion.div
                  className="relative w-24 h-24 rounded-full border-2 border-red-500 flex items-center justify-center mb-5"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1, x: [0, -8, 8, -6, 6, 0] }}
                  transition={{ scale: { type: "spring", stiffness: 200, damping: 14 }, x: { delay: 0.3, duration: 0.4 } }}
                >
                  <motion.div
                    className="absolute inset-0 rounded-full bg-red-600/20"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, duration: 0.3 }}
                  />
                  <svg className="w-12 h-12 text-red-400" viewBox="0 0 24 24" fill="none">
                    <motion.path
                      d="M18 6L6 18"
                      stroke="currentColor"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ delay: 0.3, duration: 0.3 }}
                    />
                    <motion.path
                      d="M6 6l12 12"
                      stroke="currentColor"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ delay: 0.45, duration: 0.3 }}
                    />
                  </svg>
                </motion.div>
                <motion.p
                  className="text-xl font-bold text-white mb-1"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  Something went wrong
                </motion.p>
                <motion.p
                  className="text-sm text-zinc-400 text-center max-w-xs"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                >
                  {resultOverlay.message}
                </motion.p>
              </>
            )}
            <motion.p
              className="text-xs text-zinc-500 mt-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
            >
              Tap anywhere to dismiss
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
      {/* --- VOICE LISTENING MODAL --- */}
      {isListening && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative">
            {/* Pulsing Circles */}
            <div className="absolute inset-0 bg-indigo-500 rounded-full animate-ping opacity-75 blur-xl"></div>
            <div className="absolute inset-0 bg-cyan-500 rounded-full animate-ping delay-75 opacity-50 blur-lg"></div>
            
            {/* Main Mic Icon */}
            <div className="relative w-24 h-24 bg-gradient-to-br from-indigo-600 to-cyan-500 rounded-full flex items-center justify-center shadow-2xl border-4 border-white/10">
              <Mic className="w-10 h-10 text-white animate-bounce" />
            </div>
          </div>
          
          <h3 className="mt-8 text-2xl font-bold text-white tracking-tight animate-pulse">
            Listening...
          </h3>
          <p className="text-zinc-400 mt-2 text-sm italic">
            Say "Dinner 500 paid by Rahul split with everyone"
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
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
             <div className="relative mb-8 w-24 h-24 animate-glow-pulse">
                <div className="absolute inset-0 border-4 border-indigo-500/30 rounded-full"></div>
                <div className="absolute inset-0 border-t-4 border-cyan-400 rounded-full animate-spin"></div>
                <div className="absolute inset-2 border-b-4 border-indigo-400 rounded-full animate-spin-reverse"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                   <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
                </div>
             </div>
             <h3 className="text-2xl font-bold text-white tracking-tight animate-pulse text-center px-4">
               Fair AI is working for you... 🤖
             </h3>
             <p className="text-zinc-400 mt-4 text-sm max-w-xs text-center">
                Decoding your expense details. Just a moment!
             </p>
        </div>
      )}
    </div>
  );
};

export default AddExpense;
