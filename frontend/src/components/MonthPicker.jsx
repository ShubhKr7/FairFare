import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import PropTypes from "prop-types";
import { MONTH_NAMES } from "../utils/dateUtils";

const MonthPicker = ({ value, onChange, minDate, maxDate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isYearPickerOpen, setIsYearPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const containerRef = useRef(null);
  const currentYear = new Date().getFullYear();
  const tripStartYear = Math.max(2024, minDate ? Number(minDate.slice(0, 4)) : 2024);
  const tripEndYear = Math.min(currentYear, maxDate ? Number(maxDate.slice(0, 4)) : currentYear);
  const years = tripEndYear >= tripStartYear
    ? Array.from({ length: tripEndYear - tripStartYear + 1 }, (_, index) => tripStartYear + index)
    : [];

  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setIsOpen(false);
        setIsYearPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isOpen]);

  const isMonthAvailable = (year, monthIndex) => {
    const month = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
    return (!minDate || month >= minDate.slice(0, 7)) &&
      (!maxDate || month <= maxDate.slice(0, 7));
  };

  const openPicker = () => {
    const year = value
      ? Number(value.slice(0, 4))
      : Math.min(Math.max(currentYear, tripStartYear), tripEndYear);
    setPickerYear(year);
    setIsYearPickerOpen(false);
    setIsOpen((open) => !open);
  };

  return (
    <div ref={containerRef} className="relative mt-3">
      <button
        type="button"
        onClick={openPicker}
        className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-zinc-950/60 px-3 py-2.5 text-sm text-zinc-200 hover:border-white/20"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <CalendarDays className="h-4 w-4 text-zinc-500" />
        {value
          ? new Date(`${value}-01T00:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" })
          : "Select month"}
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-40 mt-2 w-full rounded-2xl border border-white/10 bg-zinc-900 p-3 shadow-2xl shadow-black/40">
          <div className="relative mb-3">
            <button
              type="button"
              onClick={() => setIsYearPickerOpen((open) => !open)}
              className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm font-semibold text-white transition-colors hover:border-indigo-500/50"
              aria-haspopup="dialog"
              aria-expanded={isYearPickerOpen}
            >
              {pickerYear}
              <ChevronDown className={`h-4 w-4 text-zinc-500 transition-transform ${isYearPickerOpen ? "rotate-180" : ""}`} />
            </button>
            {isYearPickerOpen && (
              <div className="absolute left-0 top-full z-50 mt-2 grid w-full grid-cols-3 gap-2 rounded-xl border border-white/10 bg-zinc-950 p-2 shadow-xl">
                {years.map((year) => (
                  <button
                    key={year}
                    type="button"
                    onClick={() => {
                      setPickerYear(year);
                      setIsYearPickerOpen(false);
                    }}
                    className={`rounded-lg px-2 py-2 text-xs font-semibold transition-colors ${
                      pickerYear === year
                        ? "bg-indigo-600 text-white"
                        : "text-zinc-400 hover:bg-indigo-500/20 hover:text-white"
                    }`}
                  >
                    {year}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {MONTH_NAMES.map((monthName, monthIndex) => {
              const month = `${pickerYear}-${String(monthIndex + 1).padStart(2, "0")}`;
              const available = isMonthAvailable(pickerYear, monthIndex);
              return (
                <button
                  key={month}
                  type="button"
                  disabled={!available}
                  onClick={() => {
                    onChange(month);
                    setIsOpen(false);
                  }}
                  className={`rounded-lg px-2 py-2 text-xs font-medium ${
                    value === month
                      ? "bg-indigo-600 text-white"
                      : available
                        ? "bg-white/5 text-zinc-300 hover:bg-indigo-500/20 hover:text-white"
                        : "cursor-not-allowed text-zinc-700"
                  }`}
                >
                  {monthName.slice(0, 3)}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

MonthPicker.propTypes = {
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  minDate: PropTypes.string,
  maxDate: PropTypes.string,
};

export default MonthPicker;
