import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import api from "../utils/api";
const API_BASE = import.meta.env.VITE_API_BASE_URL;

const handleScrollTop = () => {
  window.scrollTo({
    top: 0,
    left: 0,
    behavior: "smooth",
  });
};

const AddMembers = () => {
  const navigate = useNavigate();
  const [friends, setFriends] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const { groupId } = useParams();

  useEffect(() => {
    handleScrollTop();
  }, []);

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("user");
      const existingTripMembers =
        JSON.parse(localStorage.getItem("tripMembers")) || [];

      if (storedUser) {
        const user = JSON.parse(storedUser);

        const friendsList = (user.friends || [])
          .filter((f) => f?.friend?.username)
          .map((f) => ({
            _id: f.friend._id,
            username: f.friend.username,
            balance: f.balance || 0,
          }))
          .filter(
            (f) => !existingTripMembers.some((member) => member._id === f._id)
          ); // Exclude already added

        setFriends(friendsList);
      }
    } catch (err) {
      console.error("Error loading friends:", err);
    }
  }, []);

  const handleSelect = (friend) => {
    if (selectedFriends.some((f) => f._id === friend._id)) {
      setSelectedFriends((prev) => prev.filter((f) => f._id !== friend._id));
    } else {
      setSelectedFriends((prev) => [friend, ...prev]);
    }
    setSearch("");
  };

  const filteredFriends = friends.filter((friend) =>
    friend.username.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = async () => {
    setIsAdding(true);
    try {
      if (!groupId || selectedFriends.length === 0) return;

      const selectedUsernames = selectedFriends.map((f) => f._id);

      const res = await api.post(
        `${API_BASE}/group/add-members/${groupId}`,
        {
          members: selectedUsernames,
        }
      );

      if (res.status !== 200) {
        toast.error("Failed to add members. Try again.");
        throw new Error(res.data.message || "Failed to add members");
      }

      // Update local storage
      const updatedGroup = res.data;

      localStorage.setItem("currentGroup", JSON.stringify(updatedGroup));
      toast.success("Member(s) added successfully!");

      // Go back or redirect
      navigate(-1);
    } catch (err) {
      console.error("Failed to add members:", err.message);
      toast.error(
        err.response?.data?.message || "Could not add members. Try again."
      );
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-black text-white overflow-hidden">

      {/* ── Fixed Header ── */}
      <div className="flex-shrink-0 bg-black/95 backdrop-blur-md border-b border-white/10 px-4 sm:px-6 pt-5 pb-4 space-y-4">
        {/* Back */}
        <button
          className="flex items-center text-white hover:text-gray-300 transition-colors"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back
        </button>

        {/* Title */}
        <h1 className="text-2xl font-bold text-center">Add Members</h1>

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search friends..."
            className="w-full px-4 py-2 pr-9 rounded-lg bg-[#121212] text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-white"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {/* Selected chips */}
        {selectedFriends.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedFriends.map((friendItem) => (
              <span
                key={friendItem._id}
                className="bg-green-700 px-3 py-1 rounded-full text-sm"
              >
                {friendItem.username}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Scrollable Grid ── */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 pb-28">
        <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {filteredFriends.map((friend) => {
            const isSelected = selectedFriends.some((f) => f._id === friend._id);
            return (
              <div
                key={friend._id}
                onClick={() => handleSelect(friend)}
                className={`cursor-pointer px-4 py-3 rounded-lg border transition ${
                  isSelected
                    ? "border-green-500 bg-green-800 text-white"
                    : "border-gray-600 bg-[#121212] hover:bg-gray-800"
                }`}
              >
                {friend.username}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Fixed Bottom Button ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur-md border-t border-white/10 px-4 py-4 flex justify-center z-50">
        <button
          disabled={selectedFriends.length === 0 || isAdding}
          className={`${
            selectedFriends.length === 0 || isAdding
              ? "bg-gray-600 cursor-not-allowed text-gray-400"
              : "bg-white hover:bg-gray-200 text-black"
          } font-semibold px-10 py-3 rounded-xl transition text-lg w-full max-w-sm`}
          onClick={handleAdd}
        >
          {isAdding
            ? "Adding..."
            : selectedFriends.length > 0
            ? `Add ${selectedFriends.length} Member${selectedFriends.length > 1 ? "s" : ""}`
            : "Add Selected Members"}
        </button>
      </div>
    </div>
  );
};

export default AddMembers;
