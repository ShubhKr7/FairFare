import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import Cookies from "js-cookie";
import logo from "../../public/newIconV3-192x192.png";
import { FaHome } from "react-icons/fa";
import { FaEye, FaEyeSlash, FaRobot, FaMagic } from "react-icons/fa";
import toast from "react-hot-toast";
import ReactMarkdown from "react-markdown";
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

const PRIVACY_TEMPLATES = [
  // Template 1 (Short Version)
  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500" key="p1">
    <div className="flex items-center gap-3 text-emerald-400 mb-2">
      <FaMagic className="text-xl" />
      <h3 className="text-lg font-bold">AI Summary: Short Version</h3>
    </div>
    <div className="bg-white/5 border border-white/10 rounded-xl p-5">
      <p className="text-white/80 leading-7 text-sm">
        FairFare collects basic personal information such as your name, email, UPI ID, and expense-related data to provide and improve its services. Device and usage information may also be collected for analytics and performance monitoring. Your data is used to manage transactions, send notifications, prevent misuse, and enhance user experience. FairFare does not sell personal information and only shares data with trusted service providers or when legally required. Security measures such as encryption and password protection are implemented, although absolute security cannot be guaranteed. Users may request access, correction, or deletion of their data by contacting support.
      </p>
    </div>
  </div>,

  // Template 2 (User-Friendly Version)
  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500" key="p2">
    <div className="flex items-center gap-3 text-blue-400 mb-2">
      <FaRobot className="text-xl" />
      <h3 className="text-lg font-bold">AI Summary: User-Friendly Version</h3>
    </div>
    <div className="bg-white/5 border border-white/10 rounded-xl p-5">
      <p className="text-white/80 leading-7 text-sm">
        FairFare gathers only the information necessary to help users track and split expenses effectively. This includes account details, transaction records, and limited technical data like device information and app usage. The information is used to operate the platform, send reminders, and improve functionality. Personal data is never sold and is shared only with essential service partners or when required by law. Data is stored securely and retained only as long as necessary. Users have the right to access, update, or request deletion of their information at any time.
      </p>
    </div>
  </div>,

  // Template 3 (Compact Legal Version)
  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500" key="p3">
    <div className="flex items-center gap-3 text-purple-400 mb-2">
      <FaMagic className="text-xl" />
      <h3 className="text-lg font-bold">AI Summary: Compact Legal Version</h3>
    </div>
    <div className="bg-white/5 border border-white/10 rounded-xl p-5">
      <p className="text-white/80 leading-7 text-sm">
        FairFare collects personal, transactional, and technical data to deliver and maintain its expense-management services. Information is processed for service functionality, communication, fraud prevention, and analytics. Data may be shared with authorized service providers or legal authorities when necessary but is never sold. Reasonable security safeguards are applied, and information is retained only for operational or legal purposes. Users may exercise rights relating to access, correction, or deletion of their personal data by contacting FairFare.
      </p>
    </div>
  </div>
];

const TERMS_TEMPLATES = [
  // Template 1 (Short Version)
  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500" key="t1">
    <div className="flex items-center gap-3 text-emerald-400 mb-2">
      <FaMagic className="text-xl" />
      <h3 className="text-lg font-bold">AI Summary: Short Version</h3>
    </div>
    <div className="bg-white/5 border border-white/10 rounded-xl p-5">
      <p className="text-white/80 leading-7 text-sm">
        By using FairFare, users agree to follow the platform’s rules and use the service only for lawful purposes. Users are responsible for maintaining account security and ensuring accurate information. FairFare provides tools for tracking and splitting expenses but does not directly process payments. The service is provided as is, without guarantees of uninterrupted operation or absolute accuracy. FairFare is not liable for payment disputes, user errors, or third-party service failures.
      </p>
    </div>
  </div>,

  // Template 2 (User-Friendly Version)
  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500" key="t2">
    <div className="flex items-center gap-3 text-rose-400 mb-2">
      <FaRobot className="text-xl" />
      <h3 className="text-lg font-bold">AI Summary: User-Friendly Version</h3>
    </div>
    <div className="bg-white/5 border border-white/10 rounded-xl p-5">
      <p className="text-white/80 leading-7 text-sm">
        FairFare allows users to manage shared expenses and track balances with friends or groups. Users must be eligible to use the service, protect their account credentials, and avoid misuse or illegal activity. Payments between users are handled externally or through third-party services, and FairFare is not responsible for transaction disputes. The platform may suspend accounts that violate its rules. Continued use of the service means acceptance of any updated terms.
      </p>
    </div>
  </div>,

  // Template 3 (Compact Legal Version)
  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500" key="t3">
    <div className="flex items-center gap-3 text-cyan-400 mb-2">
      <FaMagic className="text-xl" />
      <h3 className="text-lg font-bold">AI Summary: Compact Legal Version</h3>
    </div>
    <div className="bg-white/5 border border-white/10 rounded-xl p-5">
      <p className="text-white/80 leading-7 text-sm">
        These Terms govern access to and use of FairFare services. Users must comply with eligibility requirements, maintain account security, and use the platform lawfully. FairFare functions as an expense-tracking tool and does not assume responsibility for external payment transactions. The service is provided without warranties, and liability is limited to the extent permitted by law. FairFare may suspend or terminate access for violations, and all disputes are governed by Indian law under the jurisdiction of New Delhi courts.
      </p>
    </div>
  </div>
];

