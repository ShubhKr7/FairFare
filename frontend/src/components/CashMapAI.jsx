import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  ArrowLeft,
  Send,
  ArrowDown,
  Zap,
  Loader2,
  Sparkles,
  TrendingUp,
  Wallet,
  PiggyBank,
  Copy,
  Check,
} from "lucide-react";
import { Link } from "react-router-dom";
import api from "../utils/api";
import userIcon from "../../public/userIcon.png";
import Cookies from "js-cookie";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/* ─── Typewriter sub-component ─── */
function TypewriterText({ text, speed = 14, onComplete }) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  const idx = useRef(0);

  useEffect(() => {
    idx.current = 0;
    setDisplayed("");
    setDone(false);

    const iv = setInterval(() => {
      idx.current++;
      setDisplayed(text.slice(0, idx.current));
      if (idx.current >= text.length) {
        clearInterval(iv);
        setDone(true);
        onComplete?.();
      }
    }, speed);
    return () => clearInterval(iv);
  }, [text, speed]);

  return (
    <div className="cashmap-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayed}</ReactMarkdown>
      {!done && <span className="typewriter-cursor">|</span>}
    </div>
  );
}

/* ─── Typing indicator (3-dot bounce) ─── */
function TypingIndicator() {
  return (
    <div className="typing-indicator">
      <span />
      <span />
      <span />
    </div>
  );
}

/* ─── Suggestion chip data ─── */
const SUGGESTIONS = [
  { icon: <Wallet className="w-4 h-4" />, label: "Show my balances" },
  { icon: <TrendingUp className="w-4 h-4" />, label: "Summarize this month" },
  { icon: <PiggyBank className="w-4 h-4" />, label: "Where can I save?" },
  { icon: <Sparkles className="w-4 h-4" />, label: "Who owes me money?" },
];

/* ═══════════════════════════════════════════
   Main CashMapAI component
   ═══════════════════════════════════════════ */
