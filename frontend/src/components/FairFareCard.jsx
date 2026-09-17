import { useState, useEffect } from "react";
import Cookies from "js-cookie";
import { QRCodeCanvas } from "qrcode.react";

const FairFareCard = () => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [last4, setLast4] = useState(""); // State for last4
  const [netBalance, setNetBalance] = useState(0); // State for net balance
  const [balanceMessage, setBalanceMessage] = useState(""); // State for balance message
  const [user, setUser] = useState(
    () => JSON.parse(localStorage.getItem("user")) || {}
  );

  // Generate or retrieve last4 using cookies
  useEffect(() => {
    let storedLast4 = Cookies.get("last4");

    if (!storedLast4) {
      storedLast4 = Math.floor(1000 + Math.random() * 9000).toString();
      Cookies.set("last4", storedLast4); // Store in cookies
    }

    setLast4(storedLast4);
  }, []);

  //To sync with local storage
  useEffect(() => {
    const interval = setInterval(() => {
      const updatedUser = JSON.parse(localStorage.getItem("user")) || {};
      setUser(updatedUser);
    }, 1000); // Check every second, or adjust if needed

    return () => clearInterval(interval);
  }, [user]);

  // Calculate net balance
  useEffect(() => {
    const userFriends = user?.friends || [];

    if (userFriends && userFriends.length > 0) {
      const totalBalance = userFriends.reduce(
        (sum, friend) => sum + Number(friend.balance || 0),
        0
      );
      setNetBalance(totalBalance);

      if (totalBalance > 0) {
        setBalanceMessage(`Net Credit:`);
      } else if (totalBalance < 0) {
        setBalanceMessage(`Net Debt:`);
      } else {
        setBalanceMessage("All Settled");
      }
    } else {
      setBalanceMessage("No one to split with");
    }
  }, [user]);

  const getInitials = (name) =>
    name
      ? name
          .trim()
          .split(" ")
          .map((word) => word[0]?.toUpperCase())
          .slice(0, 2)
          .join("")
      : "U";

  const fallbackQuotes = [
    "Believe in yourself.",
    "Every day is a fresh start.",
    "Progress, not perfection.",
    "You are your only limit.",
  ];

  const randomQuote =
    fallbackQuotes[Math.floor(Math.random() * fallbackQuotes.length)];

  const qrValue = user?.upiId
    ? `upi://pay?pa=${user?.upiId}&pn=${user?.username}&cu=INR&tn=Settling via FairFare`
    : randomQuote;

  return (
    <div
      className="relative cursor-pointer group perspective-1000 w-full max-w-full sm:max-w-full md:max-w-full min-h-[1px] sm:min-h-[10px] md:min-h-[10px]"
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <div
        className={`relative w-full aspect-[1.586/1] md:aspect-auto md:h-64 lg:h-72 duration-700 transform-style-preserve-3d transition-all ease-[cubic-bezier(0.23,1,0.32,1)] ${
          isFlipped
            ? "rotate-y-180"
            : "group-hover:rotate-x-2 group-hover:rotate-y-2"
        }`}
      >
        {/* FRONT */}
        <div className="absolute inset-0 backface-hidden rounded-2xl overflow-hidden shadow-2xl bg-[#121212] border border-white/10">
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/40 pointer-events-none"></div>
          <div className="absolute inset-0 opacity-[0.07] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] pointer-events-none"></div>

          {/* TOP ROW */}
          <div className="absolute top-4 sm:top-5 md:top-6 left-4 sm:left-6 md:left-8 flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-8 sm:w-11 sm:h-9 lg:w-12 lg:h-9 rounded bg-gradient-to-br from-yellow-200 via-yellow-500 to-yellow-700 shadow-sm border border-yellow-800/50 flex items-center justify-center overflow-hidden relative">
              <div className="absolute inset-0 border-[0.5px] border-black/20 rounded opacity-50"></div>
              <div className="w-full h-[1px] bg-black/20 absolute top-1/2 -translate-y-1/2"></div>
              <div className="h-full w-[1px] bg-black/20 absolute left-1/3"></div>
              <div className="h-full w-[1px] bg-black/20 absolute right-1/3"></div>
            </div>

            <svg
              className="w-5 h-5 sm:w-6 sm:h-6 text-white/50"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z"
              />
            </svg>
          </div>

          {/* BRAND */}
          <div className="absolute top-4 sm:top-5 md:top-6 right-4 sm:right-6 md:right-8 text-right">
            <h3 className="text-white font-bold text-lg sm:text-xl tracking-tighter italic">
              FairFare
            </h3>
            <span className="text-[8px] sm:text-[10px] font-bold text-indigo-400 tracking-[0.2em] uppercase block mt-1">
              Infinite
            </span>
          </div>

          {/* USER INFO */}
          <div className="absolute top-16 py-3 sm:top-20 md:top-24 w-full px-4 sm:px-5 md:px-6 flex items-center justify-between">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="size-16 sm:size-15 md:size-20 rounded-full bg-zinc-800 p-0.5 shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                {user?.profilePhotoUrl ? (
                  <img
                    src={user.profilePhotoUrl}
                    alt="User"
                    className="w-full h-full rounded-full object-cover grayscale contrast-125"
                  />
                ) : (
                  <div className="w-full h-full rounded-full bg-indigo-600 flex items-center justify-center text-[10px] sm:text-xs font-bold">
                    {getInitials(user?.username)}
                  </div>
                )}
              </div>

              <div>
                <p className="text-[10px] sm:text-xs text-zinc-400 uppercase tracking-wider font-semibold">
                  {balanceMessage || "Current Balance"}
                </p>
                <p className={`text-base sm:text-xl font-mono tracking-tight font-bold ${
                  netBalance > 0
                    ? "text-emerald-400"
                    : netBalance < 0
                    ? "text-rose-400"
                    : "text-white"
                }`}>
                  {netBalance > 0 ? "+" : netBalance < 0 ? "-" : ""}₹{Math.abs(netBalance).toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          {/* NUMBER + NAME */}
          <div className="absolute bottom-5 sm:bottom-6 left-5 right-5 sm:left-7 sm:right-7 md:left-8 md:right-8">
            <div className="font-mono text-base sm:text-lg text-white/90 tracking-widest mb-2">
              1234 5688 9012 <span className="text-indigo-400">{last4}</span>
            </div>

            <div className="flex justify-between items-end">
              <div className="text-[9px] sm:text-xs text-white/60 uppercase tracking-widest font-medium">
                {user?.username || "CARD HOLDER"}
              </div>
              <div className="text-[8px] sm:text-[10px] text-white/40">
                VALID THRU 12/29
              </div>
            </div>
          </div>
        </div>

        {/* BACK */}
        <div className="absolute inset-0 backface-hidden rounded-2xl overflow-hidden shadow-2xl bg-[#1a1a1a] border border-white/10 rotate-y-180 flex flex-col">
          <div className="w-full h-10 sm:h-12 bg-black mt-4 sm:mt-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
          </div>

          <div className="px-6 sm:px-8 mt-4 sm:mt-6 flex justify-between items-center">
            <div className="w-1/2 sm:w-2/3 h-7 sm:h-8 bg-white/10 rounded flex items-center px-2">
              <div className="w-full h-4 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-30"></div>
            </div>
            <div className="bg-white text-black text-[10px] sm:text-xs font-bold px-2 py-1 rounded">
              CVC 912
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center gap-4 sm:gap-6 mt-3">
            <div className="p-1.5 sm:p-2 bg-white rounded-lg shadow-lg">
              <QRCodeCanvas value={qrValue} size={70} className="sm:size-80" />
            </div>

            <div>
              <h4 className="text-white font-bold text-xs sm:text-sm">
                Scan to Pay
              </h4>
              <p className="text-[9px] sm:text-xs text-zinc-500 max-w-[90px] sm:max-w-[110px] mt-1 leading-tight">
                {user?.upiId ? "UPI ID Linked" : "No UPI Linked"}
              </p>
              <div className="mt-2 text-[8px] sm:text-[10px] text-indigo-400 border border-indigo-400/30 rounded px-1 py-0.5 inline-block">
                VERIFIED
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
      .perspective-1000 { perspective: 1000px; }
      .transform-style-preserve-3d { transform-style: preserve-3d; }
      .rotate-y-180 { transform: rotateY(180deg); }
      .backface-hidden { backface-visibility: hidden; }
      .rotate-x-2 { transform: rotateX(2deg); }
      .rotate-y-2 { transform: rotateY(2deg); }
    `}</style>
    </div>
  );
};

export default FairFareCard;
