import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import PropTypes from "prop-types";
import DatePicker from "./DatePicker";
import MonthPicker from "./MonthPicker";
import { formatDateForPicker } from "../utils/dateUtils";
import { motion, AnimatePresence } from "framer-motion";

const TripExpenseFilters = forwardRef(({
  members,
  selectedMembers,
  startDate,
  endDate,
  selectedMonth,
  searchQuery,
  tripFrom,
  tripTo,
  onApply,
  onClearAll,
}, ref) => {
  useImperativeHandle(ref, () => ({
    open: openFilters,
    close: closeFilters,
  }));
  const [isOpen, setIsOpen] = useState(false);
  const [draftSearchQuery, setDraftSearchQuery] = useState("");
  const [draftSelectedMembers, setDraftSelectedMembers] = useState([]);
  const [draftStartDate, setDraftStartDate] = useState("");
  const [draftEndDate, setDraftEndDate] = useState("");
  const [draftSelectedMonth, setDraftSelectedMonth] = useState("");
  const filterDialogRef = useRef(null);
  const tripStartDate = formatDateForPicker(tripFrom);
  const tripEndDate = formatDateForPicker(tripTo);
  const hasActiveFilters = Boolean(
    searchQuery.trim() || startDate || endDate || selectedMonth || selectedMembers.length > 0
  );

  const syncDraftValues = () => {
    setDraftSearchQuery(searchQuery);
    setDraftSelectedMembers(selectedMembers);
    setDraftStartDate(startDate);
    setDraftEndDate(endDate);
    setDraftSelectedMonth(selectedMonth);
  };

  const openFilters = () => {
    syncDraftValues();
    setIsOpen(true);
  };

  const closeFilters = () => {
    setIsOpen(false);
    filterButtonRef.current?.focus();
  };

  const clearAllFilters = () => {
    setDraftSearchQuery("");
    setDraftSelectedMembers([]);
    setDraftStartDate("");
    setDraftEndDate("");
    setDraftSelectedMonth("");
    onClearAll();
    closeFilters();
  };

  const applyFilters = () => {
    onApply({
      searchQuery: draftSearchQuery,
      selectedMembers: draftSelectedMembers,
      startDate: draftStartDate,
      endDate: draftEndDate,
      selectedMonth: draftSelectedMonth,
    });
    closeFilters();
  };

  useEffect(() => {
    if (!isOpen) return;
    filterDialogRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") closeFilters();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <div className="relative">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={closeFilters}
          >
            <motion.div
              ref={filterDialogRef}
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="w-full max-w-lg mx-4 rounded-2xl border border-white/10 bg-zinc-900 p-4 shadow-2xl shadow-black/60"
              role="dialog"
              aria-label="Expense filters"
              tabIndex={-1}
              onClick={(event) => event.stopPropagation()}
            >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Filter expenses</h3>
            <button type="button" onClick={closeFilters} className="rounded-full p-1 text-zinc-500 hover:bg-white/10 hover:text-white" aria-label="Close filters">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="relative mb-4 flex items-center">
            <Search className="absolute left-3.5 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              value={draftSearchQuery}
              onChange={(event) => setDraftSearchQuery(event.target.value)}
              placeholder="Search by title, category..."
              className="w-full rounded-xl border border-white/10 bg-zinc-950/60 py-2.5 pl-10 pr-10 text-sm text-zinc-100 placeholder-zinc-500 focus:border-indigo-500/50 focus:outline-none"
              aria-label="Search expenses"
            />
            {draftSearchQuery && (
              <button type="button" onClick={() => setDraftSearchQuery("")} className="absolute right-2.5 rounded-full p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white" aria-label="Clear search">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <DatePicker
              value={draftStartDate}
              onChange={(value) => {
                setDraftStartDate(value);
                if (draftEndDate && value && draftEndDate < value) setDraftEndDate("");
                setDraftSelectedMonth("");
              }}
              min={tripStartDate}
              max={tripEndDate}
              label="From"
              placeholder="Start date"
              buttonClassName="bg-zinc-950/60 border"
            />
            <DatePicker
              value={draftEndDate}
              onChange={(value) => {
                setDraftEndDate(value);
                setDraftSelectedMonth("");
              }}
              min={draftStartDate || tripStartDate}
              max={tripEndDate}
              label="To"
              placeholder="End date"
              buttonClassName="bg-zinc-950/60 border"
            />
          </div>

          <MonthPicker
            value={draftSelectedMonth}
            onChange={(value) => {
              setDraftSelectedMonth(value);
              setDraftStartDate("");
              setDraftEndDate("");
            }}
            minDate={tripStartDate}
            maxDate={tripEndDate}
          />

          {members.length > 0 && (
            <MemberCarousel
              members={members}
              selectedMembers={draftSelectedMembers}
              onChange={setDraftSelectedMembers}
            />
          )}

          <div className="mt-4 flex justify-between gap-2 border-t border-white/10 pt-3">
            <button type="button" onClick={clearAllFilters} className="rounded-lg px-3 py-2 text-xs font-medium text-zinc-400 hover:bg-zinc-800 hover:text-white">Clear all</button>
            <button type="button" onClick={applyFilters} className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500">Apply Filters</button>
          </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </div>
  );
});

const MemberCarousel = ({ members, selectedMembers, onChange }) => {
  const carouselRef = useRef(null);
  const scroll = (direction) => carouselRef.current?.scrollBy({ left: direction * 180, behavior: "smooth" });

  return (
    <div className="relative mt-3">
      <button type="button" onClick={() => scroll(-1)} className="absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/10 bg-zinc-900 p-1.5 text-zinc-400 shadow-lg hover:text-white" aria-label="Scroll members left">
        <ChevronLeft className="h-4 w-4" />
      </button>
      <div ref={carouselRef} className="flex gap-2 overflow-x-auto px-8 py-1 custom-scrollbar">
        {members.map((member) => {
          const isSelected = selectedMembers.includes(member._id);
          return (
            <button
              key={member._id}
              type="button"
              onClick={() => onChange((previous) => isSelected ? previous.filter((id) => id !== member._id) : [...previous, member._id])}
              className={`flex-shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${isSelected ? "border-indigo-500 bg-indigo-600 text-white" : "border-white/10 bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800 hover:text-white"}`}
            >
              {member.username}
            </button>
          );
        })}
      </div>
      <button type="button" onClick={() => scroll(1)} className="absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/10 bg-zinc-900 p-1.5 text-zinc-400 shadow-lg hover:text-white" aria-label="Scroll members right">
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
};

const memberPropType = PropTypes.shape({
  _id: PropTypes.string.isRequired,
  username: PropTypes.string,
});

TripExpenseFilters.propTypes = {
  members: PropTypes.arrayOf(memberPropType).isRequired,
  selectedMembers: PropTypes.arrayOf(PropTypes.string).isRequired,
  startDate: PropTypes.string.isRequired,
  endDate: PropTypes.string.isRequired,
  selectedMonth: PropTypes.string.isRequired,
  searchQuery: PropTypes.string.isRequired,
  tripFrom: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
  tripTo: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
  onApply: PropTypes.func.isRequired,
  onClearAll: PropTypes.func.isRequired,
};

MemberCarousel.propTypes = {
  members: PropTypes.arrayOf(memberPropType).isRequired,
  selectedMembers: PropTypes.arrayOf(PropTypes.string).isRequired,
  onChange: PropTypes.func.isRequired,
};

export default TripExpenseFilters;
