import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Users, UserPlus, Sparkles } from "lucide-react";

export default function Suggestions({
  suggestions = [],
  loading = false,
  onSendFriendRequest,
  onProfileClick,
  onLoadMore,
  hasMore = false,
  title = "Suggested Friends",
  subtitle = "People you may already know.",
  className = "",
}) {
  const listRef = useRef(null);
  const loadMoreRef = useRef(null);
  useEffect(() => {
    const scrollContainer = listRef.current;
    const loadMoreTarget = loadMoreRef.current;

    if (!scrollContainer || !loadMoreTarget || !hasMore || loading || !onLoadMore) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loading) {
          onLoadMore();
        }
      },
      {
        root: scrollContainer,
        threshold: 1,
      }
    );

    observer.observe(loadMoreTarget);

    return () => observer.disconnect();
  }, [hasMore, loading, onLoadMore, suggestions.length]);

  return (
    <section className={`h-full flex flex-col rounded-[1.75rem] border border-white/10 bg-slate-900/60 backdrop-blur-2xl shadow-2xl overflow-hidden ${className}`}>
      <div className="flex items-start justify-between gap-4 border-b border-white/5 px-5 sm:px-8 py-5">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-400">
            <Users className="h-3.5 w-3.5" />
            Recommendations
          </div>
          <h3 className="mt-3 text-xl font-semibold text-white">{title}</h3>
          <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
        </div>

        {suggestions.length > 0 && (
          <div className="hidden sm:flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-slate-300">
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
            Based on your network
          </div>
        )}
      </div>

      <div
        ref={listRef}
        className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4 custom-scrollbar space-y-3 max-h-[65dvh] lg:max-h-none"
      >
        {suggestions.length === 0 && loading ? (
          <div className="flex items-center justify-center py-10 text-sm text-slate-400">
            Loading suggestions...
          </div>
        ) : suggestions.length > 0 ? (
          suggestions.map((suggestion) => (
            <motion.div
              key={suggestion.user._id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              role={onProfileClick ? "button" : undefined}
              tabIndex={onProfileClick ? 0 : undefined}
              onClick={() => onProfileClick?.(suggestion)}
              onKeyDown={(event) => {
                if (!onProfileClick) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onProfileClick(suggestion);
                }
              }}
              className={`flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-4 transition-colors duration-200 hover:bg-white/10 ${onProfileClick ? "cursor-pointer" : ""
                }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                {suggestion.user.profilePhotoUrl ? (
                  <img
                    src={suggestion.user.profilePhotoUrl}
                    alt={suggestion.user.username}
                    className="h-11 w-11 rounded-full object-cover border border-white/10"
                  />
                ) : (
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-800 text-sm font-semibold text-cyan-400">
                    {suggestion.user.username?.charAt(0).toUpperCase() || "U"}
                  </div>
                )}

                <div className="min-w-0">
                  <p className="truncate font-medium text-white">{suggestion.user.username}</p>
                  <p className="truncate text-sm text-slate-400">
                    {suggestion.mutualFriends} mutual friend{suggestion.mutualFriends !== 1 ? "s" : ""}
                    {suggestion.recentlyJoined ? " • Recently joined" : ""}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onSendFriendRequest?.(suggestion);
                }}
                className="inline-flex w-full sm:w-auto justify-center shrink-0 items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors duration-200 hover:bg-cyan-400"
              >
                <UserPlus className="h-4 w-4" />
                Add Friend
              </button>
            </motion.div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-500">
              <Users className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-white">No suggestions available</p>
            <p className="mt-1 text-xs text-slate-500">
              Add a few friends first, then mutual connections will appear here.
            </p>
          </div>
        )}

        <div ref={loadMoreRef} className="h-1 w-full" />

        {loading && suggestions.length > 0 && (
          <div className="flex items-center justify-center py-2 text-xs text-slate-400">
            Loading more...
          </div>
        )}

        {!hasMore && suggestions.length > 0 && (
          <div className="flex items-center justify-center py-2 text-xs text-slate-500">
            You&apos;re all caught up
          </div>
        )}
      </div>
    </section>
  );
}
