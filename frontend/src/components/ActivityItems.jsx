import { useState, forwardRef } from "react";
import { X, Check, UserPlus, FilePlus, Edit2, Trash2, DollarSign, Bell, Users } from "lucide-react";
import { motion } from "framer-motion";
import api from "../utils/api";
import { toast } from "react-hot-toast";
import PropTypes from "prop-types";

const ActivityItems = forwardRef(({
  _id,
  sender,
  message,
  type,
  createdAt,
  isRead,
  onStatusChange,
  referenceId,
  onActivityClick,
}, ref) => {
  const [isLoading, setIsLoading] = useState(false);
  const [localIsRead, setLocalIsRead] = useState(isRead);
  // expense_deleted has no valid expense to anchor to (it was deleted) —
  // clicking it should just open the chat with the sender, not redirect.
  const isChatOnlyActivity = type === "expense_deleted";
  const isDeepLinkActivity =
    String(type || "").includes("expense") || type === "payment_received";

  // Format time
  const formatTime = (timestamp) => {
    const now = new Date();
    const notifTime = new Date(timestamp);
    const diffMs = now - notifTime;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;

    return notifTime.toLocaleDateString();
  };

  // Get notification icon color based on type
  const getTypeColor = () => {
    switch (type) {
      case "friend_request":
      case "friend_added":
        return "from-blue-500 to-cyan-500";
      case "expense_added":
      case "expense_edited":
        return "from-green-500 to-emerald-500";
      case "expense_deleted":
        return "from-red-500 to-pink-500";
      case "payment_received":
      case "payment_reminder":
        return "from-yellow-500 to-orange-500";
      case "group_invite":
      case "group_expense_added":
        return "from-purple-500 to-pink-500";
      default:
        return "from-indigo-500 to-purple-500";
    }
  };

  const getTypeIcon = () => {
    switch (type) {
      case "friend_request":
      case "friend_added":
        return <UserPlus className="w-4 h-4 text-blue-400" />;
      case "expense_added":
        return <FilePlus className="w-4 h-4 text-green-400" />;
      case "group_expense_added":
        return <Users className="w-4 h-4 text-purple-400" />;
      case "expense_edited":
        return <Edit2 className="w-4 h-4 text-green-400" />;
      case "expense_deleted":
        return <Trash2 className="w-4 h-4 text-red-400" />;
      case "payment_received":
        return <DollarSign className="w-4 h-4 text-yellow-400" />;
      case "payment_reminder":
        return <Bell className="w-4 h-4 text-yellow-400" />;
      case "group_invite":
        return <Users className="w-4 h-4 text-purple-400" />;
      default:
        return null;
    }
  };

  const handleMarkAsRead = async () => {
    if (localIsRead) return;

    setIsLoading(true);
    try {
      await api.put(`/activity/${_id}/read`);
      setLocalIsRead(true);
      onStatusChange?.();
      toast.success("Marked as read");
    } catch (error) {
      console.error("Error marking as read:", error);
      toast.error("Failed to mark as read");
    } finally {
      setIsLoading(false);
    }
  };

  const handleActivityClick = () => {
    if (!isDeepLinkActivity || !sender?._id) {
      return;
    }

    onActivityClick?.({
      friendId: sender._id,
      expenseId: referenceId,
      chatOnly: isChatOnlyActivity,
    });
  };

  const handleKeyDown = (event) => {
    if (!isDeepLinkActivity) return;

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleActivityClick();
    }
  };

  return (
    <motion.div
      ref={ref}
      role={isDeepLinkActivity ? "button" : undefined}
      tabIndex={isDeepLinkActivity ? 0 : undefined}
      onClick={handleActivityClick}
      onKeyDown={handleKeyDown}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 100 }}
      transition={{ duration: 0.3 }}
      className={`relative p-3 md:p-4 rounded-xl border transition-all duration-200 ${localIsRead
        ? "bg-zinc-900/30 border-white/5 hover:border-white/10"
        : "bg-gradient-to-r from-indigo-500/5 to-purple-500/5 border-indigo-500/20 hover:border-indigo-500/40"
        } ${isDeepLinkActivity ? "cursor-pointer hover:scale-[1.01]" : ""}`}
    >
      {/* Unread indicator */}
      {!localIsRead && (
        <div className="absolute left-0 top-0 bottom-0 w-0.5 md:w-1 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-l-xl"></div>
      )}

      <div className="flex gap-2 md:gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0">
          {sender?.profilePhotoUrl ? (
            <img
              src={sender.profilePhotoUrl}
              alt={sender.username}
              className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover border border-white/10"
            />
          ) : (
            <div
              className={`w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br ${getTypeColor()} flex items-center justify-center text-white font-semibold text-sm md:text-lg`}
            >
              {sender?.username?.[0]?.toUpperCase() || "N"}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* sender name and time */}
          <div className="flex items-start md:items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
              {getTypeIcon()}
              <span className="font-semibold text-white text-sm md:text-base truncate">
                {sender?.username || "Someone"}
              </span>
              <span className="text-[9px] md:text-[10px] uppercase tracking-wider text-gray-400 bg-white/5 px-1.5 md:px-2 py-0.5 rounded-full">
                {type.replace(/_/g, " ")}
              </span>
            </div>
            <span className="text-[10px] md:text-xs text-gray-500 whitespace-nowrap flex-shrink-0">
              {formatTime(createdAt)}
            </span>
          </div>

          {/* message body */}
          <p className="text-xs md:text-sm text-gray-200 leading-relaxed break-words mt-1">
            {message}
          </p>
        </div>
      </div>

      {/* Unread dot badge (if not read) */}
      {!localIsRead && (
        <div className="absolute right-2 md:right-3 top-2 md:top-3 w-1.5 h-1.5 md:w-2 md:h-2 bg-indigo-500 rounded-full animate-pulse"></div>
      )}
    </motion.div>
  );
});

ActivityItems.propTypes = {
  _id: PropTypes.string.isRequired,
  sender: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    profilePhotoUrl: PropTypes.string,
  }),
  message: PropTypes.string.isRequired,
  type: PropTypes.string.isRequired,
  createdAt: PropTypes.string.isRequired,
  isRead: PropTypes.bool.isRequired,
  onStatusChange: PropTypes.func,
  referenceId: PropTypes.string,
  onActivityClick: PropTypes.func,
};

export default ActivityItems;