const SignUp = () => {
  const [username, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpGenerated, setOtpGenerated] = useState("");
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [activeModal, setActiveModal] = useState(null); // 'privacy' | 'terms' | null
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [thinkingText, setThinkingText] = useState("");
  const [summaryTemplateIndex, setSummaryTemplateIndex] = useState(0);

  // State for fetched legal documents
  const [termsContent, setTermsContent] = useState(null);
  const [privacyContent, setPrivacyContent] = useState(null);
  const [loadingDocs, setLoadingDocs] = useState(true);
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
        const response = await axios.get(`${API_BASE}/user/check-username/${encodeURIComponent(username)}`);
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

  useEffect(() => {
    handleScrollTop();
  }, []);

  useEffect(() => {
    if (!activeModal) {
      setIsSummarizing(false);
      setShowSummary(false);
      setThinkingText("");
    }
  }, [activeModal]);

  // Fetch Terms and Privacy Policy on component mount
  useEffect(() => {
    const fetchLegalDocs = async () => {
      try {
        const [termsRes, privacyRes] = await Promise.all([
          axios.get(`${API_BASE}/terms/active?type=terms`),
          axios.get(`${API_BASE}/terms/active?type=privacy`)
        ]);

        if (termsRes.data?.term) {
          setTermsContent(termsRes.data.term);
        }
        if (privacyRes.data?.term) {
          setPrivacyContent(privacyRes.data.term);
        }
      } catch (error) {
        console.error("Error fetching legal documents:", error);
        toast.error("Failed to load legal documents");
      } finally {
        setLoadingDocs(false);
      }
    };

    fetchLegalDocs();
  }, []);

  useEffect(() => {
    let interval;
    if (isSummarizing) {
      const steps = [
        "Reading document...",
        "Analyzing legal clauses...",
        "Extracting key points...",
        "Simplifying language...",
        "Finalizing summary...",
      ];
      let stepIndex = 0;
      setThinkingText(steps[0]);

      interval = setInterval(() => {
        stepIndex++;
        if (stepIndex < steps.length) {
          setThinkingText(steps[stepIndex]);
        } else {
          clearInterval(interval);
          setIsSummarizing(false);
          setShowSummary(true);
        }
      }, 800);
    }
    return () => clearInterval(interval);
  }, [isSummarizing]);

  const handleSummarize = () => {
    setIsSummarizing(true);
    setShowSummary(false);
    setSummaryTemplateIndex(Math.floor(Math.random() * 3));
  };

  const handleOtpSend = async () => {
    if (!email || !username || !password) {
      toast.error("Please fill in all fields.");
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

    if (!agreed) {
      toast.error("Please agree to the Terms and Privacy Policy.");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(
        `${API_BASE}/user/send-otp`,
        {
          email,
          username,
        }
      );

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
        console.log(error);
      }
    } finally {
      setLoading(false);
    }
  }

  const handleOtpVerify = async () => {
    try {
      const response = await axios.post(
        `${API_BASE}/user/verify-otp`,
        {
          email,
          otp,
          otpGenerated,
          password,
          username,
        }
      );

      if (response.status === 200) {
        const { id, token } = response.data; // ✅ token expected from backend

        // existing behaviour: keep this
        Cookies.set("id", id, { expires: 7 });

        // ✅ NEW: store JWT in a secure cookie (frontend-readable)
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
      toast.error("OTP verification failed.");
    }
  };

  const handleGoogleAuth = async () => {
    try {
      setLoading(true);
      const result = await signInWithPopup(auth, googleProvider);
      const idToken = await result.user.getIdToken();

      const response = await api.post(`/user/google-auth`, {
        idToken,
      });

      if (response.status === 200) {
        const { id, token } = response.data;

        // Set cookies
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
        initial={{ opacity: 0, rotate: -90, scale: 0.5 }}
        animate={{ opacity: 1, rotate: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
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
        initial={{ opacity: 0, scale: 0.92, rotate: 2 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
        className="relative z-10 w-full max-w-md px-4"
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
                  onChange={(e) => setUserName(e.target.value.trim())}
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
                  onChange={(e) => setEmail(e.target.value.trim())}
                  type="email"
                  placeholder="name@example.com"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:bg-white/10 focus:border-white/20 transition-all"
                />
              </div>

              {/* Password */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-white/50 uppercase tracking-wider ml-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value.trim())}
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

              {/* Terms & Privacy Checkbox */}
              <div className="flex items-start gap-3 pt-2 group">
                <div className="relative flex items-center pt-0.5">
                  <input
                    id="terms"
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="peer h-4 w-4 cursor-pointer appearance-none rounded border border-white/10 bg-white/5 transition-all checked:border-indigo-500 checked:bg-indigo-500 hover:border-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 transition-opacity peer-checked:opacity-100">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-3 w-3"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                </div>
                <label
                  htmlFor="terms"
                  className="text-xs text-white/40 cursor-pointer select-none leading-relaxed transition-colors group-hover:text-white/60"
                >
                  By creating an account, I agree to the{" "}
                  <button
                    type="button"
                    onClick={() => setActiveModal("privacy")}
                    className="text-white/70 underline decoration-white/20 hover:decoration-white/80 hover:text-white transition-all outline-none"
                  >
                    Privacy Policy
                  </button>{" "}
                  and{" "}
                  <button
                    type="button"
                    onClick={() => setActiveModal("terms")}
                    className="text-white/70 underline decoration-white/20 hover:decoration-white/80 hover:text-white transition-all outline-none"
                  >
                    Terms & Conditions
                  </button>
                  .
                </label>
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
                    onChange={(e) => setOtp(e.target.value)}
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

      {/* --- MODAL OVERLAY --- */}
      {activeModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setActiveModal(null)}
          ></div>

          <div className="relative w-full max-w-2xl bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/5">
              <h2 className="text-xl font-bold text-white">
                {activeModal === "privacy"
                  ? "Privacy Policy"
                  : "Terms & Conditions"}
              </h2>
              {!isSummarizing && !showSummary && (
                <button
                  onClick={handleSummarize}
                  className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 rounded-full text-xs font-medium text-indigo-300 hover:text-indigo-200 transition-all mr-6"
                >
                  <FaMagic /> Summarize with AI
                </button>
              )}
              <button
                onClick={() => setActiveModal(null)}
                className="text-white/50 hover:text-white transition-colors p-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar text-white/80 leading-relaxed space-y-4">
              {isSummarizing ? (
                <div className="flex flex-col items-center justify-center py-20 animate-in fade-in duration-300">
                  <div className="relative w-16 h-16 mb-6">
                    <div className="absolute inset-0 bg-indigo-500/20 rounded-full animate-ping"></div>
                    <div className="relative flex items-center justify-center w-16 h-16 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-full shadow-lg shadow-indigo-500/30">
                      <FaRobot className="text-2xl text-white animate-bounce" />
                    </div>
                  </div>
                  <h3 className="text-xl font-medium text-white mb-2">
                    AI Processing
                  </h3>
                  <p className="text-white/50 text-sm animate-pulse">
                    {thinkingText}
                  </p>
                </div>
              ) : showSummary ? (
                <>
                  {activeModal === "privacy" ? (
                    <>
                      {PRIVACY_TEMPLATES[summaryTemplateIndex]}
                      <div className="pt-4 border-t border-white/10">
                        <button
                          onClick={() => setShowSummary(false)}
                          className="text-sm text-indigo-400 hover:text-indigo-300 underline underline-offset-4"
                        >
                          View Full Legal Text
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      {TERMS_TEMPLATES[summaryTemplateIndex]}
                      <div className="pt-4 border-t border-white/10">
                        <button
                          onClick={() => setShowSummary(false)}
                          className="text-sm text-indigo-400 hover:text-indigo-300 underline underline-offset-4"
                        >
                          View Full Legal Text
                        </button>
                      </div>
                    </>
                  )}
                </>
              ) : activeModal === "privacy" ? (
                <>
                  {loadingDocs ? (
                    <div className="flex items-center justify-center py-20">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
                    </div>
                  ) : privacyContent ? (
                    <div className="prose prose-invert max-w-none">
                      <div className="text-xs text-white/40 mb-6 pb-4 border-b border-white/10">
                        Version: {privacyContent.version} | Last updated: {new Date(privacyContent.updatedAt).toLocaleString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                      <ReactMarkdown>{privacyContent.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-white/60 text-center py-10">No Privacy Policy available</p>
                  )}
                </>
              ) : (
                <>
                  {loadingDocs ? (
                    <div className="flex items-center justify-center py-20">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
                    </div>
                  ) : termsContent ? (
                    <div className="prose prose-invert max-w-none">
                      <div className="text-xs text-white/40 mb-6 pb-4 border-b border-white/10">
                        Version: {termsContent.version} | Last updated: {new Date(termsContent.updatedAt).toLocaleString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                      <ReactMarkdown>{termsContent.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-white/60 text-center py-10">No Terms & Conditions available</p>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-white/10 bg-white/5 flex justify-end">
              <button
                onClick={() => setActiveModal(null)}
                className="px-6 py-2 bg-white text-black font-medium rounded-lg hover:bg-white/90 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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

export default SignUp;
