import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import TripCard from "./tripCard";

const TripsSection = ({ user }) => {
  const navigate = useNavigate();

  // The user object already carries the 3 most recently updated groups
  // (backend sorts by updatedAt desc and limits to 3), including tripTotal.
  // Deriving trips here avoids a redundant API call.
  const trips = useMemo(() => {
    const groups = user?.groups;
    if (!Array.isArray(groups)) return [];
    return groups;
  }, [user]);

  const handleTripClick = (trip) => {
    navigate(`/tripDetails/${trip._id}`);
  };

  return (
    <div className="flex flex-col h-full bg-transparent">
      {/* --- Header Section --- */}
      <div className="flex justify-between items-center mb-4 md:mb-6">
        <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2 md:gap-3">
          Trips & Events
        </h2>

        <div className="flex items-center gap-3 md:gap-4">
          <Link to="/allTrips">
            <button
              type="button"
              className="text-xs font-medium text-zinc-400 hover:text-white transition-colors flex items-center gap-1 group py-1"
              title="View all trips"
            >
              View All
              <span className="hidden sm:inline-block group-hover:translate-x-0.5 transition-transform">
                →
              </span>
            </button>
          </Link>

          <Link to="/addTrip">
            <button
              type="button"
              className="w-9 h-9 md:w-8 md:h-8 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center transition-all shadow-lg shadow-indigo-500/20 hover:scale-105 active:scale-95"
              title="Create New Trip"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 md:h-4 md:w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </button>
          </Link>
        </div>
      </div>

      {/* --- Trips List Container --- */}
      {/* 'min-h-0' fixes flexbox scrolling issues on some mobile browsers */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 -mr-1 space-y-3 custom-scrollbar">
        {trips && trips.length > 0 ? (
          trips.map((trip) => (
            <TripCard
              key={trip._id}
              amount={trip.tripTotal}
              trip={trip}
              onClick={() => handleTripClick(trip)}
            />
          ))
        ) : (
          /* --- Empty State --- */
          <div className="h-32 md:h-40 flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 rounded-xl bg-zinc-900/30 text-center p-4">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-zinc-800 flex items-center justify-center mb-2 md:mb-3">
              <svg
                className="w-4 h-4 md:w-5 md:h-5 text-zinc-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            </div>
            <p className="text-sm text-zinc-400 font-medium">
              Create your first trip
            </p>
            <p className="text-[10px] md:text-xs text-zinc-600 mt-1">
              Start planning your next adventure.
            </p>
            <Link to="/addTrip" className="mt-3">
              <button
                type="button"
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-all shadow-lg shadow-indigo-500/20 hover:scale-105 active:scale-95"
              >
                Start
              </button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default TripsSection;
