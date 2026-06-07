import { useState, useEffect } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import Cookies from "js-cookie";
import logo from "../../public/newIcon-192x192.png";
import { FaHome } from "react-icons/fa";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import toast from "react-hot-toast";
import { auth, googleProvider } from "../../firebase";
import { signInWithPopup } from "firebase/auth";
import api from "../utils/api";
import { motion } from "framer-motion";
const API_BASE = import.meta.env.VITE_API_BASE_URL;

const handleScrollTop = () => {
  window.scrollTo({
    top: 0,
    left: 0,
    behavior: "smooth",
  });
};

const ReferralSignUp = () => {
  const [username, setUserName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpGenerated, setOtpGenerated] = useState("");
  const [loading, setLoading] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState(null);
  const [checkingUsername, setCheckingUsername] = useState(false);

  const navigate = useNavigate();

  // Debounced real-time username availability check
  useEffect(() => {
    if (!username) {
      setUsernameAvailable(null);
      setCheckingUsername(false);
      return;
    }

    if (username.length < 3) {
      setUsernameAvailable(null);
      setCheckingUsername(false);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setCheckingUsername(true);
      try {
        const response = await api.get(`/user/check-username/${encodeURIComponent(username)}`);
        setUsernameAvailable(response.data.available);
      } catch (error) {
        console.error("Error checking username availability:", error);
        setUsernameAvailable(null);
      } finally {
        setCheckingUsername(false);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [username]);
  const { referId } = useParams();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    handleScrollTop();
  }, []);

  //Set Email when the component mounts
  useEffect(() => {
    const emailFromUrl = searchParams.get("email");

    if (emailFromUrl) {
      setEmail(emailFromUrl);
    }
  }, [searchParams]); // 3. Add searchParams as a dependency

  const handleOtpSend = async () => {
    if (!email || !username || !password) {
      alert("Please fill in all fields.");
      return;
    }

    if (usernameAvailable === false) {
      toast.error("Username already taken. Please choose another one.");
      return;
    }

    if (checkingUsername) {
      toast.error("Still checking username availability. Please wait.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      const response = await api.post(`${API_BASE}/user/send-otp`, {
        email,
        username,
      });

      if (response.status === 200) {
        setOtpSent(response.data.otp);
        setOtpGenerated(response.data.otp);
      }
    } catch (error) {
      if (error.response && error.response.status === 410) {
        toast.error("Email already Taken!");
      } else if (error.response && error.response.status === 400) {
        toast.error(error.response.data?.message || "Invalid request.");
      } else {
        toast.error("Failed to send OTP.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    try {
      setLoading(true);
      const result = await signInWithPopup(auth, googleProvider);
      const idToken = await result.user.getIdToken();

      const response = await api.post(`/user/google-auth`, {
        idToken,
        referId,
      });

      if (response.status === 200) {
        const { id, token } = response.data;

        if (id) Cookies.set("id", id, { expires: 7 });
        if (token) {
          Cookies.set("authToken", token, {
            expires: 7,
            secure: true,
            sameSite: "strict",
          });
        }

        toast.success("Successfully authenticated with Google!");
        navigate("/setup-profile");
      }
    } catch (error) {
      console.error("Google Auth Error:", error);
      toast.error(error.response?.data?.message || "Google Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpVerify = async () => {
    try {
      const response = await api.post(`${API_BASE}/user/verify-otp`, {
        email,
        otp,
        otpGenerated,
        password,
        username,
        referId,
      });

      if (response.status === 200) {
        const { id, token } = response.data;
        Cookies.set("id", id, { expires: 7 });
        if (token) {
          Cookies.set("authToken", token, {
            expires: 7,
            secure: true,
            sameSite: "strict",
          });
        }
        navigate("/setup-profile");
      }
    } catch (error) {
      console.error("Error verifying OTP:", error);
      alert("OTP verification failed.");
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-[#0a0a0a] overflow-hidden flex items-center justify-center selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* --- BACKGROUND: The Digital Aurora --- */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-[70%] h-[70%] bg-indigo-900/20 rounded-full blur-[120px] animate-pulse-slow"></div>
        <div className="absolute bottom-[-20%] left-[-10%] w-[70%] h-[70%] bg-fuchsia-900/20 rounded-full blur-[120px] animate-pulse-slow delay-1000"></div>
        {/* Noise overlay */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.05]"></div>
      </div>

      {/* --- NAVIGATION: Back Button --- */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.6, 0.2, 1] }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="absolute top-8 left-8 z-50"
      >
        <button
          onClick={() => navigate("/")}
          className="group flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300 backdrop-blur-md"
        >
          <FaHome className="text-white/70 group-hover:text-white transition-colors" />
          <span className="text-sm font-medium text-white/70 group-hover:text-white transition-colors">
            Home
          </span>
        </button>
      </motion.div>

      {/* --- MAIN CARD --- */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: [0, 0.4, 0.15, 1], y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
        className="relative z-10 w-full max-w-md p-4"
      >
        {/* Glow behind card */}
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/10 to-transparent rounded-3xl blur-xl opacity-50 pointer-events-none"></div>

        <div className="relative bg-black/40 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 md:p-10 shadow-2xl ring-1 ring-white/5">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-tr from-white/10 to-transparent border border-white/10 mb-4 shadow-lg">
              <img
                src={logo}
                alt="FairFare"
                className="w-6 h-6 object-contain"
              />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">
              Create Account
            </h1>
            <p className="text-white/40 text-sm mt-2">
              Join the future of social finance.
            </p>
          </div>

          <div className="space-y-5">
            {/* Step 1: User Details (Hide if OTP sent to focus on verification, or keep visible disabled) */}
            <div
              className={`space-y-4 transition-all duration-500 ${otpSent
                ? "opacity-50 pointer-events-none grayscale"
                : "opacity-100"
                }`}
            >
              {/* Full Name */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-white/50 uppercase tracking-wider ml-1">
                  Full Name
                </label>
                <input
                  value={username}
                  onChange={(e) => setUserName(e.target.value)}
                  type="text"
                  placeholder="John Doe"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:bg-white/10 focus:border-white/20 transition-all"
                />
                {checkingUsername && (
                  <p className="text-[11px] text-indigo-400/80 ml-1 transition-all">Checking availability...</p>
                )}
                {!checkingUsername && usernameAvailable === true && (
                  <p className="text-[11px] text-emerald-400/90 ml-1 transition-all">✓ Username is available</p>
                )}
                {!checkingUsername && usernameAvailable === false && (
                  <p className="text-[11px] text-rose-400/90 ml-1 transition-all">✗ Username already taken</p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-white/50 uppercase tracking-wider ml-1">
                  Email
                </label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  placeholder="name@example.com"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:bg-white/10 focus:border-white/20 transition-all"
                />
                {searchParams.get("email") && email === searchParams.get("email") && (
                  <p className="text-[10px] text-cyan-400/60 ml-1">
                    Pre-filled from invitation link
                  </p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-white/50 uppercase tracking-wider ml-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:bg-white/10 focus:border-white/20 transition-all pr-10"
                  />
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors"
                  >
                    {showPassword ? (
                      <FaEyeSlash size={16} />
                    ) : (
                      <FaEye size={16} />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Step 2: OTP Verification (Slide in) */}
            {otpSent && (
              <div className="animate-in slide-in-from-bottom-4 fade-in duration-500 pt-4 border-t border-white/10">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span className="text-sm font-medium text-emerald-400">
                    Verification Code Sent
                  </span>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-white/50 uppercase tracking-wider ml-1">
                    Enter OTP
                  </label>
                  <input
                    value={otp}
                    onChange={(e) => {
                      const val = e.target.value;
                      // 1. Check if the input is a number and length is <= 6
                      if (/^\d*$/.test(val) && val.length <= 6) {
                        setOtp(val);
                      }
                    }}
                    maxLength={6}
                    type="text"
                    placeholder="• • • • • •"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-center tracking-[0.5em] font-mono text-lg placeholder-white/10 focus:outline-none focus:bg-white/10 focus:border-indigo-500/50 transition-all"
                    autoFocus
                  />
                </div>
              </div>
            )}

            {/* Action Button */}
            <button
              onClick={otpSent ? handleOtpVerify : handleOtpSend}
              disabled={loading}
              className={`relative w-full overflow-hidden rounded-xl py-4 font-semibold text-sm tracking-wide transition-all duration-300 mt-2
                ${loading
                  ? "bg-white/10 text-white/30 cursor-wait"
                  : otpSent
                    ? "bg-indigo-600 text-white hover:bg-indigo-500 shadow-[0_0_20px_rgba(79,70,229,0.4)]"
                    : "bg-white text-black hover:bg-white/90 shadow-[0_0_20px_rgba(255,255,255,0.3)]"
                }`}
            >
              <span className="relative z-10">
                {loading
                  ? "Processing..."
                  : otpSent
                    ? "Verify & Complete"
                    : "Send Verification Code"}
              </span>
            </button>

            {/* Footer */}
            <div className="text-center pt-2">
              <span className="text-white/40 text-sm">
                Already have an account?{" "}
              </span>
              <Link
                to="/login"
                className="text-white font-medium hover:underline decoration-white/30 underline-offset-4"
              >
                Log In
              </Link>
            </div>

            {/* OR Divider */}
            <div className={`relative flex items-center py-2 transition-all duration-500 ${otpSent ? "opacity-30 pointer-events-none grayscale" : "opacity-100"}`}>
              <div className="flex-grow border-t border-white/10"></div>
              <span className="flex-shrink-0 mx-4 text-white/30 text-xs font-medium uppercase tracking-widest">
                OR
              </span>
              <div className="flex-grow border-t border-white/10"></div>
            </div>

            {/* Google Signup Button */}
            <button
              onClick={handleGoogleAuth}
              disabled={loading || otpSent}
              className={`relative w-full overflow-hidden rounded-xl py-3.5 px-4 font-semibold text-sm tracking-wide transition-all duration-300 flex items-center justify-center gap-3 border border-white/10 bg-white/5 hover:bg-white/10
                ${(loading || otpSent) ? "opacity-50 cursor-not-allowed" : "hover:-translate-y-0.5"}`}
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              <span className="text-white/90 font-medium">Continue with Google</span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* Styles */}
      <style>{`
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(1.1); }
        }
        .animate-pulse-slow {
          animation: pulse-slow 8s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default ReferralSignUp;
