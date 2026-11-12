import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

function getDaysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
    return new Date(year, month, 1).getDay();
}

function formatDate(date) {
    if (!date) return "";
    const d = new Date(date);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

function formatDisplay(date) {
    if (!date) return "";
    const d = new Date(date + "T00:00:00");
    return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

function parseDate(str) {
    if (!str) return null;
    const d = new Date(str + "T00:00:00");
    return isNaN(d.getTime()) ? null : d;
}

const DROPDOWN_WIDTH = 260;

const DatePicker = ({ value, onChange, min, max, label, placeholder = "Pick a date", labelClassName, buttonClassName }) => {
    const [open, setOpen] = useState(false);
    const triggerRef = useRef(null);
    const dropdownRef = useRef(null);
    const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });

    const selected = parseDate(value);
    const minDate = parseDate(min);
    const maxDate = parseDate(max);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [viewYear, setViewYear] = useState(selected ? selected.getFullYear() : today.getFullYear());
    const [viewMonth, setViewMonth] = useState(selected ? selected.getMonth() : today.getMonth());

    // Calculate dropdown position from the trigger button
    const updatePosition = useCallback(() => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const dropdownHeight = 340; // approximate max height

        let top, left;
        if (spaceBelow < dropdownHeight && rect.top > dropdownHeight) {
            // Open upward if not enough space below
            top = rect.top - dropdownHeight - 4;
        } else {
            top = rect.bottom + 4;
        }
        left = rect.left;

        // Keep within viewport horizontally
        if (left + DROPDOWN_WIDTH > window.innerWidth) {
            left = window.innerWidth - DROPDOWN_WIDTH - 8;
        }

        setDropdownPos({ top, left });
    }, []);

    // Close on outside click
    useEffect(() => {
        const handler = (e) => {
            if (
                triggerRef.current && !triggerRef.current.contains(e.target) &&
                dropdownRef.current && !dropdownRef.current.contains(e.target)
            ) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    // Close on scroll/resize to prevent stale positioning
    useEffect(() => {
        if (!open) return;
        const onScrollOrResize = () => setOpen(false);
        window.addEventListener("resize", onScrollOrResize);
        // Close on any scroll in the page
        window.addEventListener("scroll", onScrollOrResize, true);
        return () => {
            window.removeEventListener("resize", onScrollOrResize);
            window.removeEventListener("scroll", onScrollOrResize, true);
        };
    }, [open]);

    // Recalculate position when open
    useEffect(() => {
        if (open) updatePosition();
    }, [open, updatePosition]);

    // Sync view to selected date when it changes externally
    useEffect(() => {
        if (selected) {
            setViewYear(selected.getFullYear());
            setViewMonth(selected.getMonth());
        }
    }, [value]);

    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

    const prevMonth = () => {
        if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
        else setViewMonth(viewMonth - 1);
    };

    const nextMonth = () => {
        if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
        else setViewMonth(viewMonth + 1);
    };

    const handleSelect = (day) => {
        const dateStr = formatDate(new Date(viewYear, viewMonth, day));
        onChange(dateStr);
        setOpen(false);
    };

    const isDisabled = (day) => {
        if (!minDate) return false;
        const d = new Date(viewYear, viewMonth, day);
        d.setHours(0, 0, 0, 0);
        return (minDate && d < minDate) || (maxDate && d > maxDate);
    };

    const isSelected = (day) => {
        if (!selected) return false;
        return (
            selected.getFullYear() === viewYear &&
            selected.getMonth() === viewMonth &&
            selected.getDate() === day
        );
    };

    const isToday = (day) => {
        return (
            today.getFullYear() === viewYear &&
            today.getMonth() === viewMonth &&
            today.getDate() === day
        );
    };

    // Build calendar grid
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    const dropdown = (
        <AnimatePresence>
            {open && (
                <motion.div
                    ref={dropdownRef}
                    initial={{ opacity: 0, y: -8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.96 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="fixed z-[9999] bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden backdrop-blur-xl"
                    style={{ top: dropdownPos.top, left: dropdownPos.left, width: DROPDOWN_WIDTH }}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/5">
                        <button
                            type="button"
                            onClick={prevMonth}
                            className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-all"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-sm font-semibold text-white tracking-wide">
                            {MONTHS[viewMonth]} {viewYear}
                        </span>
                        <button
                            type="button"
                            onClick={nextMonth}
                            className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-all"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Day headers */}
                    <div className="grid grid-cols-7 px-2 pt-2 pb-1">
                        {DAYS.map((d) => (
                            <div
                                key={d}
                                className="text-center text-[10px] font-bold text-zinc-600 uppercase tracking-wider"
                            >
                                {d}
                            </div>
                        ))}
                    </div>

                    {/* Days grid */}
                    <div className="grid grid-cols-7 gap-0 px-2 pb-2">
                        {cells.map((day, i) =>
                            day === null ? (
                                <div key={`empty-${i}`} />
                            ) : (
                                <button
                                    key={day}
                                    type="button"
                                    disabled={isDisabled(day)}
                                    onClick={() => handleSelect(day)}
                                    className={`
                      relative w-full h-8 flex items-center justify-center rounded-lg text-xs font-medium transition-all duration-150
                      ${isDisabled(day)
                                            ? "text-zinc-700 cursor-not-allowed"
                                            : isSelected(day)
                                                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                                                : isToday(day)
                                                    ? "text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20"
                                                    : "text-zinc-300 hover:bg-white/10 hover:text-white"
                                        }
                    `}
                                >
                                    {day}
                                </button>
                            )
                        )}
                    </div>

                    {/* Footer — today shortcut */}
                    <div className="px-2 pb-2 flex gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                onChange(formatDate(today));
                                setViewYear(today.getFullYear());
                                setViewMonth(today.getMonth());
                                setOpen(false);
                            }}
                            disabled={(minDate && today < minDate) || (maxDate && today > maxDate)}
                            className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            Today
                        </button>
                        {value && (
                            <button
                                type="button"
                                onClick={() => {
                                    onChange("");
                                    setOpen(false);
                                }}
                                className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-white/5 text-zinc-400 hover:bg-red-500/20 hover:text-red-400 transition-all"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );

    return (
        <div className="space-y-2">
            {label && (
                <label className={labelClassName || "text-sm font-medium text-zinc-400"}>{label}</label>
            )}

            {/* Trigger */}
            <button
                ref={triggerRef}
                type="button"
                onClick={() => setOpen(!open)}
                className={`w-full flex items-center justify-between rounded-xl px-4 py-3 text-sm transition-all ${buttonClassName || "bg-zinc-950 border"} ${open
                        ? "border-indigo-500 ring-1 ring-indigo-500/20"
                        : "border-white/10 hover:border-white/20"
                    } ${value ? "text-white" : "text-zinc-600"}`}
            >
                <span className="font-medium truncate">
                    {value ? formatDisplay(value) : placeholder}
                </span>
                <Calendar className="w-4 h-4 text-zinc-500 flex-shrink-0 ml-2" />
            </button>

            {/* Render dropdown in a portal so it's never clipped by parent overflow */}
            {createPortal(dropdown, document.body)}
        </div>
    );
};

export default DatePicker;
