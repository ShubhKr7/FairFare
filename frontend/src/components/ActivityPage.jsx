import { useState, useEffect, useRef } from "react";
import { Bell, ArrowLeft } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { toast } from "react-hot-toast";
import api from "../utils/api";
import ActivityItems from "./ActivityItems";

const handleScrollTop = () => {
  window.scrollTo({
    top: 0,
    left: 0,
    behavior: "smooth",
  });
};

const ActivityPage = () => {
  const navigate = useNavigate();
  const { userId } = useParams();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const observerTarget = useRef(null);
  // const [suggestions, setSuggestions] = useState([]);
  // const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  // const [suggestionsPage, setSuggestionsPage] = useState(1);
  // const [hasMoreSuggestions, setHasMoreSuggestions] = useState(true);
  // const [suggestionsListRef = useRef(null);

  const LIMIT = 15; // Increased limit so it fills the screen and triggers scrolling

  useEffect(() => {
    handleScrollTop();
  }, []);

  useEffect(() => {
    if (userId) {
      const loadData = async () => {
        await fetchNotifications();
        await markAllAsReadOnOpen();
        await fetchUnreadCount();
        // await fetchSuggestions();
      };
      loadData();
    }
  }, [userId]);

  const fetchNotifications = async (pageNum = 1) => {
    try {
      setLoading(true);
      const response = await api.get(`/activity/${userId}`, {
        params: { page: pageNum, limit: LIMIT },
      });
      const { notifications: data, pagination } = response.data;

      if (pageNum === 1) {
        setNotifications(data);
      } else {
        setNotifications((prev) => {
          const combined = [...prev, ...data];

          const uniqueMap = new Map();
          combined.forEach((item) => {
            uniqueMap.set(item._id, item);
          });
          data.forEach((item) => {
            uniqueMap.set(item._id, item);
          });
          return Array.from(uniqueMap.values());
        });
      }

      setHasMore(pagination.page < pagination.pages);
      setPage(pageNum);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      toast.error("Failed to load notifications");
    } finally {
      setLoading(false);
    }
  };


  const fetchUnreadCount = async () => {
    try {
      const response = await api.get(`/activity/${userId}/unread-count`);
      setUnreadCount(response.data.unreadCount);
    } catch (error) {
      console.error("Error fetching unread count:", error);
    }
  };

  // const fetchSuggestions = async (pageNum = 1) => {
  //   try {
  //     setSuggestionsLoading(true);
  //     const response = await api.get(`/user/friend-suggestions/${userId}`, {
  //       params: { page: pageNum, limit: 4 },
  //     });
  //     const { suggestions: data, pagination } = response.data;
  // 
  //     if (pageNum === 1) {
  //       setSuggestions(data);
  //     } else {
  //       setSuggestions((prev) => [...prev, ...data]);
  //     }
  // 
  //     setHasMoreSuggestions(pagination.hasMore);
  //     setSuggestionsPage(pageNum);
  //   } catch (error) {
  //     console.error("Error fetching suggestions:", error);
  //   } finally {
  //     setSuggestionsLoading(false);
  //   }
  // };

  // const sendFriendRequest = async (target) => {
  //   try {
  //     const payload = { fromUserId: userId };
  //     if (target?.userId) {
  //       payload.toUserId = [target.userId];
  //     } else if (target?.id) {
  //       payload.toUserId = [target.id];
  //     } else if (typeof target === 'string') {
  //       payload.toUserId = [target];
  //     } else if (target?.email) {
  //       payload.toEmail = [target.email];
  //     } else {
  //       toast.error('Invalid friend target');
  //       return;
  //     }
  // 
  //     const response = await api.post('/user/friend-requests/send', payload);
  //     if (response.status === 200) {
  //       toast.success('Friend request sent!');
  //       // Remove from suggestions
  //       setSuggestions((prev) => prev.filter((s) => s.user._id !== target && s.user._id !== target?.userId && s.user._id !== target?.id));
  //     }
  //   } catch (error) {
  //     console.error('Error sending friend request:', error);
  //     toast.error('Failed to send friend request');
  //   }
  // };

  const markAllAsReadOnOpen = async () => {
    try {
      await api.put(`/activity/${userId}/read-all`);
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error("Error marking all as read on open:", error);
    }
  };

  const handleLoadMore = () => {
    if (hasMore && !loading) {
      fetchNotifications(page + 1);
    }
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          handleLoadMore();
        }
      },
      { threshold: 1.0 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => {
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current);
      }
    };
  }, [hasMore, loading, page, userId]);

  // const handleLoadMoreSuggestions = () => {
  //   if (hasMoreSuggestions && !suggestionsLoading) {
  //     fetchSuggestions(suggestionsPage + 1);
  //   }
  // };

  // const handleSuggestionsScroll = (e) => {
  //   const { scrollTop, scrollHeight, clientHeight } = e.target;
  //   if (scrollTop + clientHeight >= scrollHeight - 60) {
  //     handleLoadMoreSuggestions();
  //   }
  // };

  const handleStatusChange = () => {
    fetchUnreadCount();
  };

  const handleActivityClick = ({ friendId, expenseId, chatOnly }) => {
    if (!friendId) return;
    // Deleted expenses have no anchorable record — just open the chat
    if (chatOnly) {
      navigate(`/transaction-history/${friendId}`);
      return;
    }
    if (!expenseId) return;
    navigate(`/transaction-history/${friendId}#${expenseId}`);
  };

  const handleBack = () => {
    navigate("/dash");
  };

  return (
    <>
      <div className="bg-zinc-950 text-zinc-100 p-4 md:p-8 min-h-screen flex flex-col selection:bg-indigo-500/30 font-sans">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <button
              onClick={handleBack}
              className="p-2 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-white transition-all duration-200"
              title="Back"
            >
              <ArrowLeft size={20} />
            </button>

            <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
              <Bell size={28} className="text-indigo-400" />
              Activity
            </h1>
            <div className="w-10" />
          </div>
        </div>

        {/* Activity Container (FULL HEIGHT) */}
        <div>
          {/* Top bar */}
          <div className="flex items-center justify-between mb-3">

            {unreadCount > 0 && (
              <span className="text-sm text-indigo-200">
                {unreadCount} unread
              </span>
            )}
          </div>

          {/* Scrollable Activity List */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-hide">
            {notifications.length === 0 && !loading ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center mb-4">
                  <Bell size={32} className="text-indigo-400" />
                </div>
                <h2 className="text-xl font-semibold text-white mb-2">
                  No activity yet
                </h2>
                <p className="text-gray-400">
                  When something happens, you'll see it here
                </p>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {notifications.map((notification) => (
                  <ActivityItems
                    key={notification._id}
                    _id={notification._id}
                    sender={notification.sender}
                    message={notification.message}
                    type={notification.type}
                    createdAt={notification.createdAt}
                    isRead={notification.isRead}
                    referenceId={notification.referenceId}
                    onStatusChange={handleStatusChange}
                    onActivityClick={handleActivityClick}
                  />
                ))}
              </AnimatePresence>
            )}

            {/* Scroll Observer Target */}
            <div ref={observerTarget} className="h-10 w-full flex items-center justify-center py-4 shrink-0">
              {loading && notifications.length > 0 && (
                <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              )}
            </div>

            {!hasMore && notifications.length > 0 && (
              <div className="text-center text-zinc-500 text-sm py-4 shrink-0">
                No more activity
              </div>
            )}
          </div>
        </div>

        {/* Suggestions (KEEP COMMENTED — DO NOT REMOVE) */}
        {/* <Suggestions
    suggestions={suggestions}
    loading={suggestionsLoading}
    onSendFriendRequest={sendFriendRequest}
    onScroll={handleSuggestionsScroll}
    listRef={suggestionsListRef}
    hasMore={hasMoreSuggestions}
  /> */}

      </div>
    </>
  );
};

export default ActivityPage;
