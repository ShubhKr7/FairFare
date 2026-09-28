import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { X, Receipt, CheckCircle, Search, Sparkles, Wand2, Loader2, Mic, MicOff, Users, Wallet, ChevronRight, ArrowLeft } from "lucide-react";
import api from "../utils/api";
import toast from "react-hot-toast";
import Cookies from "js-cookie";
import { motion, AnimatePresence } from "framer-motion";

const QuickAddExpenseModal = ({ isOpen, onClose, user, autoStartVoice }) => {
    const navigate = useNavigate();

    // Mode: "personal" (default), "group", or "friends"
    const [mode, setMode] = useState("personal");

    // Personal expense fields
    const [description, setDescription] = useState("");
    const [amount, setAmount] = useState("");
    const [loading, setLoading] = useState(false);

    // Group selection
    const [trips, setTrips] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [tripsLoading, setTripsLoading] = useState(false);

    const [friends, setFriends] = useState([]);
    const [selectedFriends, setSelectedFriends] = useState([]);
    const [splitMode, setSplitMode] = useState("equally");
    const [customAmounts, setCustomAmounts] = useState({});
    const [paidBy, setPaidBy] = useState("");
    const [friendsLoading, setFriendsLoading] = useState(false);
    const [isFriendsFormOpen, setIsFriendsFormOpen] = useState(false);
    const [includeMe, setIncludeMe] = useState(true);

    // AI magic fields
    const [magicPrompt, setMagicPrompt] = useState("");
    const [isMagicLoading, setIsMagicLoading] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [showManual, setShowManual] = useState(false);
    const [highlightFields, setHighlightFields] = useState(false);
    const recognitionRef = useRef(null);

    // Success overlay
    const [successOverlay, setSuccessOverlay] = useState(null); // { amount, description }

    const API_BASE = import.meta.env.VITE_API_BASE_URL;

    // Fetch data based on mode
    useEffect(() => {
        const currentUserId = Cookies.get("id");
        if (currentUserId) setPaidBy(currentUserId);
        
        if (mode === "group" && trips.length === 0) {
            fetchTrips();
        } else if (mode === "friends" && friends.length === 0) {
            fetchFriends();
        }
    }, [mode]);

    const fetchFriends = async () => {
        try {
            setFriendsLoading(true);
            const userId = Cookies.get("id");
            const response = await api.get(`/user/${userId}`);
            if (response.status === 200 && response.data.user) {
                setFriends(response.data.user.friends || []);
            }
        } catch (error) {
            console.error("Failed to load friends:", error);
            toast.error("Failed to load friends list");
        } finally {
            setFriendsLoading(false);
        }
    };

    const fetchTrips = async () => {
        try {
            setTripsLoading(true);
            const userId = Cookies.get("id");
            if (!userId) return;
            const response = await api.get(`/group/user-groups/${userId}`);
            if (response.status === 200 && Array.isArray(response.data)) {
                const validGroups = response.data.filter(g => g !== null && g.name);
                setTrips(validGroups);
            }
        } catch (error) {
            console.error("Failed to load trips:", error);
        } finally {
            setTripsLoading(false);
        }
    };

    const filteredTrips = trips.filter(trip =>
        trip.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredFriends = friends
        .filter(f => f.friend?.username?.toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a, b) => (a.friend?.username || "").localeCompare(b.friend?.username || ""));

    // --- AI Magic ---
    const handleMagicAdd = async (passedPrompt) => {
        const query = passedPrompt || magicPrompt;
        if (!query.trim()) {
            toast.error("Tell me what you paid for first!");
            return;
        }

        try {
            setIsMagicLoading(true);
            const userId = Cookies.get("id");
            
            // Use group_detailed context if in friends mode to get split details
            const response = await api.post("/ai/parse-expense", {
                prompt: query,
                userId: userId,
                context: mode === "friends" ? "group_detailed" : "personal",
                memberNames: mode === "friends" ? friends.filter(f => f.friend).map(f => f.friend.username) : []
            });

            if (response.status === 200) {
                const { amount: aiAmount, title: aiTitle, splitMode: aiSplitMode, splitWith: aiSplitWith, splitDetails: aiSplitDetails } = response.data;
                
                if (aiAmount) setAmount(aiAmount.toString());
                if (aiTitle) setDescription(aiTitle);
                
                if (mode === "friends") {
                    if (aiSplitMode) setSplitMode(aiSplitMode);
                    
                    if (response.data.paidBy) {
                        if (response.data.paidBy === "current_user") {
                            setPaidBy(userId);
                        } else {
                            const foundPayer = friends.find(f => f.friend?.username?.toLowerCase().includes(response.data.paidBy.toLowerCase()));
                            if (foundPayer) setPaidBy(foundPayer.friend?._id);
                        }
                    }
                    
                    if (aiSplitWith) {
                        setIsFriendsFormOpen(true);
                        if (aiSplitWith.includes("ALL") || aiSplitWith.includes("everyone")) {
                            setSelectedFriends(friends.map(f => f.friend?._id));
                        } else {
                            const newSelected = friends
                                .filter(f => f.friend && aiSplitWith.some(name => f.friend.username.toLowerCase().includes(name.toLowerCase())))
                                .map(f => f.friend?._id);
                            setSelectedFriends(newSelected);
                        }
                    }
                    
                    if (aiSplitDetails && Array.isArray(aiSplitDetails)) {
                        setIsFriendsFormOpen(true);
                        const newAmounts = {};
                        const newSelected = [...selectedFriends];
                        
                        aiSplitDetails.forEach(detail => {
                            const f = friends.find(fr => fr.friend?.username?.toLowerCase().includes(detail.name.toLowerCase()));
                            if (f) {
                                newAmounts[f.friend?._id] = detail.amount.toString();
                                if (!newSelected.includes(f.friend?._id)) newSelected.push(f.friend?._id);
                            }
                        });
                        
                        setCustomAmounts(newAmounts);
                        setSelectedFriends(newSelected);
                    }
                }

                if (aiAmount || aiTitle || (mode === "friends" && (aiSplitWith || aiSplitDetails))) {
                    setShowManual(true);
                }

                toast.success("Magic applied! Fields updated.");
                setHighlightFields(true);
                setTimeout(() => setHighlightFields(false), 2000);
            }
        } catch (error) {
            console.error("Magic Add Error:", error);
            toast.error("AI is currently sleepy. Please enter manually.");
            setShowManual(true);
        } finally {
            setIsMagicLoading(false);
        }
    };

    // --- Voice ---
    const startListening = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            toast.error("Voice input is not supported in your browser.");
            return;
        }
        if (isListening) {
            recognitionRef.current?.stop();
            return;
        }
        const recognition = new SpeechRecognition();
        recognition.lang = 'en-IN';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        recognition.onstart = () => {
            setIsListening(true);
            toast("Listening...", { icon: '🎤', id: "voice-toast" });
        };
        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            setMagicPrompt(transcript);
            setIsListening(false);
            handleMagicAdd(transcript);
        };
        recognition.onerror = (event) => {
            console.error("Speech Recognition Error:", event.error);
            setIsListening(false);
            if (event.error === 'not-allowed') {
                toast.error("Microphone access blocked. Please enable it in browser settings.", { duration: 5000 });
            } else if (event.error !== 'no-speech') {
                toast.error("Could not understand. Try again!");
            }
        };
        recognition.onend = () => {
            setIsListening(false);
        };
        recognitionRef.current = recognition;
        recognition.start();
    };

    useEffect(() => {
        if (autoStartVoice && isOpen && !isListening) {
            // Small delay to ensure modal animation finishes before starting mic
            setTimeout(() => {
                startListening();
            }, 500);
        }
    }, [autoStartVoice, isOpen]);

    // --- Submit Expense ---
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!description || !amount) {
            toast.error("Please fill description and amount");
            return;
        }

        if (Number(amount) <= 0) {
            toast.error("Amount must be greater than zero");
            return;
        }

        if (mode === "friends") {
            if (!paidBy) {
                toast.error("Please select who paid for this expense");
                return;
            }
            if (selectedFriends.length === 0) {
                toast.error("Please select at least one friend to split with");
                return;
            }

            // Circular Expense Check: Ensure someone other than the payer owes money
            const userId = Cookies.get("id");
            const involvedMembers = includeMe ? [userId, ...selectedFriends] : selectedFriends;
            const otherDebtors = involvedMembers.filter(id => id !== paidBy);
            
            if (otherDebtors.length === 0) {
                toast.error("You cannot create an expense where only the payer owes money!");
                return;
            }

            // User Involvement Validation: User must be either the payer or a debtor
            const isUserInvolved = (paidBy === userId) || includeMe;
            if (!isUserInvolved) {
                toast.error("You must be involved in the expense (either you paid, or you owe).");
                return;
            }
        }

        try {
            setLoading(true);
            const userId = Cookies.get("id");
            
            let payload;
            let endpoint;

            if (mode === "personal") {
                endpoint = "/expenses/personal";
                payload = {
                    description: description,
                    amount: Number(Number(amount).toFixed(2)),
                    date: new Date(),
                };
            } else if (mode === "friends") {
                endpoint = "/group/add-expense";
                // Add current user to involved members only if includeMe is true
                const involvedMembers = includeMe ? [userId, ...selectedFriends] : selectedFriends;
                
                payload = {
                    title: description,
                    amount: Number(Number(amount).toFixed(2)),
                    paidBy: paidBy || userId,
                    groupId: null, // No group
                    splitMode: splitMode,
                    involvedMembers: involvedMembers,
                    customAmounts: splitMode === "unequally" ? customAmounts : {},
                };

                // Validate unequal split
                if (splitMode === "unequally") {
                    const totalCustom = Object.values(customAmounts).reduce((sum, val) => sum + Number(val || 0), 0);
                    if (Math.abs(totalCustom - Number(amount)) > 0.01) {
                        toast.error(`Total doesn't match! Your splits add up to ₹${totalCustom.toFixed(2)} but total is ₹${Number(amount).toFixed(2)}`);
                        setLoading(false);
                        return;
                    }
                }
            }

            const response = await api.post(endpoint, payload);

            if (response.status === 201 || response.status === 200) {
                setSuccessOverlay({ amount: Number(amount), description });
                // Auto-close after celebration
                setTimeout(() => {
                    setSuccessOverlay(null);
                    onClose();
                    navigate(mode === "personal" ? "/personal-expenses" : "/dash");
                }, 2500);
            }
        } catch (error) {
            console.error("Error creating expense:", error);
            toast.error(error.response?.data?.message || "Failed to add expense");
        } finally {
            setLoading(false);
        }
    };

    // --- Navigate to group add-expense ---
    const handleGroupSelect = async (group) => {
        try {
            // Fetch full group metadata to ensure all members and details are present
            const response = await api.get(`${API_BASE}/group/get-group/${group?._id}`);
            if (response.status === 200) {
                localStorage.setItem("currentGroup", JSON.stringify(response.data));
                
                // Also set tripMembers for consistency if other components use it
                const groupMembers = (response.data.members || []).map((m) => ({
                    _id: m?._id,
                    username: m.username,
                }));
                localStorage.setItem("tripMembers", JSON.stringify(groupMembers));
            }
        } catch (error) {
            console.error("Failed to fetch group metadata:", error);
            // Fallback to storing the group object if fetch fails
            localStorage.setItem("currentGroup", JSON.stringify(group));
        }

        onClose();
        navigate("/add-expense", { 
            state: { 
                propGroupId: group?._id,
                prefillTitle: description,
                prefillAmount: amount
            } 
        });
    };

    // Reset state on close
    const handleClose = () => {
        setMode("personal");
        setDescription("");
        setAmount("");
        setMagicPrompt("");
        setShowManual(false);
        setSearchQuery("");
        setSuccessOverlay(null);
        setSelectedFriends([]);
        setSplitMode("equally");
        setCustomAmounts({});
        setPaidBy(Cookies.get("id") || "");
        setIsFriendsFormOpen(false);
        setIncludeMe(true);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm"
                onClick={handleClose}
            />

            {/* Modal Content */}
            <motion.div
                initial={{ opacity: 0, scale: 0.85, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 10 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="relative w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
            >

                {/* ── SUCCESS CELEBRATION OVERLAY ── */}
                <AnimatePresence>
                    {successOverlay && (
                        <motion.div
                            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-zinc-900 rounded-2xl overflow-hidden"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            {/* Background glow */}
                            <motion.div
                                className="absolute w-64 h-64 rounded-full bg-emerald-500/15 blur-3xl"
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 2.5, opacity: 1 }}
                                transition={{ duration: 1, ease: "easeOut" }}
                            />

                            {/* Expanding rings */}
                            {[0, 1, 2].map((i) => (
                                <motion.div
                                    key={i}
                                    className="absolute w-28 h-28 rounded-full border border-emerald-500/30"
                                    initial={{ scale: 0, opacity: 0.8 }}
                                    animate={{ scale: 3.5 + i, opacity: 0 }}
                                    transition={{ duration: 1.5, delay: 0.2 + i * 0.15, ease: "easeOut" }}
                                />
                            ))}

                            {/* Confetti particles */}
                            {[...Array(10)].map((_, i) => (
                                <motion.div
                                    key={`confetti-${i}`}
                                    className="absolute w-2 h-2 rounded-full"
                                    style={{
                                        background: ['#34d399', '#60a5fa', '#a78bfa', '#f472b6', '#fbbf24'][i % 5],
                                    }}
                                    initial={{ scale: 0, x: 0, y: 0, opacity: 1 }}
                                    animate={{
                                        scale: [0, 1.5, 0.8],
                                        x: Math.cos((i * Math.PI * 2) / 10) * 100,
                                        y: Math.sin((i * Math.PI * 2) / 10) * 100,
                                        opacity: [1, 1, 0],
                                    }}
                                    transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
                                />
                            ))}

                            {/* Checkmark circle */}
                            <motion.div
                                className="relative w-24 h-24 rounded-full border-2 border-emerald-500 flex items-center justify-center mb-6 z-10"
                                initial={{ scale: 0, rotate: -60 }}
                                animate={{ scale: 1, rotate: 0 }}
                                transition={{ type: "spring", stiffness: 200, damping: 14, delay: 0.1 }}
                            >
                                <motion.div
                                    className="absolute inset-0 rounded-full bg-emerald-600/20"
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ delay: 0.3, duration: 0.3 }}
                                />
                                <svg className="w-12 h-12 text-emerald-400 z-10" viewBox="0 0 24 24" fill="none">
                                    <motion.path
                                        d="M5 13l4 4L19 7"
                                        stroke="currentColor"
                                        strokeWidth={2.5}
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        initial={{ pathLength: 0 }}
                                        animate={{ pathLength: 1 }}
                                        transition={{ delay: 0.4, duration: 0.4, ease: "easeOut" }}
                                    />
                                </svg>
                            </motion.div>

                            {/* Text */}
                            <motion.h3
                                className="text-xl font-bold text-white mb-1 z-10"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.5 }}
                            >
                                Expense Added! 🎉
                            </motion.h3>
                            <motion.p
                                className="text-zinc-400 text-sm mb-6 z-10"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.6 }}
                            >
                                {mode === "personal" ? "Personal expense tracked successfully" : "Shared expense recorded successfully"}
                            </motion.p>

                            {/* Amount card */}
                            <motion.div
                                className="bg-zinc-800/80 border border-emerald-500/20 rounded-xl px-6 py-4 text-center z-10"
                                initial={{ opacity: 0, y: 15, scale: 0.9 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                transition={{ delay: 0.65, type: "spring", stiffness: 200 }}
                            >
                                <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold mb-1">
                                    Amount
                                </p>
                                <p className="text-3xl font-bold text-emerald-400 font-mono">
                                    ₹{successOverlay.amount.toFixed(2)}
                                </p>
                                <p className="text-xs text-zinc-400 mt-1 truncate max-w-[200px]">
                                    {successOverlay.description}
                                </p>
                            </motion.div>

                            {/* Redirect hint */}
                            <motion.p
                                className="text-zinc-600 text-xs mt-5 z-10"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 1 }}
                            >
                                Redirecting to your expenses...
                            </motion.p>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── HEADER ── */}
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.3, ease: "easeOut" }}
                    className="p-4 border-b border-white/5 flex items-center justify-between bg-zinc-900/50"
                >
                    <div className="flex items-center gap-3">
                        {mode === "group" && (
                            <motion.button
                                onClick={() => setMode("personal")}
                                className="p-1.5 hover:bg-white/5 rounded-lg transition-colors text-zinc-400 hover:text-white"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                whileTap={{ scale: 0.9 }}
                            >
                                <ArrowLeft className="w-4 h-4" />
                            </motion.button>
                        )}
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${mode === "personal" ? "bg-emerald-500/10 text-emerald-400" : mode === "friends" ? "bg-amber-500/10 text-amber-400" : "bg-indigo-500/10 text-indigo-400"} transition-colors`}>
                            {mode === "personal" ? <Wallet className="w-5 h-5" /> : mode === "friends" ? <Sparkles className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white tracking-tight">
                                {mode === "personal" ? "Quick Expense" : mode === "friends" ? "Split with Friends" : "Choose a Group"}
                            </h2>
                            <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">
                                {mode === "personal" ? "Personal • Powered by AI" : mode === "friends" ? "No group needed • Shared" : "Select a group to add expense"}
                            </p>
                        </div>
                    </div>
                    <button onClick={handleClose} className="p-2 hover:bg-white/5 rounded-lg transition-colors text-zinc-500">
                        <X className="w-5 h-5" />
                    </button>
                </motion.div>

                {/* ── BODY ── */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15, duration: 0.35, ease: "easeOut" }}
                    className="p-6 flex flex-col gap-5 max-h-[80vh] overflow-y-auto scrollbar-hide"
                >
                    <AnimatePresence mode="wait">
                        {(mode === "personal" || (mode === "friends" && isFriendsFormOpen)) ? (
                            <motion.div
                                key={mode}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.25 }}
                                className="flex flex-col gap-5"
                            >
                                {/* ── AI Magic Box ── */}
                                <div className="relative">
                                    <div className={`relative bg-zinc-950 border transition-all duration-300 rounded-2xl p-4 ${isListening ? 'border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.1)]' : 'border-white/10'}`}>
                                        {isListening && (
                                            <div className="absolute top-0 left-0 right-0 h-1 bg-red-500/20 blur-sm overflow-hidden rounded-t-2xl">
                                                <div className="h-full bg-red-500 w-1/3 animate-[shimmer_1.5s_infinite]" />
                                            </div>
                                        )}
                                        <div className="flex items-start gap-4">
                                            <motion.button
                                                type="button"
                                                onClick={startListening}
                                                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-xl flex-shrink-0 ${isListening
                                                    ? "bg-red-500 text-white animate-pulse"
                                                    : mode === "friends" ? "bg-amber-500 text-white hover:bg-amber-400" : "bg-emerald-500 text-white hover:bg-emerald-400"
                                                    }`}
                                                whileTap={{ scale: 0.9 }}
                                            >
                                                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                                            </motion.button>
                                            <div className="flex-1 min-w-0">
                                                <textarea
                                                    value={magicPrompt}
                                                    onChange={(e) => setMagicPrompt(e.target.value)}
                                                    placeholder={isListening ? "I'm listening..." : mode === "friends" ? "Split 500 with Alice and Bob for Pizza..." : "Tell me what you spent on, e.g.\n'Coffee 150' or 'Groceries 500'"}
                                                    rows={2}
                                                    className="w-full bg-transparent border-none text-white text-base focus:outline-none placeholder:text-zinc-600 resize-none py-1 scrollbar-hide"
                                                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleMagicAdd())}
                                                />
                                            </div>
                                        </div>
                                        <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3">
                                            <span className="text-[10px] text-zinc-500 font-medium italic">
                                                {isMagicLoading ? "AI is thinking..." : isListening ? "Listening closely..." : "Press Enter or Wand to apply"}
                                            </span>
                                            <motion.button
                                                type="button"
                                                onClick={() => handleMagicAdd()}
                                                disabled={isMagicLoading || (!magicPrompt.trim() && !isListening)}
                                                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 text-white text-xs font-bold transition-all flex items-center gap-2"
                                                whileTap={{ scale: 0.95 }}
                                            >
                                                {isMagicLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                                                Apply Magic
                                            </motion.button>
                                        </div>
                                    </div>
                                </div>

                                {/* Friends/Split details when in friends mode */}
                                {mode === "friends" && selectedFriends.length > 0 && (
                                    <div className="flex flex-col gap-3 p-4 bg-zinc-950/50 rounded-2xl border border-white/5">
                                        <div className="flex flex-col gap-3">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Splitting With</h4>
                                                <button
                                                    type="button"
                                                    onClick={() => setIncludeMe(!includeMe)}
                                                    className={`px-2 py-1 rounded-md text-[9px] font-bold uppercase transition-all border ${includeMe ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-zinc-800 border-white/5 text-zinc-500'}`}
                                                >
                                                    {includeMe ? "Including You" : "Excluding You"}
                                                </button>
                                            </div>
                                            <div className="flex flex-wrap gap-2 items-center">
                                                {/* Me in the split list */}
                                                {includeMe && (
                                                    <div className="px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 text-xs font-medium flex items-center gap-2 shadow-sm shadow-emerald-500/5">
                                                        <span>You</span>
                                                        {splitMode === "equally" && amount && (
                                                            <span className="text-[10px] text-emerald-500/80 font-bold">₹{(Number(amount) / (selectedFriends.length + 1)).toFixed(2)}</span>
                                                        )}
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setIncludeMe(false);
                                                            }}
                                                            className="hover:text-emerald-100 p-0.5 rounded-md hover:bg-emerald-500/20"
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                )}

                                                {selectedFriends.map(id => {
                                                    const friendObj = friends.find(f => f.friend?._id === id);
                                                    const totalSplitters = selectedFriends.length + (includeMe ? 1 : 0);
                                                    const share = amount ? (Number(amount) / totalSplitters).toFixed(2) : "0";
                                                    return (
                                                        <div key={id} className="px-2 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs font-medium flex items-center gap-2 transition-all hover:bg-amber-500/15">
                                                            <div className="w-5 h-5 rounded-full overflow-hidden bg-amber-500/20 border border-amber-500/30 flex-shrink-0">
                                                                {friendObj?.friend?.profilePhotoUrl ? (
                                                                    <img src={friendObj.friend.profilePhotoUrl} alt="" className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center text-[8px] font-bold text-amber-400">
                                                                        {friendObj?.friend?.username?.[0]?.toUpperCase()}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <span className="truncate max-w-[80px]">{friendObj?.friend?.username}</span>
                                                            {splitMode === "equally" && amount && (
                                                                <span className="text-[10px] text-amber-500/80 font-bold">₹{share}</span>
                                                            )}
                                                            <button 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setSelectedFriends(prev => prev.filter(fid => fid !== id));
                                                                }}
                                                                className="hover:text-amber-100 p-0.5 rounded-md hover:bg-amber-500/20"
                                                            >
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    );
                                                })}

                                                {/* Add friend button */}
                                                <button
                                                    type="button"
                                                    onClick={() => setIsFriendsFormOpen(false)}
                                                    className="w-7 h-7 rounded-full bg-zinc-800 border border-dashed border-white/10 flex items-center justify-center text-zinc-500 hover:text-amber-400 hover:border-amber-400/50 hover:bg-amber-500/5 transition-all group"
                                                >
                                                    <span className="text-lg font-light leading-none group-active:scale-95 transition-transform">+</span>
                                                </button>
                                            </div>
                                        </div>
                                        
                                        <div className="h-px bg-white/5 my-1" />
                                        
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => setSplitMode("equally")}
                                                className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${splitMode === "equally" ? "bg-amber-500 text-white shadow-lg shadow-amber-500/20" : "bg-white/5 text-zinc-500"}`}
                                            >
                                                Equally
                                            </button>
                                            <button 
                                                onClick={() => setSplitMode("unequally")}
                                                className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${splitMode === "unequally" ? "bg-amber-500 text-white shadow-lg shadow-amber-500/20" : "bg-white/5 text-zinc-500"}`}
                                            >
                                                Unequally
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div className="h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />

                                {/* Manual toggle */}
                                <div className="flex justify-center">
                                    <button
                                        type="button"
                                        onClick={() => setShowManual(!showManual)}
                                        className={`text-[11px] font-bold text-zinc-500 hover:text-${mode === "friends" ? "amber" : "emerald"}-400 transition-colors uppercase tracking-[0.2em] flex items-center gap-2`}
                                    >
                                        {showManual ? "Hide details" : "Show details"}
                                        <motion.div
                                            animate={{ rotate: showManual ? 180 : 0 }}
                                            transition={{ duration: 0.25 }}
                                        >↓</motion.div>
                                    </button>
                                </div>

                                {/* Manual Fields */}
                                <AnimatePresence>
                                    {showManual && (
                                        <motion.form
                                            onSubmit={handleSubmit}
                                            className="flex flex-col gap-5"
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: "auto" }}
                                            exit={{ opacity: 0, height: 0 }}
                                            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                                        >
                                            {/* Amount */}
                                            <motion.div
                                                className={`transition-all duration-500 ${highlightFields ? `scale-[1.02] ring-2 ring-${mode === "friends" ? "amber" : "emerald"}-500/50 rounded-2xl` : ''}`}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: 0.05 }}
                                            >
                                                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2 block px-1">Amount (₹)</label>
                                                <input
                                                    type="number"
                                                    value={amount}
                                                    onChange={(e) => setAmount(e.target.value)}
                                                    onBlur={() => {
                                                        if (amount && !isNaN(amount)) {
                                                            setAmount(prev => (!isNaN(prev) && prev !== "") ? Number(prev).toFixed(2) : prev);
                                                        }
                                                    }}
                                                    placeholder="0"
                                                    className={`w-full bg-zinc-950 border border-white/10 rounded-2xl p-4 text-3xl font-bold text-white text-center focus:outline-none focus:border-${mode === "friends" ? "amber" : "emerald"}-500/50 transition-colors`}
                                                />
                                            </motion.div>

                                            {splitMode === "unequally" && (
                                                <div className="flex flex-col gap-3 p-4 bg-zinc-950/50 rounded-2xl border border-white/5">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Fixed Amounts</h4>
                                                        <div className={`text-[10px] font-bold uppercase tracking-widest ${Math.abs((Object.values(customAmounts).reduce((a, b) => Number(a) + Number(b), 0)) - Number(amount)) < 0.01 ? 'text-emerald-500' : 'text-amber-500'}`}>
                                                            {amount ? `Total: ₹${amount}` : 'Enter Total Amount First'}
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Me in unequal input */}
                                                    {includeMe && (
                                                        <div className="flex items-center gap-4 py-2 border-b border-white/5">
                                                            <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] font-bold">You</div>
                                                            <span className="text-sm text-zinc-300 flex-1">Your Share</span>
                                                            <div className="relative w-24">
                                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 text-[10px]">₹</span>
                                                                <input 
                                                                    type="number"
                                                                    value={customAmounts[Cookies.get("id")] || ""}
                                                                    onChange={(e) => setCustomAmounts(prev => ({ ...prev, [Cookies.get("id")]: e.target.value }))}
                                                                    onBlur={() => {
                                                                        const val = customAmounts[Cookies.get("id")];
                                                                        if (val && !isNaN(val)) {
                                                                            setCustomAmounts(prev => ({ ...prev, [Cookies.get("id")]: Number(val).toFixed(2) }));
                                                                        }
                                                                    }}
                                                                    className="w-full bg-zinc-950 border border-white/10 rounded-lg py-1.5 pl-6 pr-2 text-white font-mono text-sm focus:outline-none focus:border-amber-500/50"
                                                                    placeholder="0"
                                                                    autoFocus={mode === "friends" && splitMode === "unequally"}
                                                                />
                                                            </div>
                                                        </div>
                                                    )}

                                                    {selectedFriends.map(id => {
                                                        const friendObj = friends.find(f => f.friend?._id === id);
                                                        return (
                                                            <div key={id} className="flex items-center gap-4 py-2 border-b last:border-b-0 border-white/5">
                                                                <div className="w-8 h-8 rounded-full overflow-hidden bg-amber-500/10 border border-amber-500/20 flex-shrink-0 flex items-center justify-center">
                                                                    {friendObj?.friend?.profilePhotoUrl ? (
                                                                        <img src={friendObj.friend.profilePhotoUrl} alt="" className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        <span className="text-[10px] font-bold text-amber-400">
                                                                            {friendObj?.friend?.username?.[0]?.toUpperCase()}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <span className="text-sm text-zinc-300 flex-1 truncate">{friendObj?.friend?.username}</span>
                                                                <div className="relative w-24">
                                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 text-[10px]">₹</span>
                                                                    <input 
                                                                        type="number"
                                                                        value={customAmounts[id] || ""}
                                                                        onChange={(e) => setCustomAmounts(prev => ({ ...prev, [id]: e.target.value }))}
                                                                        onBlur={() => {
                                                                            const val = customAmounts[id];
                                                                            if (val && !isNaN(val)) {
                                                                                setCustomAmounts(prev => ({ ...prev, [id]: Number(val).toFixed(2) }));
                                                                            }
                                                                        }}
                                                                        className="w-full bg-zinc-950 border border-white/10 rounded-lg py-1.5 pl-6 pr-2 text-white font-mono text-sm focus:outline-none focus:border-amber-500/50"
                                                                        placeholder="0"
                                                                    />
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                    {mode === "friends" && splitMode === "unequally" && amount && (() => {
                                                        const sum = Object.values(customAmounts).reduce((a, b) => Number(a) + Number(b), 0);
                                                        const diff = Number(amount) - sum;
                                                        if (Math.abs(diff) > 0.01) {
                                                            const isShort = diff > 0;
                                                            return (
                                                                <div className="px-2 py-1 text-[10px] text-amber-500 italic flex items-center gap-1.5 bg-amber-500/5 rounded-lg border border-amber-500/10">
                                                                    <div className="w-1 h-1 rounded-full bg-amber-500 animate-pulse" />
                                                                    <span>Difference: <span className="font-bold">₹{Math.abs(diff).toFixed(2)} {isShort ? 'short' : 'over'}</span> from total</span>
                                                                </div>
                                                            );
                                                        }
                                                        return (
                                                            <div className="px-2 py-1.5 text-[10px] text-emerald-500 italic flex items-center gap-1.5 font-bold bg-emerald-500/5 rounded-lg border border-emerald-500/10">
                                                                <CheckCircle className="w-3 h-3" />
                                                                Exactly matched! ₹{sum.toFixed(2)} total.
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            )}

                                            {/* Description */}
                                            <motion.div
                                                className={`transition-all duration-500 delay-75 ${highlightFields ? `scale-[1.02] ring-2 ring-${mode === "friends" ? "amber" : "emerald"}-500/50 rounded-2xl` : ''}`}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: 0.1 }}
                                            >
                                                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2 block px-1">Description</label>
                                                <div className="relative">
                                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">
                                                        <Receipt className="w-4 h-4" />
                                                    </div>
                                                    <input
                                                        type="text"
                                                        value={description}
                                                        onChange={(e) => setDescription(e.target.value)}
                                                        placeholder="What did you spend on?"
                                                        className={`w-full bg-zinc-950 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white placeholder:text-zinc-600 focus:outline-none focus:border-${mode === "friends" ? "amber" : "emerald"}-500/50 transition-colors`}
                                                    />
                                                </div>
                                            </motion.div>

                                            {/* Who Paid Selection */}
                                            {mode === "friends" && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: 0.12 }}
                                                >
                                                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3 block px-1">Who paid?</label>
                                                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide py-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => setPaidBy(Cookies.get("id"))}
                                                            className={`flex-shrink-0 px-4 py-3 rounded-xl border transition-all flex flex-col items-center gap-1 min-w-[80px] ${paidBy === Cookies.get("id") ? 'bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-500/20' : 'bg-zinc-950 border-white/5 text-zinc-400 hover:border-amber-500/30'}`}
                                                        >
                                                            <div className={`w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-xs font-bold ${paidBy === Cookies.get("id") ? 'bg-white/20' : 'bg-zinc-800'}`}>
                                                                {user?.profilePhotoUrl ? (
                                                                    <img src={user.profilePhotoUrl} alt="" className="w-full h-full object-cover" />
                                                                ) : "You"}
                                                            </div>
                                                            <span className="text-[10px] font-medium truncate w-full text-center">Me</span>
                                                        </button>
                                                        {selectedFriends.map(id => {
                                                            const friendObj = friends.find(f => f.friend?._id === id);
                                                            const isPayer = paidBy === id;
                                                            return (
                                                                <button
                                                                    key={id}
                                                                    type="button"
                                                                    onClick={() => setPaidBy(id)}
                                                                    className={`flex-shrink-0 px-4 py-3 rounded-xl border transition-all flex flex-col items-center gap-1 min-w-[80px] ${isPayer ? 'bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-500/20' : 'bg-zinc-950 border-white/5 text-zinc-400 hover:border-amber-500/30'}`}
                                                                >
                                                                    <div className={`w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-xs font-bold ${isPayer ? 'bg-white/20' : 'bg-zinc-800'}`}>
                                                                        {friendObj?.friend?.profilePhotoUrl ? (
                                                                            <img src={friendObj.friend.profilePhotoUrl} alt="" className="w-full h-full object-cover" />
                                                                        ) : (
                                                                            friendObj?.friend?.username?.[0]?.toUpperCase()
                                                                        )}
                                                                    </div>
                                                                    <span className="text-[10px] font-medium truncate w-full text-center">{friendObj?.friend?.username}</span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </motion.div>
                                            )}

                                            <motion.button
                                                type="submit"
                                                disabled={loading || (mode === "friends" && splitMode === "unequally" && amount && Math.abs((Object.values(customAmounts).reduce((a, b) => Number(a) + Number(b), 0)) - Number(amount)) > 0.01)}
                                                className={`w-full bg-gradient-to-r ${mode === "friends" 
                                                    ? (loading || (mode === "friends" && splitMode === "unequally" && amount && Math.abs((Object.values(customAmounts).reduce((a, b) => Number(a) + Number(b), 0)) - Number(amount)) > 0.01)
                                                        ? "from-zinc-700 to-zinc-600 grayscale opacity-40 shadow-none cursor-not-allowed" 
                                                        : "from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 shadow-amber-500/20 shadow-xl")
                                                    : "from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 shadow-emerald-500/20 shadow-xl"
                                                } text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2`}
                                                whileTap={{ scale: 0.97 }}
                                                whileHover={!(loading || (mode === "friends" && splitMode === "unequally" && amount && Math.abs((Object.values(customAmounts).reduce((a, b) => Number(a) + Number(b), 0)) - Number(amount)) > 0.01)) ? { scale: 1.01 } : {}}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: 0.15 }}
                                            >
                                                {loading ? (
                                                    <Loader2 className="w-5 h-5 animate-spin" />
                                                ) : (
                                                    <>
                                                        <CheckCircle className="w-5 h-5" />
                                                        {mode === "personal" ? "Add Personal Expense" : "Split with Friends"}
                                                    </>
                                                )}
                                            </motion.button>
                                        </motion.form>
                                    )}
                                </AnimatePresence>

                                {/* ── SWITCH MODES ── */}
                                <div className="h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
                                
                                <div className="grid grid-cols-2 gap-3">
                                    {(mode === "personal" || mode === "friends") && mode !== "friends" && (
                                        <motion.button
                                            type="button"
                                            onClick={() => setMode("friends")}
                                            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-zinc-950/50 border border-white/5 hover:border-amber-500/30 hover:bg-amber-500/5 transition-all group"
                                            whileTap={{ scale: 0.98 }}
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 group-hover:bg-amber-500/20 transition-colors">
                                                <Sparkles className="w-4 h-4" />
                                            </div>
                                            <span className="text-xs text-zinc-400 group-hover:text-amber-300 font-medium transition-colors">
                                                Split with Friends?
                                            </span>
                                        </motion.button>
                                    )}

                                    {mode !== "personal" && (
                                        <motion.button
                                            type="button"
                                            onClick={() => setMode("personal")}
                                            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-zinc-950/50 border border-white/5 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all group"
                                            whileTap={{ scale: 0.98 }}
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500/20 transition-colors">
                                                <Wallet className="w-4 h-4" />
                                            </div>
                                            <span className="text-xs text-zinc-400 group-hover:text-emerald-300 font-medium transition-colors">
                                                Personal?
                                            </span>
                                        </motion.button>
                                    )}

                                    <motion.button
                                        type="button"
                                        onClick={() => setMode("group")}
                                        className="flex items-center gap-3 px-4 py-3 rounded-xl bg-zinc-950/50 border border-white/5 hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all group"
                                        whileTap={{ scale: 0.98 }}
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500/20 transition-colors">
                                            <Users className="w-4 h-4" />
                                        </div>
                                        <span className="text-xs text-zinc-400 group-hover:text-indigo-300 font-medium transition-colors">
                                            Add to Group?
                                        </span>
                                    </motion.button>
                                </div>
                            </motion.div>
                        ) : (
                            /* ── SELECTION VIEW (FOR GROUP OR FRIENDS) ── */
                            <motion.div
                                key={mode}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.25 }}
                                className="flex flex-col gap-4"
                            >
                                {/* Search */}
                                <div className="relative">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">
                                        <Search className="w-4 h-4" />
                                    </div>
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder={mode === "group" ? "Search your groups..." : "Search friends..."}
                                        className={`w-full bg-zinc-950 border border-white/10 rounded-2xl pl-12 pr-10 py-3.5 text-white text-sm focus:outline-none focus:border-${mode === "group" ? "indigo" : "amber"}-500/50 placeholder:text-zinc-600 transition-colors`}
                                        autoFocus
                                    />
                                    {searchQuery && (
                                        <button
                                            type="button"
                                            onClick={() => setSearchQuery("")}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>

                                {/* List */}
                                <div className="space-y-2 max-h-[40vh] overflow-y-auto scrollbar-hide">
                                    {(tripsLoading || friendsLoading) ? (
                                        <div className="flex flex-col items-center py-8 gap-2 text-zinc-500">
                                            <Loader2 className="w-6 h-6 animate-spin" />
                                            <span className="text-xs">Loading {mode === "group" ? "groups" : "friends"}...</span>
                                        </div>
                                    ) : (mode === "group" ? filteredTrips : filteredFriends).length > 0 ? (
                                        (mode === "group" ? filteredTrips : filteredFriends).map((item, index) => {
                                            const id = mode === "group" ? item?._id : item.friend?._id;
                                            const name = mode === "group" ? item.name : item.friend.username;
                                            const isSelected = mode === "friends" && selectedFriends.includes(id);

                                            return (
                                                <motion.button
                                                    key={id}
                                                    onClick={() => {
                                                        if (mode === "group") {
                                                            handleGroupSelect(item);
                                                        } else {
                                                            setSelectedFriends(prev => 
                                                                prev.includes(id) ? prev.filter(fid => fid !== id) : [...prev, id]
                                                            );
                                                        }
                                                    }}
                                                    className={`w-full flex items-center justify-between p-4 rounded-xl bg-zinc-950/50 border transition-all group text-left ${
                                                        isSelected 
                                                            ? "border-amber-500/50 bg-amber-500/5" 
                                                            : "border-white/5 hover:border-indigo-500/30 hover:bg-indigo-500/5"
                                                    }`}
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: index * 0.04 }}
                                                    whileTap={{ scale: 0.98 }}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center transition-colors ${
                                                            mode === "group" 
                                                                ? "bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500/20" 
                                                                : "bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20"
                                                        }`}>
                                                            {mode === "group" ? (
                                                                <Users className="w-5 h-5" />
                                                            ) : (
                                                                item.friend?.profilePhotoUrl ? (
                                                                    <img src={item.friend.profilePhotoUrl} alt="" className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <span className="text-sm font-bold uppercase">{item.friend?.username?.[0]}</span>
                                                                )
                                                            )}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-medium text-white">{name}</p>
                                                            <p className="text-[10px] text-zinc-500">
                                                                {mode === "group" ? `${item.members?.length || 0} members` : item.friend.email}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    {mode === "friends" && (
                                                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${isSelected ? "bg-amber-500 border-amber-500" : "border-zinc-700"}`}>
                                                            {isSelected && <CheckCircle className="w-3 h-3 text-white" />}
                                                        </div>
                                                    )}
                                                    {mode === "group" && <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all" />}
                                                </motion.button>
                                            );
                                        })
                                    ) : (
                                        <div className="flex flex-col items-center py-8 text-center">
                                            <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center mb-3">
                                                {mode === "group" ? <Users className="w-6 h-6 text-zinc-600" /> : <Wallet className="w-6 h-6 text-zinc-600" />}
                                            </div>
                                            <p className="text-zinc-400 text-sm font-medium">
                                                {searchQuery ? "No matching results" : `No ${mode}s yet`}
                                            </p>
                                            <p className="text-zinc-600 text-xs mt-1">
                                                {searchQuery ? "Try a different search" : `You haven't added any ${mode}s yet`}
                                            </p>
                                        </div>
                                    )}
                                </div>
                                
                                {mode === "friends" && selectedFriends.length > 0 && (
                                    <motion.button
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        onClick={() => setIsFriendsFormOpen(true)}
                                        className="w-full bg-amber-500 hover:bg-amber-400 text-white font-bold py-3.5 rounded-2xl transition-all shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 mt-2"
                                    >
                                        <Sparkles className="w-4 h-4" />
                                        Continue with {selectedFriends.length} friend{selectedFriends.length > 1 ? 's' : ''}
                                    </motion.button>
                                )}

                                <div className="h-px bg-white/5 my-2" />
                                
                                <button 
                                    onClick={() => setMode("personal")}
                                    className="text-[10px] text-zinc-500 hover:text-white font-bold uppercase transition-colors text-center py-2"
                                >
                                    Cancel and go back
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            </motion.div>
        </div>
    );
};

export default QuickAddExpenseModal;