function CashMapAI() {
  const chatContainerRef = useRef(null);
  const textareaRef = useRef(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
  const [animatingIdx, setAnimatingIdx] = useState(null); // index of msg being animated
  const [copiedIdx, setCopiedIdx] = useState(null);

  const handleCopy = (text, idx) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 2000);
    });
  };
  const timeoutRef = useRef(null);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(null);

  const [messages, setMessages] = useState(() => {
    const storedChat = localStorage.getItem("chatMessages");
    if (storedChat) {
      try {
        return JSON.parse(storedChat);
      } catch {
        /* ignore */
      }
    }
    return [
      {
        type: "bot",
        content:
          "Hello! I'm Fair AI, your personal finance assistant. How can I help you today?",
      },
    ];
  });

  const [input, setInput] = useState("");
  const [dailyCount, setDailyCount] = useState(() => {
    const stored = localStorage.getItem("user");
    const parsedStored = stored ? JSON.parse(stored) : null;
    let count = 0;
    if (parsedStored?.aiChatUsage?.count) {
      count = parseInt(parsedStored.aiChatUsage.count);
    }
    localStorage.setItem("dailyAIQueryCounter", count.toString());
    return parseInt(localStorage.getItem("dailyAIQueryCounter")) || 0;
  });

  /* ── Show only welcome greeting = show suggestions ── */
  const showSuggestions =
    messages.length === 1 && messages[0].type === "bot" && !isWaitingForResponse;

  /* ── Scroll helpers ── */
  const scrollToBottom = useCallback(() => {
    chatContainerRef.current?.scrollTo({
      top: chatContainerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, []);

  useEffect(() => {
    const el = chatContainerRef.current;
    if (!el) return;
    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      setIsAtBottom(scrollTop + clientHeight >= scrollHeight - 100);
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  /* ── Auto-hide scrollbar ── */
  useEffect(() => {
    const el = chatContainerRef.current;
    if (!el) return;
    let t;
    const h = () => {
      el.classList.add("show-scrollbar");
      clearTimeout(t);
      t = setTimeout(() => el.classList.remove("show-scrollbar"), 1200);
    };
    el.addEventListener("scroll", h);
    return () => {
      el.removeEventListener("scroll", h);
      clearTimeout(t);
    };
  }, []);

  /* ── Init: reset daily counter if needed ── */
  useEffect(() => {
    scrollToBottom();
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        const aiChatUsage = user?.aiChatUsage;
        if (aiChatUsage?.lastUsed) {
          const hrs =
            (new Date() - new Date(aiChatUsage.lastUsed)) / (1000 * 60 * 60);
          if (hrs >= 24) {
            localStorage.setItem("dailyAIQueryCounter", "0");
            setDailyCount(0);
            return;
          }
        }
      } catch {
        /* ignore */
      }
    }
    const dc = localStorage.getItem("dailyAIQueryCounter");
    setDailyCount(parseInt(dc) || 0);
  }, []);

  /* ── Persist messages ── */
  useEffect(() => {
    localStorage.setItem("chatMessages", JSON.stringify(messages));
    try {
      setProfilePhotoUrl(
        JSON.parse(localStorage.getItem("user")).profilePhotoUrl
      );
    } catch {
      /* ignore */
    }
  }, [messages]);

  /* ── Auto-scroll during typewriter animation ── */
  useEffect(() => {
    if (animatingIdx !== null) {
      const iv = setInterval(scrollToBottom, 120);
      return () => clearInterval(iv);
    }
  }, [animatingIdx, scrollToBottom]);

  /* ── Textarea auto-resize ── */
  const handleInputChange = (e) => {
    setInput(e.target.value);
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 150) + "px";
    }
  };

  /* ── Send message ── */
  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { type: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setIsWaitingForResponse(true);

    // Add typing indicator placeholder
    setMessages((prev) => [...prev, { type: "bot", content: "__TYPING__" }]);
    setTimeout(scrollToBottom, 100);

    try {
      const userId = Cookies.get("id") || "";

      const response = await api.post("/user/ai", {
        userId,
        query: input,
      });

      clearTimeout(timeoutRef.current);
      setIsWaitingForResponse(false);

      const answer = response?.data?.answer || "Sorry, something went wrong!";

      setMessages((prev) => {
        const updated = [...prev];
        updated.pop(); // remove typing indicator
        const newIdx = updated.length;
        setAnimatingIdx(newIdx);
        return [...updated, { type: "bot", content: answer }];
      });

      // Update count from the response if available
      if (typeof response?.data?.usageCount === 'number') {
        setDailyCount(response.data.usageCount);
      }
    } catch (error) {
      console.error("Error:", error);
      clearTimeout(timeoutRef.current);
      setIsWaitingForResponse(false);

      // Get error message from backend or use default
      const errorData = error?.response?.data;
      const errorMessage = errorData?.answer || "⚠ Error retrieving response. Please try again later.";
      const errorType = errorData?.errorType;

      setMessages((prev) => {
        const updated = [...prev];
        updated.pop();
        return [
          ...updated,
          {
            type: "bot",
            content: errorMessage,
          },
        ];
      });
    } finally {
      try {
        const storedUser = localStorage.getItem("user");
        const user = storedUser ? JSON.parse(storedUser) : {};
        const userId = user?._id || "";
        const API_BASE = import.meta.env.VITE_API_BASE_URL;
        const userResponse = await api.get(`${API_BASE}/user/${userId}`);
        if (userResponse?.data) {
          localStorage.setItem(
            "user",
            JSON.stringify(userResponse.data.user)
          );
          const updatedCount =
            userResponse.data?.user?.aiChatUsage?.count || 0;
          localStorage.setItem("dailyAIQueryCounter", updatedCount.toString());
          setDailyCount(updatedCount);
        }
      } catch (err) {
        console.error("Error fetching updated user data:", err);
      }
    }
  };

  /* ── Click suggestion chip ── */
  const handleSuggestion = (label) => {
    setInput(label);
    // Trigger send on next tick so input state is set
    setTimeout(() => {
      const fakeEvent = { preventDefault: () => { } };
      // We set input directly and call send
      handleSendDirect(label);
    }, 0);
  };

  const handleSendDirect = async (text) => {
    if (!text.trim()) return;
    const userMessage = { type: "user", content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsWaitingForResponse(true);
    setMessages((prev) => [...prev, { type: "bot", content: "__TYPING__" }]);
    setTimeout(scrollToBottom, 100);

    try {
      const storedUser = localStorage.getItem("user");
      const user = storedUser ? JSON.parse(storedUser) : {};
      const userId = user?._id || "";
      const response = await api.post("/user/ai", {
        userId,
        query: text,
      }); 
      console.log(response);
      clearTimeout(timeoutRef.current);
      setIsWaitingForResponse(false);
      const answer = response?.data?.answer || "Sorry, something went wrong!";
      setMessages((prev) => {
        const updated = [...prev];
        updated.pop();
        const newIdx = updated.length;
        setAnimatingIdx(newIdx);
        return [...updated, { type: "bot", content: answer }];
      });

      // Update count from the response if available
      if (typeof response?.data?.usageCount === 'number') {
        setDailyCount(response.data.usageCount);
      }
    } catch (error) {
      console.error("Error:", error);
      clearTimeout(timeoutRef.current);
      setIsWaitingForResponse(false);
      setMessages((prev) => {
        const updated = [...prev];
        updated.pop();
        return [
          ...updated,
          { type: "bot", content: "⚠ Error retrieving response. Please try again." },
        ];
      });
    } finally {
      try {
        const storedUser = localStorage.getItem("user");
        const user = storedUser ? JSON.parse(storedUser) : {};
        const userId = user?._id || "";
        const API_BASE = import.meta.env.VITE_API_BASE_URL;
        const userResponse = await api.get(`${API_BASE}/user/${userId}`);
        if (userResponse?.data) {
          localStorage.setItem("user", JSON.stringify(userResponse.data.user));
          const updatedCount = userResponse.data?.user?.aiChatUsage?.count || 0;
          localStorage.setItem("dailyAIQueryCounter", updatedCount.toString());
          setDailyCount(updatedCount);
        }
      } catch (err) {
        console.error("Error fetching updated user data:", err);
      }
    }
  };

  /* ═══════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════ */
  return (
    <div className="cashmap-root">
      {/* ── Background ── */}
      <div className="cashmap-bg">
        <div className="cashmap-bg-orb cashmap-bg-orb--1" />
        <div className="cashmap-bg-orb cashmap-bg-orb--2" />
      </div>

      {/* ── Header ── */}
      <header className="cashmap-header">
        <div className="cashmap-header-inner">
          <Link to="/dash" className="cashmap-back">
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </Link>

          <div className="cashmap-brand">
            <div className="cashmap-brand-icon">
              <Sparkles className="w-5 h-5" />
            </div>
            <span className="cashmap-brand-text">
              Fair<span>AI</span>
            </span>
          </div>

          {/* Query badge */}
          <div
            className={`cashmap-query-badge ${dailyCount >= 10 ? "cashmap-query-badge--limit" : ""
              }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>
              {dailyCount >= 10 ? "Limit reached" : `${dailyCount}/10`}
            </span>
          </div>
        </div>
      </header>

      {/* ── Messages ── */}
      <div ref={chatContainerRef} className="cashmap-messages custom-scrollbar">
        <div className="cashmap-messages-inner">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`cashmap-msg cashmap-msg--${msg.type} msg-enter`}
              style={{ animationDelay: `${Math.min(i * 40, 300)}ms` }}
            >
              {/* Bot avatar */}
              {msg.type === "bot" && (
                <div className="cashmap-avatar cashmap-avatar--bot">
                  <Sparkles className="w-4 h-4" />
                </div>
              )}

              {/* Content */}
              <div
                className={`cashmap-msg-content ${msg.type === "user" ? "cashmap-msg-content--user" : ""
                  }`}
              >
                {msg.content === "__TYPING__" ? (
                  <TypingIndicator />
                ) : msg.type === "bot" && i === animatingIdx ? (
                  <TypewriterText
                    text={msg.content}
                    speed={14}
                    onComplete={() => setAnimatingIdx(null)}
                  />
                ) : msg.type === "bot" ? (
                  <div className="cashmap-markdown">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <div style={{ whiteSpace: "pre-line" }}>{msg.content}</div>
                )}

                {/* Copy button for bot messages */}
                {msg.type === "bot" && msg.content !== "__TYPING__" && (
                  <div className="cashmap-copy-row">
                    <button
                      className="cashmap-copy-btn"
                      onClick={() => handleCopy(msg.content, i)}
                      title="Copy response"
                    >
                      {copiedIdx === i ? (
                        <><Check className="w-3.5 h-3.5" /> <span>Copied</span></>
                      ) : (
                        <><Copy className="w-3.5 h-3.5" /> <span>Copy</span></>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* User avatar */}
              {msg.type === "user" && (
                <div className="cashmap-avatar cashmap-avatar--user">
                  <img
                    src={profilePhotoUrl || userIcon}
                    alt="You"
                    className="cashmap-avatar-img"
                  />
                </div>
              )}
            </div>
          ))}

          {/* Suggestion chips */}
          {showSuggestions && (
            <div className="cashmap-suggestions">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  className="cashmap-chip"
                  onClick={() => handleSuggestion(s.label)}
                >
                  {s.icon}
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div >

      {/* ── Scroll-to-bottom FAB ── */}
      {
        !isAtBottom && (
          <button className="cashmap-scroll-fab" onClick={scrollToBottom}>
            <ArrowDown className="w-4 h-4" />
          </button>
        )
      }

      {/* ── Input bar ── */}
      <div className="cashmap-input-bar">
        <form onSubmit={handleSend} className="cashmap-input-form">
          <div className="cashmap-input-wrap">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
              placeholder={
                dailyCount >= 10
                  ? "Query limit reached for today"
                  : isWaitingForResponse
                    ? "Waiting for response…"
                    : "Ask about your finances…"
              }
              className="cashmap-textarea"
              disabled={dailyCount >= 10 || isWaitingForResponse}
            />
            <button
              type="submit"
              className={`cashmap-send ${!input.trim() || dailyCount >= 10 || isWaitingForResponse
                ? "cashmap-send--disabled"
                : ""
                }`}
              disabled={
                !input.trim() || dailyCount >= 10 || isWaitingForResponse
              }
            >
              {isWaitingForResponse ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
          <p className="cashmap-disclaimer">
            Fair AI can make mistakes. Verify important financial info.
          </p>
        </form>

        <div className="mt-3 text-[9px] md:text-[10px] text-center text-zinc-600 uppercase tracking-widest font-medium">
          Powered by FairAI Intelligence • Secure Financial Node
        </div>
      </div>

      {/* ═══ STYLES ═══ */}
      <style>{`
        /* ── GOOGLE FONT ── */
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

        /* ── ROOT ── */
        .cashmap-root {
          display: flex;
          flex-direction: column;
          height: 100vh;
          height: 100dvh;
          background: #0a0a0f;
          color: #e4e4e7;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          position: relative;
          overflow: hidden;
        }

        /* ── MARKDOWN STYLES ── */
        .cashmap-markdown {
          font-family: inherit;
          line-height: 1.5;
        }
        .cashmap-markdown > :first-child { margin-top: 0; }
        .cashmap-markdown p { margin-bottom: 0.75rem; }
        .cashmap-markdown p:last-child { margin-bottom: 0; }
        .cashmap-markdown h1, .cashmap-markdown h2, .cashmap-markdown h3, .cashmap-markdown h4 {
          font-weight: 600;
          margin-top: 1.25rem;
          margin-bottom: 0.5rem;
          color: #fff;
        }
        .cashmap-markdown h1 { font-size: 1.25rem; }
        .cashmap-markdown h2 { font-size: 1.1rem; }
        .cashmap-markdown h3 { font-size: 1rem; }
        .cashmap-markdown ul {
          list-style-type: disc;
          padding-left: 1.5rem;
          margin-bottom: 0.75rem;
        }
        .cashmap-markdown ol {
          list-style-type: decimal;
          padding-left: 1.5rem;
          margin-bottom: 0.75rem;
        }
        .cashmap-markdown li { margin-bottom: 0.25rem; }
        .cashmap-markdown strong { font-weight: 700; color: #fff; }
        .cashmap-markdown a { color: #6366f1; text-decoration: underline; }
        
        .typewriter-cursor {
          display: inline-block;
          width: 2px;
          height: 1em;
          background-color: currentColor;
          animation: blink 1s step-end infinite;
          vertical-align: text-bottom;
          margin-left: 2px;
        }

        /* ── BACKGROUND ── */
        .cashmap-bg {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          overflow: hidden;
        }
        .cashmap-bg-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(100px);
          opacity: 0.12;
        }
        .cashmap-bg-orb--1 {
          width: 500px; height: 500px;
          background: #6366f1;
          top: -120px; left: -100px;
          animation: orbFloat 12s ease-in-out infinite alternate;
        }
        .cashmap-bg-orb--2 {
          width: 400px; height: 400px;
          background: #06b6d4;
          bottom: -60px; right: -80px;
          animation: orbFloat 14s ease-in-out infinite alternate-reverse;
        }
        @keyframes orbFloat {
          0%   { transform: translate(0, 0) scale(1); }
          100% { transform: translate(30px, -20px) scale(1.08); }
        }

        /* ── HEADER ── */
        .cashmap-header {
          position: sticky;
          top: 0;
          z-index: 30;
          backdrop-filter: blur(16px) saturate(1.4);
          -webkit-backdrop-filter: blur(16px) saturate(1.4);
          background: rgba(10, 10, 15, 0.75);
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .cashmap-header-inner {
          max-width: 820px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 20px;
        }
        .cashmap-back {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #a1a1aa;
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
          transition: color 0.2s;
        }
        .cashmap-back:hover { color: #fff; }

        .cashmap-brand {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .cashmap-brand-icon {
          width: 32px; height: 32px;
          border-radius: 10px;
          background: linear-gradient(135deg, #6366f1, #06b6d4);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
        }
        .cashmap-brand-text {
          font-weight: 800;
          font-size: 19px;
          color: #f4f4f5;
          letter-spacing: -0.02em;
        }
        .cashmap-brand-text span {
          background: linear-gradient(135deg, #818cf8, #22d3ee);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .cashmap-query-badge {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 12px;
          font-weight: 600;
          padding: 5px 10px;
          border-radius: 20px;
          background: rgba(34, 211, 238, 0.1);
          color: #22d3ee;
          border: 1px solid rgba(34, 211, 238, 0.15);
        }
        .cashmap-query-badge--limit {
          background: rgba(239, 68, 68, 0.1);
          color: #f87171;
          border-color: rgba(239, 68, 68, 0.2);
        }

        /* ── MESSAGES AREA ── */
        .cashmap-messages {
          flex: 1;
          overflow-y: auto;
          z-index: 10;
          padding: 24px 16px 16px;
        }
        .cashmap-messages-inner {
          max-width: 820px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        /* ── SINGLE MESSAGE ── */
        .cashmap-msg {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          line-height: 1.7;
          font-size: 15px;
        }
        .cashmap-msg--user {
          justify-content: flex-end;
        }
        .cashmap-msg--bot {
          justify-content: flex-start;
        }

        /* ── AVATAR ── */
        .cashmap-avatar {
          width: 32px; height: 32px;
          border-radius: 50%;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-top: 2px;
        }
        .cashmap-avatar--bot {
          background: linear-gradient(135deg, rgba(99,102,241,0.2), rgba(6,182,212,0.2));
          border: 1px solid rgba(99,102,241,0.25);
          color: #818cf8;
        }
        .cashmap-avatar--user {
          background: rgba(99,102,241,0.15);
          border: 1px solid rgba(99,102,241,0.25);
          overflow: hidden;
        }
        .cashmap-avatar-img {
          width: 100%; height: 100%;
          object-fit: cover;
          border-radius: 50%;
        }

        /* ── MESSAGE CONTENT ── */
        .cashmap-msg-content {
          max-width: 85%;
          color: #d4d4d8;
          font-weight: 400;
          background: rgba(24, 24, 30, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 16px;
          padding: 14px 18px;
        }
        .cashmap-msg-content--user {
          background: linear-gradient(135deg, #4f46e5, #6366f1);
          color: #fff;
          padding: 10px 18px;
          border-radius: 20px 20px 4px 20px;
          font-weight: 500;
          max-width: 75%;
          box-shadow: 0 2px 12px rgba(79,70,229,0.25);
        }

        /* ── COPY BUTTON ── */
        .cashmap-copy-row {
          display: flex;
          justify-content: flex-start;
          margin-top: 8px;
          padding-top: 6px;
          border-top: 1px solid rgba(255,255,255,0.04);
        }
        .cashmap-copy-btn {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          border-radius: 8px;
          border: none;
          background: transparent;
          color: #71717a;
          font-size: 12px;
          font-weight: 500;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.2s;
        }
        .cashmap-copy-btn:hover {
          background: rgba(255,255,255,0.06);
          color: #a1a1aa;
        }
        .cashmap-copy-btn:active {
          transform: scale(0.95);
        }

        /* ── MESSAGE ENTER ANIMATION ── */
        @keyframes msgSlideIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .msg-enter {
          animation: msgSlideIn 0.35s ease-out both;
        }

        /* ── TYPEWRITER CURSOR ── */
        .typewriter-cursor {
          display: inline-block;
          color: #818cf8;
          font-weight: 300;
          animation: cursorBlink 0.6s steps(2) infinite;
          margin-left: 1px;
        }
        @keyframes cursorBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }

        /* ── TYPING INDICATOR ── */
        .typing-indicator {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 4px 0;
        }
        .typing-indicator span {
          width: 8px; height: 8px;
          border-radius: 50%;
          background: #6366f1;
          animation: dotBounce 1.4s ease-in-out infinite;
        }
        .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
        .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes dotBounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-8px); opacity: 1; }
        }

        /* ── SUGGESTION CHIPS ── */
        .cashmap-suggestions {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
          margin-top: 8px;
          padding-left: 44px; /* align with bot text */
        }
        @media (max-width: 480px) {
          .cashmap-suggestions {
            grid-template-columns: 1fr;
            padding-left: 0;
          }
        }
        .cashmap-chip {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px;
          color: #a1a1aa;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          text-align: left;
        }
        .cashmap-chip:hover {
          background: rgba(255,255,255,0.08);
          border-color: rgba(129,140,248,0.3);
          color: #e4e4e7;
          transform: translateY(-1px);
        }
        .cashmap-chip:active {
          transform: scale(0.97);
        }

        /* ── SCROLL FAB ── */
        .cashmap-scroll-fab {
          position: fixed;
          bottom: 120px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 25;
          width: 36px; height: 36px;
          border-radius: 50%;
          background: rgba(24, 24, 27, 0.85);
          border: 1px solid rgba(255,255,255,0.1);
          color: #a1a1aa;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          backdrop-filter: blur(8px);
          transition: all 0.2s;
          box-shadow: 0 4px 16px rgba(0,0,0,0.4);
        }
        .cashmap-scroll-fab:hover {
          background: rgba(39,39,42,0.95);
          color: #fff;
          border-color: rgba(255,255,255,0.2);
        }

        /* ── INPUT BAR ── */
        .cashmap-input-bar {
          z-index: 30;
          padding: 12px 16px calc(env(safe-area-inset-bottom, 8px) + 12px);
          background: rgba(10, 10, 15, 0.8);
          backdrop-filter: blur(16px) saturate(1.4);
          -webkit-backdrop-filter: blur(16px) saturate(1.4);
          border-top: 1px solid rgba(255,255,255,0.05);
          padding-bottom: calc(env(safe-area-inset-bottom, 8px) + 80px);
        }
        @media (min-width: 768px) {
          .cashmap-input-bar {
            padding-bottom: 16px;
          }
        }
        .cashmap-input-form {
          max-width: 820px;
          margin: 0 auto;
        }
        .cashmap-input-wrap {
          display: flex;
          align-items: flex-end;
          gap: 0;
          background: rgba(24, 24, 27, 0.7);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          padding: 4px 4px 4px 16px;
          transition: border-color 0.25s, box-shadow 0.25s;
        }
        .cashmap-input-wrap:focus-within {
          border-color: rgba(99,102,241,0.4);
          box-shadow: 0 0 0 3px rgba(99,102,241,0.08);
        }

        .cashmap-textarea {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          color: #e4e4e7;
          font-family: inherit;
          font-size: 14px;
          padding: 10px 0;
          resize: none;
          max-height: 150px;
          line-height: 1.5;
        }
        .cashmap-textarea::placeholder {
          color: #52525b;
        }
        .cashmap-textarea:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .cashmap-send {
          width: 40px; height: 40px;
          border-radius: 12px;
          border: none;
          background: linear-gradient(135deg, #6366f1, #4f46e5);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
          transition: all 0.2s;
        }
        .cashmap-send:hover {
          filter: brightness(1.15);
          transform: scale(1.04);
        }
        .cashmap-send:active {
          transform: scale(0.95);
        }
        .cashmap-send--disabled {
          opacity: 0.35;
          cursor: not-allowed;
          pointer-events: none;
        }

        .cashmap-disclaimer {
          text-align: center;
          font-size: 11px;
          color: #3f3f46;
          margin-top: 8px;
        }

        /* ── SCROLLBAR ── */
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.08);
          border-radius: 10px;
        }
        .custom-scrollbar.show-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.15);
        }
      `}</style>
    </div >
  );
}

export default CashMapAI;
