import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-hot-toast";
import api from "../utils/api";
import DatePicker from "./DatePicker";
const API_BASE = import.meta.env.VITE_API_BASE_URL;

const handleScrollTop = () => {
  window.scrollTo({
    top: 0,
    left: 0,
    behavior: "smooth",
  });
};

const AddTrip = () => {
  const navigate = useNavigate(); // Initialize the navigation hook
  const [friends, setFriends] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [tripName, setTripName] = useState("");
  const [description, setDescription] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [search, setSearch] = useState("");
  const [selectAll, setSelectAll] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdTripName, setCreatedTripName] = useState("");

  // Refs for input fields to maintain focus after clearing
  const tripNameRef = useRef(null);
  const descriptionRef = useRef(null);
  const searchRef = useRef(null);

  // Filtered (visible) friends according to search
  const filteredFriends = friends.filter((f) =>
    f.friend?.username?.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    handleScrollTop();
  }, []);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    if (user && user?.friends) {
      setFriends(user.friends); // assuming user.friends is an array of friend objects
    }
  }, []);

  // Update selectAll state when search changes or friends change
  useEffect(() => {
    if (filteredFriends.length > 0) {
      const allFilteredSelected = filteredFriends.every((f) =>
        selectedFriends.includes(f.friend._id)
      );
      setSelectAll(allFilteredSelected);
    } else {
      setSelectAll(false);
    }
  }, [filteredFriends, selectedFriends]);

  const handleFriendSelection = (friendId) => {
    let updatedSelected;
    if (selectedFriends.includes(friendId)) {
      updatedSelected = selectedFriends.filter((id) => id !== friendId);
    } else {
      updatedSelected = [...selectedFriends, friendId];
    }

    setSelectedFriends(updatedSelected);

    // If all filtered (visible) friends are selected, enable selectAll
    if (
      filteredFriends.length > 0 &&
      filteredFriends.every((f) => updatedSelected.includes(f.friend._id))
    ) {
      setSelectAll(true);
    } else {
      setSelectAll(false);
    }
  };

  const handleSelectAll = () => {
    if (selectAll) {
      // Deselect all filtered friends
      const filteredFriendIds = filteredFriends.map((f) => f.friend._id);
      setSelectedFriends(
        selectedFriends.filter((id) => !filteredFriendIds.includes(id))
      );
      setSelectAll(false);
    } else {
      // Select all filtered friends
      const filteredFriendIds = filteredFriends.map((f) => f.friend._id);
      const newSelected = [
        ...new Set([...selectedFriends, ...filteredFriendIds]),
      ];
      setSelectedFriends(newSelected);
      setSelectAll(true);
    }
  };

  const handleAddTrip = async (e) => {
    e.preventDefault();

    const user = JSON.parse(localStorage.getItem("user"));
    const tripData = {
      name: tripName.trim(),
      description: description.trim(),
      from: fromDate,
      to: toDate,
      members: [user._id, ...selectedFriends],
    };

    try {
      // console.log(" sending Trip Data as:", tripData); // Log the trip data for debugging
      if (!tripData.name.trim()) {
        toast.error("Title is required!");
        return;
      }

      if (
        tripData.from &&
        tripData.to &&
        new Date(tripData.to) < new Date(tripData.from)
      ) {
        toast.error("End date cannot be before start date!");
        return;
      }

      const res = await api.post(`${API_BASE}/group/create-group`, tripData);
      // console.log("Response:", res.data); // Log the response for debugging

      if (res.status !== 200 && res.status !== 201) {
        throw new Error("Failed to create trip");
      }

      // console.log("Trip created:", res.data);
      const createdGroup = res.data.group;
      setCreatedTripName(createdGroup.name || tripName);
      setShowSuccess(true);

      // Navigate after the animation plays
      setTimeout(() => {
        navigate(`/tripDetails/${createdGroup._id}`);
      }, 1600);
    } catch (error) {
      console.error("Error creating trip:", error);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col relative font-sans selection:bg-indigo-500/30">

      {/* ---- SUCCESS OVERLAY ---- */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-zinc-950/95 backdrop-blur-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Glow ring */}
            <motion.div
              className="absolute w-40 h-40 rounded-full bg-indigo-500/20 blur-3xl"
              initial={{ scale: 0 }}
              animate={{ scale: 2.5, opacity: 0 }}
              transition={{ duration: 1.5, ease: "easeOut" }}
            />

            {/* Checkmark circle */}
            <motion.div
              className="relative w-24 h-24 rounded-full border-2 border-indigo-500 flex items-center justify-center mb-6"
              initial={{ scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
            >
              <motion.div
                className="absolute inset-0 rounded-full bg-indigo-600/20"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, duration: 0.3 }}
              />
              <svg className="w-12 h-12 text-indigo-400" viewBox="0 0 24 24" fill="none">
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

            {/* Text */}
            <motion.p
              className="text-xl font-bold text-white mb-1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.4 }}
            >
              Trip Created!
            </motion.p>
            <motion.p
              className="text-sm text-zinc-500 font-medium"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.75, duration: 0.4 }}
            >
              Opening <span className="text-indigo-400">{createdTripName}</span>…
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
      {/* --- BACKGROUND (Dashboard Theme) --- */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-0 right-0 h-[500px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-zinc-950 to-zinc-950"></div>
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03]"></div>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 1.06 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 max-w-5xl mx-auto w-full p-4 sm:p-6 lg:p-10 flex flex-col h-full"
      >
        {/* --- HEADER --- */}
        <div className="flex items-center gap-4 mb-8">
          <Link to="/dash">
            <button className="p-3 rounded-full bg-zinc-900 border border-white/5 hover:bg-zinc-800 hover:border-white/10 text-zinc-400 hover:text-white transition-all duration-300 shadow-lg shadow-black/20 group">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 group-hover:-translate-x-0.5 transition-transform"
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
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Create Trip
            </h1>
            <p className="text-sm text-zinc-500 font-medium">
              Plan your next group expense.
            </p>
          </div>
        </div>

        {/* --- MAIN FORM CARD --- */}
        <div className="bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-3xl overflow-hidden shadow-2xl flex-1">
          {/* Subtle Indigo Top Border */}
          <div className="h-1 w-full bg-gradient-to-r from-zinc-900 via-indigo-600 to-zinc-900 opacity-50"></div>

          <form
            onSubmit={handleAddTrip}
            className="p-6 sm:p-8 lg:p-10 flex flex-col gap-8 h-full"
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
              {/* --- LEFT COLUMN: Details (7 Cols) --- */}
              <div className="lg:col-span-7 space-y-6">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                  <span className="text-xs font-bold text-indigo-500 uppercase tracking-widest">
                    Itinerary Details
                  </span>
                </div>

                {/* Trip Name */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-400">
                    Trip Name
                  </label>
                  <div className="relative">
                    <input
                      ref={tripNameRef}
                      type="text"
                      placeholder="e.g. Summer Vacation 2025"
                      value={tripName}
                      onChange={(e) => setTripName(e.target.value)}
                      className="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-3 pr-10 text-white placeholder-zinc-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all font-medium"
                    />
                    {tripName && (
                      <button
                        type="button"
                        onClick={() => {
                          setTripName("");
                          tripNameRef.current?.focus();
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-white/10 text-zinc-500 hover:text-white transition-all"
                        title="Clear"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Dates Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="relative">
                    <DatePicker
                      label="From"
                      placeholder="Start date"
                      value={fromDate}
                      onChange={(val) => setFromDate(val)}
                    />
                  </div>
                  <div className="relative">
                    <DatePicker
                      label="To"
                      placeholder="End date"
                      value={toDate}
                      min={fromDate}
                      onChange={(val) => setToDate(val)}
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-400">
                    Description
                  </label>
                  <div className="relative">
                    <textarea
                      ref={descriptionRef}
                      placeholder="What's the plan?"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-3 pr-10 text-white placeholder-zinc-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all text-sm h-32 resize-none custom-scrollbar"
                    />
                    {description && (
                      <button
                        type="button"
                        onClick={() => {
                          setDescription("");
                          descriptionRef.current?.focus();
                        }}
                        className="absolute right-3 top-3 p-1 rounded-full hover:bg-white/10 text-zinc-500 hover:text-white transition-all"
                        title="Clear"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* --- RIGHT COLUMN: Friends (5 Cols) --- */}
              <div className="lg:col-span-5 flex flex-col h-full bg-zinc-950/50 rounded-2xl border border-white/5 overflow-hidden">
                <div className="p-4 border-b border-white/5 bg-zinc-900/50">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                        Add Members
                      </span>
                    </div>
                    <span className="text-xs text-indigo-400 font-mono bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                      {selectedFriends.length} Selected
                    </span>
                  </div>

                  {/* Search Bar */}
                  <div className="relative">
                    <svg
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                    <input
                      ref={searchRef}
                      type="text"
                      placeholder="Search list..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full bg-zinc-900 border border-white/10 rounded-lg py-2 pl-9 pr-9 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-all"
                    />
                    {search && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearch("");
                          searchRef.current?.focus();
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-white/10 text-zinc-500 hover:text-white transition-all"
                        title="Clear search"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-3.5 w-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Friends List - With "Float to Top" Logic */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 max-h-[300px]">
                  <div className="flex items-center justify-between px-2 py-2 mb-1">
                    <span className="text-[10px] text-zinc-500 uppercase font-bold">
                      Your Contacts
                    </span>
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="text-[10px] text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                    >
                      {selectAll ? "Clear All" : "Select All"}
                    </button>
                  </div>

                  <div className="space-y-1 relative">
                    {filteredFriends.length === 0 ? (
                      <p className="text-center text-zinc-600 text-xs py-4">
                        No friends found.
                      </p>
                    ) : (
                      [...filteredFriends]
                        .sort((a, b) => {
                          // 1. Sort by Selection Status (Selected comes first)
                          const isASelected = selectedFriends.includes(
                            a.friend._id
                          );
                          const isBSelected = selectedFriends.includes(
                            b.friend._id
                          );
                          if (isASelected && !isBSelected) return -1;
                          if (!isASelected && isBSelected) return 1;
                          // 2. Sort Alphabetically
                          return a.friend.username.localeCompare(
                            b.friend.username
                          );
                        })
                        .map((friend) => {
                          const isSelected = selectedFriends.includes(
                            friend.friend._id
                          );
                          return (
                            <label
                              key={friend.friend._id} // ID is critical for animation stability
                              className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all duration-300 group ${
                                isSelected
                                  ? "bg-indigo-500/10 border border-indigo-500/30"
                                  : "hover:bg-white/5 border border-transparent"
                              }`}
                            >
                              <div className="relative flex items-center justify-center w-5 h-5">
                                <input
                                  type="checkbox"
                                  value={friend.friend._id}
                                  checked={isSelected}
                                  onChange={() =>
                                    handleFriendSelection(friend.friend._id)
                                  }
                                  className="peer appearance-none w-5 h-5 border border-zinc-600 rounded bg-zinc-900 checked:bg-indigo-600 checked:border-indigo-600 transition-all cursor-pointer"
                                />
                                <svg
                                  className="absolute w-3.5 h-3.5 text-white pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={3}
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                              </div>
                              <span
                                className={`text-sm transition-colors select-none ${
                                  isSelected
                                    ? "text-white font-medium"
                                    : "text-zinc-400 group-hover:text-white"
                                }`}
                              >
                                {friend.friend.username}
                              </span>
                            </label>
                          );
                        })
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* --- ACTION BAR --- */}
            <div className="pt-6 mt-auto border-t border-white/5">
              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto ml-auto px-8 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-lg shadow-indigo-900/20 hover:shadow-indigo-900/40 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    Creating...
                  </>
                ) : (
                  <>
                    Start Adventure
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M14 5l7 7m0 0l-7 7m7-7H3"
                      />
                    </svg>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
};

export default AddTrip;
