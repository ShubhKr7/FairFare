import { useState } from "react";
import { Trash2, Edit3, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Cookies from "js-cookie";
import api from "../utils/api";
import { motion, AnimatePresence } from "framer-motion";
const API_BASE = import.meta.env.VITE_API_BASE_URL;

const ExpenseCard = ({
  _id,
  title,
  category,
  subcategory,
  time,
  description, // (we aren’t using description in expanded view, but you can if needed)
  amount,
  iconColor,
  paidBy, // { _id, username }
  beneficiaries, // [ { user: { _id, username }, amount } ]
  onDelete,
  isPersonal,
  groupName,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const navigate = useNavigate();

  const currentUserId = Cookies.get("id") || (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}")?._id;
    } catch {
      return null;
    }
  })();

  const paidById = paidBy?._id?.toString?.() || paidBy?.toString?.() || "";
  const isPayer = Boolean(currentUserId && paidById && paidById === currentUserId.toString());

  // Check if current user is in beneficiaries (owedBy)
  const myOwedEntry = beneficiaries?.find((b) => {
    const bId = b.user?._id?.toString?.() || b.user?.toString?.() || "";
    return currentUserId && bId === currentUserId.toString();
  });

  // Total amount lent to other members if current user is payer
  const amountLent = beneficiaries?.reduce((sum, b) => {
    const bId = b.user?._id?.toString?.() || b.user?.toString?.() || "";
    if (bId !== currentUserId?.toString()) {
      return sum + (Number(b.amount) || 0);
    }
    return sum;
  }, 0) || 0;

  const amountOwed = myOwedEntry ? (Number(myOwedEntry.amount) || 0) : 0;

  let amountColorClass = "text-white";
  let statusText = null;
  let statusColorClass = "text-zinc-500";
  let orbBgClass = iconColor || "bg-indigo-500";
  let orbBorderClass = "bg-opacity-20 border-white/10";
  let dotClass = "bg-white";

  if (!isPersonal) {
    if (isPayer && amountLent > 0) {
      amountColorClass = "text-emerald-400 font-semibold";
      statusText = `you lent ₹${amountLent.toFixed(2)}`;
      statusColorClass = "text-emerald-400/90";
      orbBgClass = "bg-emerald-500";
      orbBorderClass = "bg-emerald-500/20 border-emerald-500/30";
      dotClass = "bg-emerald-400";
    } else if (!isPayer && amountOwed > 0) {
      amountColorClass = "text-rose-400 font-semibold";
      statusText = `you owe ₹${amountOwed.toFixed(2)}`;
      statusColorClass = "text-rose-400/90";
      orbBgClass = "bg-rose-500";
      orbBorderClass = "bg-rose-500/20 border-rose-500/30";
      dotClass = "bg-rose-400";
    } else if (isPayer && amountLent === 0) {
      amountColorClass = "text-zinc-200";
      statusText = "paid by you";
      statusColorClass = "text-zinc-400";
    }
  }
  const allowEdit =
    window.location.pathname !== "/dash" &&
    (window.location.pathname !== "/allExpenses" || isPersonal);

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
  };

  const handleEdit = () => {
    const editPath = isPersonal ? "/personal-expense/edit" : "/expense/edit";
    navigate(editPath, {
      state: {
        originalExpense: {
          _id,
          time,
          title,
          category,
          subcategory,
          description,
          amount,
          paidBy,
          beneficiaries,
        },
      },
    });
  };

  const handleDeleteClick = () => {
    handleToggle();
    setShowDeleteModal(true);
  };

  const [deleteStatus, setDeleteStatus] = useState(null); // null | 'loading' | 'success' | 'error'

  const confirmDelete = async () => {
    try {
      setDeleteStatus('loading');
      const deleteUrl = isPersonal
        ? `${API_BASE}/expenses/personal/${_id}`
        : `${API_BASE}/group/del-expense/${_id}`;

      await api.delete(deleteUrl);
      setDeleteStatus('success');
      
      setTimeout(() => {
        onDelete(_id);
        setShowDeleteModal(false);
        setIsExpanded(false);
        setDeleteStatus(null);
      }, 1500);
    } catch (err) {
      console.error("Delete error:", err);
      setDeleteStatus('error');
    }
  };

  const options = {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  };
  const date = new Date(time).toLocaleString("en-US", options);

  return (
    <div
      className="group relative flex flex-col bg-zinc-900/40 hover:bg-zinc-900/60 border border-white/5 hover:border-indigo-500/30 rounded-xl transition-all duration-300 ease-out overflow-hidden"
      onClick={(e) => {
        // Prevent toggle if clicking buttons or modal
        if (
          e.target.closest("button") ||
          e.target.closest(".delete-modal-content")
        )
          return;
        handleToggle();
      }}
    >
      {/* --- Main Card Content --- */}
      <div className="flex justify-between items-center p-4 cursor-pointer relative z-10">
        {/* Left: Icon & Details */}
        <div className="flex items-center gap-4">
          {/* Glowing Status Orb */}
          <div className="relative flex-shrink-0">
            <div
              className={`absolute inset-0 ${orbBgClass} blur-md opacity-40 group-hover:opacity-60 transition-opacity`}
            ></div>
            <div
              className={`relative w-10 h-10 rounded-full ${orbBgClass} ${orbBorderClass} flex items-center justify-center border shadow-inner`}
            >
              {/* Optional: You can put an icon here later. For now, a simple dot or initial */}
              <div
                className={`w-2 h-2 rounded-full ${dotClass}`}
              ></div>
            </div>
          </div>

          <div className="flex flex-col">
            <h3 className="font-semibold text-zinc-100 text-base leading-tight group-hover:text-indigo-200 transition-colors">
              {title || category}
            </h3>

            {/* Inline Categorization Badges */}
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              {category ? (
                <>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-800 text-zinc-400 border border-white/5">
                    {category}
                  </span>
                  {subcategory && (
                    <>
                      <span className="text-[10px] text-zinc-600">›</span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-800/50 text-zinc-500 border border-white/5">
                        {subcategory}
                      </span>
                    </>
                  )}
                </>
              ) : (
                <span className="text-[10px] italic text-zinc-600 flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-zinc-600 animate-ping"></span>
                  Processing
                </span>
              )}
            </div>

            <p className="text-[10px] text-zinc-500 mt-1 font-mono tracking-wide opacity-60">
              {date}
            </p>

            {groupName && (
              <div className="mt-1 flex items-center">
                <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 text-[9px] font-bold border border-indigo-500/20 uppercase tracking-tighter">
                  {groupName}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Amount & Actions */}
        <div className="flex items-center gap-4">
          {/* Actions - Fade in on hover for cleaner look */}
          <div className="flex items-center gap-1 opacity-100 transition-opacity duration-200">
            {allowEdit && (
              <button
                onClick={handleEdit}
                className="p-2 rounded-lg text-zinc-500 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
                title="Edit Expense"
              >
                <Edit3 size={16} />
              </button>
            )}
            {allowEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteClick();
                }}
                className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Delete Expense"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>

          {/* Amount Display */}
          <div className="text-right">
            <div className={`text-lg font-mono font-medium tracking-tight ${amountColorClass}`}>
              ₹{amount?.toFixed(2)}
            </div>
            {statusText && (
              <div className={`text-[10px] font-medium tracking-wide ${statusColorClass}`}>
                {statusText}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- Expanded Details Section --- */}
      <div
        className={`bg-black/20 border-t border-white/5 overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
          }`}
      >
        <div className="p-4 flex flex-col sm:flex-row gap-6 text-sm">
          {/* Payer Info */}
          <div className="sm:w-1/3">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-2">
              Transaction Details
            </p>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center text-[10px] text-indigo-400 font-bold border border-indigo-500/30">
                P
              </div>
              <span className="text-zinc-300">
                Paid by{" "}
                <span className="text-white font-medium">
                  {paidBy?.username}
                </span>
              </span>
            </div>
          </div>

          {/* Split Details */}
          <div className="sm:w-2/3">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-2">
              Split Breakdown
            </p>
            <div className="space-y-2">
              {beneficiaries?.map((person, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between group/row"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-700 group-hover/row:bg-emerald-500 transition-colors"></div>
                    <span className="text-zinc-400 group-hover/row:text-zinc-200 transition-colors">
                      {person.user?.username}
                    </span>
                  </div>
                  <div className="font-mono text-zinc-500 group-hover/row:text-emerald-400 transition-colors">
                    ₹{person.amount.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* --- Delete Confirmation Modal (Embedded) --- */}
      {showDeleteModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm delete-modal-content animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-white/10 p-6 rounded-2xl max-w-sm w-full shadow-2xl relative overflow-hidden delete-modal-content">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />
            
            <AnimatePresence mode="wait">
              {deleteStatus === 'success' ? (
                <motion.div 
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center py-8 relative overflow-hidden"
                >
                  {/* Pulsing rings */}
                  <motion.div 
                    className="absolute w-24 h-24 rounded-full border border-red-500/30"
                    animate={{ scale: [1, 2.5], opacity: [0.8, 0] }}
                    transition={{ duration: 1, repeat: Infinity, ease: "easeOut" }}
                  />
                  <motion.div 
                    className="absolute w-24 h-24 rounded-full border border-red-500/20"
                    animate={{ scale: [1, 3], opacity: [0.5, 0] }}
                    transition={{ duration: 1.2, delay: 0.2, repeat: Infinity, ease: "easeOut" }}
                  />
                  
                  <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mb-6 border-2 border-red-500 relative z-10 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
                    <Trash2 className="w-10 h-10 text-red-500 animate-bounce" />
                  </div>
                  <h3 className="text-2xl font-black text-white uppercase tracking-tighter z-10">Purged 💀</h3>
                  <p className="text-zinc-500 text-[10px] font-mono tracking-[0.3em] mt-2 uppercase z-10">Ledger data erased</p>
                </motion.div>
              ) : deleteStatus === 'error' ? (
                <motion.div 
                  key="error"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center py-4"
                >
                  <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mb-4 border border-white/10">
                    <span className="text-2xl">⚠️</span>
                  </div>
                  <h3 className="text-xl font-bold text-white uppercase italic">Failed</h3>
                  <p className="text-zinc-500 text-xs mt-1 text-center font-medium">Transmission aborted</p>
                  <button 
                    onClick={() => setDeleteStatus(null)}
                    className="mt-6 px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg text-[10px] font-bold uppercase tracking-widest border border-white/5 hover:text-white transition-all"
                  >
                    Retry Protocol
                  </button>
                </motion.div>
              ) : (
                <motion.div key="confirm" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center border border-red-500/20">
                      <Trash2 className="w-6 h-6 text-red-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white uppercase tracking-tight">Purge Record?</h3>
                      <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Permanent Erasure</p>
                    </div>
                  </div>
                  <p className="text-zinc-400 text-xs leading-relaxed mb-8">
                    Are you sure you want to erase this transaction? This action is <span className="text-red-400 font-bold italic">irreversible</span> and will be dropped from all ledger backups.
                  </p>
                  <div className="flex gap-3">
                    <button
                      disabled={deleteStatus === 'loading'}
                      onClick={() => setShowDeleteModal(false)}
                      className="flex-1 py-3 rounded-xl bg-zinc-800 border border-white/5 text-zinc-400 hover:text-white transition-all font-bold text-[10px] uppercase tracking-widest disabled:opacity-50"
                    >
                      Abort
                    </button>
                    <button
                      disabled={deleteStatus === 'loading'}
                      onClick={confirmDelete}
                      className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/20 transition-all font-bold text-[10px] uppercase tracking-widest active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {deleteStatus === 'loading' ? <Loader2 size={12} className="animate-spin" /> : "Purge Entry"}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
};

// ExpenseCard.propTypes = {
//   _id: PropTypes.string.isRequired,
//   category: PropTypes.string,
//   subcategory: PropTypes.string,
//   time: PropTypes.string.isRequired,
//   description: PropTypes.string,
//   amount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
//   iconColor: PropTypes.string.isRequired,
//   paidBy: PropTypes.shape({
//     _id: PropTypes.string,
//     username: PropTypes.string,
//   }).isRequired,
//   beneficiaries: PropTypes.arrayOf(
//     PropTypes.shape({
//       user: PropTypes.shape({
//         _id: PropTypes.string,
//         username: PropTypes.string,
//       }),
//       amount: PropTypes.number,
//     })
//   ).isRequired,
// };

export default ExpenseCard;
