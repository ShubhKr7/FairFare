import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import PropTypes from "prop-types";
import DatePicker from "./DatePicker";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const formatDateForPicker = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const TripExpenseFilters = ({
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
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [monthPickerYear, setMonthPickerYear] = useState(new Date().getFullYear());
  const [draftSearchQuery, setDraftSearchQuery] = useState("");
  const [draftSelectedMembers, setDraftSelectedMembers] = useState([]);
  const [draftStartDate, setDraftStartDate] = useState("");
  const [draftEndDate, setDraftEndDate] = useState("");
  const [draftSelectedMonth, setDraftSelectedMonth] = useState("");
  const filterButtonRef = useRef(null);
  const filterDialogRef = useRef(null);
  const monthPickerContainerRef = useRef(null);
  const tripStartDate = formatDateForPicker(tripFrom);
  const tripEndDate = formatDateForPicker(tripTo);
  const currentYear = new Date().getFullYear();
  const tripStartYear = Math.max(2024, tripStartDate ? Number(tripStartDate.slice(0, 4)) : 2024);
  const tripEndYear = Math.min(currentYear, tripEndDate ? Number(tripEndDate.slice(0, 4)) : currentYear);
  const monthPickerYears = tripEndYear >= tripStartYear
    ? Array.from({ length: tripEndYear - tripStartYear + 1 }, (_, index) => tripStartYear + index)
    : [];
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
    setIsMonthPickerOpen(false);
    setIsOpen(true);
  };

  const closeFilters = () => {
    setIsOpen(false);
    setIsMonthPickerOpen(false);
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

  useEffect(() => {
    if (!isMonthPickerOpen) return;
    const handleOutsideClick = (event) => {
      if (!monthPickerContainerRef.current?.contains(event.target)) {
        setIsMonthPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isMonthPickerOpen]);

  const isMonthAvailable = (year, monthIndex) => {
    const month = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
    return (!tripStartDate || month >= tripStartDate.slice(0, 7)) &&
      (!tripEndDate || month <= tripEndDate.slice(0, 7));
  };

  return (
    <div className="relative mb-4">
      <button
        ref={filterButtonRef}
        type="button"
        onClick={() => (isOpen ? closeFilters() : openFilters())}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-zinc-900/60 px-4 py-3 text-sm font-semibold text-zinc-200 transition-all hover:border-indigo-500/50 hover:bg-zinc-900"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <Search className="h-4 w-4 text-indigo-400" />
        Apply Filters
        {hasActiveFilters && (
          <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] text-white">Active</span>
        )}
      </button>

      {isOpen && (
        <div
          ref={filterDialogRef}
          className="absolute left-0 top-full z-30 mt-2 w-full rounded-2xl border border-white/10 bg-zinc-900 p-4 shadow-2xl shadow-black/40"
          role="dialog"
          aria-label="Expense filters"
          tabIndex={-1}
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

          <div ref={monthPickerContainerRef} className="relative mt-3">
            <button
              type="button"
              onClick={() => {
                const year = draftSelectedMonth
                  ? Number(draftSelectedMonth.slice(0, 4))
                  : Math.min(Math.max(currentYear, tripStartYear), tripEndYear);
                setMonthPickerYear(year);
                setIsMonthPickerOpen((open) => !open);
              }}
              className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-zinc-950/60 px-3 py-2.5 text-sm text-zinc-200 hover:border-white/20"
              aria-haspopup="dialog"
              aria-expanded={isMonthPickerOpen}
            >
              <CalendarDays className="h-4 w-4 text-zinc-500" />
              {draftSelectedMonth
                ? new Date(`${draftSelectedMonth}-01T00:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" })
                : "Select month"}
            </button>
            {isMonthPickerOpen && (
              <div className="absolute left-0 top-full z-40 mt-2 w-full rounded-2xl border border-white/10 bg-zinc-900 p-3 shadow-2xl shadow-black/40">
                <select value={monthPickerYear} onChange={(event) => setMonthPickerYear(Number(event.target.value))} className="mb-3 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm font-semibold text-white outline-none" aria-label="Select year">
                  {monthPickerYears.map((year) => <option key={year} value={year}>{year}</option>)}
                </select>
                <div className="grid grid-cols-3 gap-2">
                  {MONTH_NAMES.map((monthName, monthIndex) => {
                    const month = `${monthPickerYear}-${String(monthIndex + 1).padStart(2, "0")}`;
                    const available = isMonthAvailable(monthPickerYear, monthIndex);
                    return (
                      <button
                        key={month}
                        type="button"
                        disabled={!available}
                        onClick={() => {
                          setDraftSelectedMonth(month);
                          setDraftStartDate("");
                          setDraftEndDate("");
                          setIsMonthPickerOpen(false);
                        }}
                        className={`rounded-lg px-2 py-2 text-xs font-medium ${draftSelectedMonth === month ? "bg-indigo-600 text-white" : available ? "bg-white/5 text-zinc-300 hover:bg-indigo-500/20 hover:text-white" : "cursor-not-allowed text-zinc-700"}`}
                      >
                        {monthName.slice(0, 3)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

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
        </div>
      )}
    </div>
  );
};

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
