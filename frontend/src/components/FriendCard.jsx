import PropTypes from "prop-types";
import { useState } from "react";
import { FaTrash, FaCopy } from "react-icons/fa";
import { FiLink } from "react-icons/fi";
import { MdOutlineCurrencyExchange } from "react-icons/md";
import axios from "axios";
import { QRCodeCanvas } from "qrcode.react";
import { FaHistory } from "react-icons/fa"; // history icon
import { toast } from "react-hot-toast";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import api from "../utils/api";
import { guardOfflineAction } from "../utils/offlineGuard";
const API_BASE = import.meta.env.VITE_API_BASE_URL;

const FriendCard = ({
  friend,
  index,
  balance,
  handleDeleteFriend,
  updateFriendBalance,
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [settleAmount, setSettleAmount] = useState(balance);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showConfirmSettle, setShowConfirmSettle] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const navigate = useNavigate();
  const currentUser = JSON.parse(localStorage.getItem("user"));

  // console.log(friend);

  const toggleDropdown = () => {
    setShowDropdown((prev) => {
      const newState = !prev;
      if (!newState) {
        setShowQRCode(false); // Hide QR on closing dropdown
      }
      return newState;
    });
    setSettleAmount(Number(balance));
  };

  const handlePaid = async () => {
    if (!guardOfflineAction()) return;
    if (settleAmount === "" || settleAmount === 0) return;
    const amount = Math.abs(settleAmount);
    try {
      await api.post(`${API_BASE}/user/update-friend-balance`, {
        userEmail: currentUser?.email,
        friendEmail: friend?.email,
        amount,
        action: "paid",
      });
      balance = parseFloat((Number(balance) + amount).toFixed(2));
      updateFriendBalance(friend?.email, balance);
      setSettleAmount(balance);
      setShowDropdown(false);
      setShowQRCode(false);
    } catch (error) {
      console.error("Error updating friend balance (paid):", error);
    }
  };

  const handleReceived = async () => {
    if (!guardOfflineAction()) return;
    if (settleAmount === "" || settleAmount === 0) return;
    const amount = Math.abs(settleAmount);
    try {
      await api.post(`${API_BASE}/user/update-friend-balance`, {
        userEmail: currentUser?.email,
        friendEmail: friend?.email,
        amount,
        action: "received",
      });
      balance = parseFloat((Number(balance) - amount).toFixed(2));
      updateFriendBalance(friend?.email, balance);
      setSettleAmount(balance);
      setShowDropdown(false);
      setShowQRCode(false);
    } catch (error) {
      console.error("Error updating friend balance (received):", error);
    }
  };

  const handleSettleBalance = async () => {
    if (!guardOfflineAction()) return;
    const currentBalance = balance;
    if (currentBalance === 0) {
      toast.error("No balance to settle.");
      return;
    }

    try {
      if (currentBalance > 0) {
        await api.post(
          `${API_BASE}/user/update-friend-balance`,
          // "//http://localhost:8000/user/update-friend-balance",
          {
            userEmail: currentUser?.email,
            friendEmail: friend?.email,
            amount: currentBalance,
            action: "received",
            note: "Cleared Everything",
          }
        );
      } else {
        await api.post(
          `${API_BASE}/user/update-friend-balance`,
          // "//http://localhost:8000/user/update-friend-balance",
          {
            userEmail: currentUser?.email,
            friendEmail: friend?.email,
            amount: Math.abs(currentBalance),
            action: "paid",
            note: "Cleared Everything",
          }
        );
      }
      balance = 0;
      updateFriendBalance(friend?.email, balance);
      setSettleAmount(0);
    } catch (error) {
      toast.error("Please refresh the page first!");
    }
  };

  const TransactionHistoryPage = async () => {
    if (!guardOfflineAction()) return;
    navigate(`/transaction-history/${friend._id}`);
  };

  const getInitials = (name) =>
    name
      ? name
          .trim()
          .split(" ")
          .map((word) => word[0]?.toUpperCase())
          .slice(0, 2)
          .join("")
      : "U";

  return (
    <div
      key={index}
      className="bg-zinc-900/40 backdrop-blur-sm rounded-xl border border-white/5 hover:border-indigo-500/30 transition-all duration-300 mb-2 overflow-hidden"
    >
      {/* --- Main Card Header (Always Visible) --- */}
      <div
        className="p-3 sm:p-4 flex justify-between items-center cursor-pointer group"
        onClick={TransactionHistoryPage}
      >
        <div className="flex items-center gap-3 w-full">
          {/* Avatar */}
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-zinc-800 border border-white/10 overflow-hidden flex items-center justify-center flex-shrink-0 shadow-inner">
              {friend?.profilePhotoUrl ? (
                <img
                  src={friend.profilePhotoUrl}
                  alt={`${friend.username} profile`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-indigo-400 font-bold text-sm">
                  {getInitials(friend?.username)}
                </span>
              )}
            </div>
            {/* Status Dot (Optional - e.g. online status) */}
            {/* <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-zinc-900 rounded-full"></div> */}
          </div>

          {/* Info */}
          <div className="flex flex-col flex-grow min-w-0">
            <p className="text-sm font-semibold text-zinc-100 truncate group-hover:text-indigo-200 transition-colors">
              {friend.username}
            </p>
            <p
              className={`text-xs font-medium truncate ${
                Number(balance) > 0
                  ? "text-emerald-400"
                  : Number(balance) < 0
                  ? "text-rose-400"
                  : "text-zinc-500"
              }`}
            >
              {Number(balance) > 0
                ? `owes you ₹${Number(balance).toFixed(2)}`
                : Number(balance) < 0
                ? `you owe ₹${Math.abs(Number(balance).toFixed(2))}`
                : "Settled up"}
            </p>
          </div>
        </div>

        {/* Quick Actions (Prevent bubbling) */}
        <div
          className="flex items-center gap-1 z-10"
          onClick={(e) => e.stopPropagation()}
        >
          {/* History Link */}
          <div onClick={TransactionHistoryPage}>
            <button
              className="p-2 rounded-lg text-zinc-500 hover:text-indigo-400 hover:bg-white/5 transition-colors"
              title="View History"
            >
              <FaHistory className="w-4 h-4" />
            </button>
          </div>

          {/* Delete (Moved here for quicker access, or keep in dropdown if rare) */}
          {/* <button
            onClick={() => {
              setShowDropdown(true); // Open dropdown to show context
              setShowConfirmDelete(true);
            }}
            className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-white/5 transition-colors"
            title="Remove Friend"
          >
            <FaTrash className="w-3.5 h-3.5" />
          </button> */}

          {/* Expand Chevron */}
          {/* <button
            onClick={() => setShowDropdown(!showDropdown)}
            className={`p-2 rounded-lg text-zinc-500 transition-transform duration-300 ${
              showDropdown ? "rotate-180 text-zinc-300" : ""
            }`}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button> */}
        </div>
      </div>

      {/* --- Expanded "Transaction Drawer" --- */}
      <div
        className={`bg-zinc-950/50 border-t border-white/5 transition-all duration-300 ease-in-out overflow-hidden ${
          showDropdown ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="p-4 space-y-4">
          {/* UPI Section */}
          <div className="flex items-center justify-between bg-zinc-900/50 p-2 rounded-lg border border-white/5">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-8 h-8 rounded-md bg-zinc-800 flex items-center justify-center text-zinc-400">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] text-zinc-500 uppercase font-bold">
                  UPI ID
                </span>
                <span className="text-xs text-zinc-300 truncate font-mono">
                  {friend.upiId || "Not Linked"}
                </span>
              </div>
            </div>
            {friend.upiId && (
              <button
                onClick={() => {
                  navigator.clipboard.writeText(friend.upiId);
                  toast.success("Copied!");
                }}
                className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded transition-colors"
                title="Copy ID"
              >
                <FaCopy size={12} />
              </button>
            )}
          </div>

          {/* Settle Up Section */}
          <div className="space-y-3">
            <label className="text-xs text-zinc-500 font-medium ml-1">
              SETTLE BALANCE
            </label>

            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 font-mono">
                ₹
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={settleAmount === "" ? "" : Math.abs(settleAmount)}
                onChange={(e) => {
                  // ... existing validation logic ...
                  let value = e.target.value;
                  if (value === "") return setSettleAmount("");
                  if (
                    !value.startsWith("0.") &&
                    !value.startsWith("-0.") &&
                    value.length > 1 &&
                    !value.startsWith("-")
                  ) {
                    value = value.replace(/^0+/, "");
                  } else if (
                    value.startsWith("-") &&
                    value.length > 2 &&
                    !value.startsWith("-0.")
                  ) {
                    value = "-" + value.replace(/^-0+/, "");
                  }
                  const parsed = parseFloat(value);
                  setSettleAmount(isNaN(parsed) ? "" : parsed);
                }}
                placeholder="0.00"
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg py-2 pl-7 pr-3 text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-colors font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleReceived}
                disabled={!settleAmount}
                className="py-2 rounded-lg bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-600/30 text-emerald-500 text-xs font-bold uppercase transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                + Received
              </button>
              <button
                onClick={handlePaid}
                disabled={!settleAmount}
                className="py-2 rounded-lg bg-rose-600/10 hover:bg-rose-600/20 border border-rose-600/30 text-rose-500 text-xs font-bold uppercase transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                - Paid
              </button>
            </div>

            {/* UPI Pay Button */}
            {friend.upiId && (
              <div className="pt-2 border-t border-white/5">
                <button
                  onClick={() => setShowQRCode(true)}
                  disabled={Math.abs(settleAmount) < 1}
                  className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold uppercase shadow-lg shadow-indigo-900/20 transition-all disabled:opacity-50 disabled:bg-zinc-700"
                >
                  Pay via UPI App
                </button>

                {/* QR Code Reveal */}
                {showQRCode && (
                  <div className="mt-4 p-4 bg-white rounded-xl flex flex-col items-center animate-in fade-in zoom-in duration-300">
                    <QRCodeCanvas
                      value={`upi://pay?pa=${friend.upiId}&pn=${
                        friend.upiId
                      }&am=${Math.abs(settleAmount).toFixed(
                        2
                      )}&cu=INR&tn=Settling via FairFare`}
                      size={140}
                      bgColor="#ffffff"
                      fgColor="#000000"
                      level="Q"
                    />
                    <p className="text-black text-xs font-medium mt-3">
                      Scan to pay ₹{Math.abs(settleAmount).toFixed(2)}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- Delete Confirmation Modal (Embedded Style) --- */}
      {showConfirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm bg-zinc-900 border border-red-500/30 rounded-xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">
              Remove Friend?
            </h3>
            <p className="text-sm text-zinc-400 mb-6">
              Are you sure you want to remove{" "}
              <strong className="text-white">{friend.username}</strong>? All
              transaction history will be permanently lost.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowConfirmDelete(false);
                  setShowDropdown(false);
                }}
                className="flex-1 py-2.5 rounded-lg border border-zinc-700 text-zinc-300 text-sm font-medium hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleDeleteFriend(friend.username);
                  setShowConfirmDelete(false);
                }}
                className="flex-1 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-500 shadow-lg shadow-red-900/20 transition-colors"
              >
                Yes, Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Settle Confirmation (Use similar modal style) --- */}
      {showConfirmSettle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          {/* ... simplified modal content matching above style ... */}
          <div className="w-full max-w-sm bg-zinc-900 border border-yellow-500/30 rounded-xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">
              Full Settlement?
            </h3>
            <p className="text-sm text-zinc-400 mb-6">
              This will mark all debts with{" "}
              <strong className="text-white">{friend.username}</strong> as fully
              paid.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmSettle(false)}
                className="flex-1 py-2.5 rounded-lg border border-zinc-700 text-zinc-300 text-sm font-medium hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleSettleBalance();
                  setShowConfirmSettle(false);
                }}
                className="flex-1 py-2.5 rounded-lg bg-yellow-600 text-white text-sm font-medium hover:bg-yellow-500"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FriendCard;
