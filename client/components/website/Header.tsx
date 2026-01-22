/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import {
  Search,
  ShoppingCart,
  X,
  ChevronDown,
  User as UserIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  meUser,
  loginUser,
  logoutUser,
  sendSignupOtp,
  verifySignupOtp,
  registerAfterOtp,
  type MeUser,
} from "@/lib/userApi";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;
const VENDOR_URL = "/vendor"; // change if your vendor panel route is different

async function fetchCartCount(): Promise<number> {
  try {
    const res = await fetch(`${API_BASE}/common/cart`, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });
    const json = await res.json();
    const items = json?.data?.items || [];
    return items.reduce((sum: number, it: any) => sum + Number(it.qty || 0), 0);
  } catch {
    return 0;
  }
}

type SignupStep = "sendOtp" | "verifyOtp" | "register";

/** ---------- Search Types ---------- */
type SuggestItem = { label: string; value: string; type: "PRODUCT" | "CATEGORY" | "SUBCATEGORY" | "CODE" };
type SuggestResponse = { items: SuggestItem[] };

function norm(v: any) {
  return String(v ?? "").trim();
}

export function WebsiteHeader() {
  const router = useRouter();

  const [showAuth, setShowAuth] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");

  // ✅ user session
  const [user, setUser] = useState<MeUser | null>(null);
  const [userLoading, setUserLoading] = useState(true);

  // ✅ dropdown
  const [openMenu, setOpenMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // ✅ cart counter
  const [cartCount, setCartCount] = useState<number>(0);

  // ✅ auth form states
  const [busy, setBusy] = useState(false);
  const [authError, setAuthError] = useState<string>("");

  // login fields
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // signup fields
  const [signupStep, setSignupStep] = useState<SignupStep>("sendOtp");
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [signupOtp, setSignupOtp] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirm, setSignupConfirm] = useState("");

  /** ---------------- SEARCH STATE ---------------- */
  const [q, setQ] = useState("");
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestItems, setSuggestItems] = useState<SuggestItem[]>([]);
  const suggestBoxRef = useRef<HTMLDivElement | null>(null);
  const suggestAbortRef = useRef<AbortController | null>(null);

  // initial load: cart + user
  useEffect(() => {
    (async () => {
      const [count, me] = await Promise.all([fetchCartCount(), meUser()]);
      setCartCount(count);
      setUser(me);
      setUserLoading(false);
    })();
  }, []);

  // refresh count when cart changes
  useEffect(() => {
    const handler = async () => {
      const count = await fetchCartCount();
      setCartCount(count);
    };
    window.addEventListener("cart:updated", handler);
    return () => window.removeEventListener("cart:updated", handler);
  }, []);

  // close dropdown on outside click (profile menu)
  useEffect(() => {
    const onDoc = (e: any) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target)) setOpenMenu(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
// ✅ Open login popup from anywhere (Cart/Checkout etc.)
useEffect(() => {
  const openAuth = () => {
    setAuthError("");
    setMode("login");
    setShowAuth(true);
  };

  window.addEventListener("auth:open-login", openAuth);
  return () => window.removeEventListener("auth:open-login", openAuth);
}, []);

  // close search suggestion on outside click
  useEffect(() => {
    const onDoc = (e: any) => {
      if (!suggestBoxRef.current) return;
      if (!suggestBoxRef.current.contains(e.target)) setSuggestOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const CartIconWithBadge = useMemo(() => {
    return (
      <Link href="/cart" className="relative hover:text-[#82008F]">
        <ShoppingCart className="h-[22px] w-[22px]" />
        {cartCount > 0 && (
          <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-[#82008F] text-white text-[11px] font-semibold flex items-center justify-center leading-none">
            {cartCount > 99 ? "99+" : cartCount}
          </span>
        )}
      </Link>
    );
  }, [cartCount]);

  const openLogin = () => {
    setAuthError("");
    setMode("login");
    setShowAuth(true);
  };

  const openSignup = () => {
    setAuthError("");
    setMode("signup");
    setSignupStep("sendOtp");
    setShowAuth(true);
  };

  // -------- Auth Handlers --------
  const handleLogin = async () => {
    setAuthError("");
    if (!loginEmail || !loginPassword) {
      setAuthError("Email and password required");
      return;
    }

    setBusy(true);
    try {
      await loginUser(loginEmail.trim().toLowerCase(), loginPassword);
      const me = await meUser();
      setUser(me);
      setShowAuth(false);
      setLoginPassword("");
      window.dispatchEvent(new Event("cart:updated"));
    } catch (e: any) {
      setAuthError(e?.message || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    setBusy(true);
    try {
      await logoutUser();
      setUser(null);
      setOpenMenu(false);
      window.dispatchEvent(new Event("cart:updated"));
      window.location.href = "/";
    } catch (e: any) {
      // silent
    } finally {
      setBusy(false);
    }
  };

  const handleSendOtp = async () => {
    setAuthError("");
    if (!signupEmail) return setAuthError("Email required");

    setBusy(true);
    try {
      await sendSignupOtp(signupEmail.trim().toLowerCase());
      setSignupStep("verifyOtp");
    } catch (e: any) {
      setAuthError(e?.message || "OTP send failed");
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOtp = async () => {
    setAuthError("");
    if (!signupEmail || !signupOtp) return setAuthError("Email and OTP required");

    setBusy(true);
    try {
      await verifySignupOtp(signupEmail.trim().toLowerCase(), signupOtp.trim());
      setSignupStep("register");
    } catch (e: any) {
      setAuthError(e?.message || "OTP verify failed");
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async () => {
    setAuthError("");
    if (!signupName || !signupEmail || !signupPhone) return setAuthError("Name, email, phone required");
    if (!signupPassword || signupPassword.length < 6) return setAuthError("Password must be 6+ chars");
    if (signupPassword !== signupConfirm) return setAuthError("Passwords do not match");

    setBusy(true);
    try {
      await registerAfterOtp({
        name: signupName.trim(),
        email: signupEmail.trim().toLowerCase(),
        phone: signupPhone.trim(),
        password: signupPassword,
        confirmPassword: signupConfirm,
      });

      const me = await meUser();
      setUser(me);
      setShowAuth(false);
      window.dispatchEvent(new Event("cart:updated"));
    } catch (e: any) {
      setAuthError(e?.message || "Signup failed");
    } finally {
      setBusy(false);
    }
  };

  const ProfileButton = () => {
    if (userLoading) return <div className="text-[15px] text-gray-500">...</div>;

    if (!user) {
      return (
        <button onClick={openLogin} className="hover:text-[#82008F] cursor-pointer">
          Login
        </button>
      );
    }

    return (
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setOpenMenu((v) => !v)}
          className="flex items-center gap-2 hover:text-[#82008F] cursor-pointer"
          type="button"
        >
          <UserIcon className="h-5 w-5" />
          <span className="max-w-[140px] truncate">{user.name}</span>
          <ChevronDown className={`h-4 w-4 transition ${openMenu ? "rotate-180" : ""}`} />
        </button>

        {openMenu && (
          <div className="absolute left-0 mt-2 w-52 border bg-white shadow-lg overflow-hidden">
            <Link
              href="/user/dashboard"
              className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
              onClick={() => setOpenMenu(false)}
            >
              Dashboard
            </Link>

            <button
              onClick={handleLogout}
              disabled={busy}
              className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-60"
              type="button"
            >
              {busy ? "Logging out..." : "Logout"}
            </button>
          </div>
        )}
      </div>
    );
  };

  /** ---------------- SEARCH FUNCTIONS ---------------- */
  const goSearch = (query: string) => {
    const value = norm(query);
    if (!value) return;
    setSuggestOpen(false);
    router.push(`/search?q=${encodeURIComponent(value)}`);
  };

  const fetchSuggest = async (query: string) => {
    const value = norm(query);
    if (!value) {
      setSuggestItems([]);
      setSuggestOpen(false);
      return;
    }

    // cancel previous request
    if (suggestAbortRef.current) suggestAbortRef.current.abort();
    const controller = new AbortController();
    suggestAbortRef.current = controller;

    setSuggestLoading(true);
    try {
      const res = await fetch(`${API_BASE}/common/products/suggest?q=${encodeURIComponent(value)}`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        signal: controller.signal,
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || "Suggest failed");

      const data = (json?.data ?? json) as SuggestResponse;
      const list = Array.isArray(data?.items) ? data.items : [];

      // fallback (if backend returns different shape)
      const normalized: SuggestItem[] = list
        .map((x: any) => ({
          label: String(x?.label || x?.name || x?.title || ""),
          value: String(x?.value || x?.slug || x?._id || x?.code || x?.label || ""),
          type: (x?.type as any) || "PRODUCT",
        }))
        .filter((x) => x.label);

      setSuggestItems(normalized.slice(0, 12));
      setSuggestOpen(true);
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      // if suggest fails, do not break header
      setSuggestItems([]);
      setSuggestOpen(false);
    } finally {
      setSuggestLoading(false);
    }
  };

  // debounce suggest
  useEffect(() => {
    const value = norm(q);
    if (!value) {
      setSuggestItems([]);
      setSuggestOpen(false);
      return;
    }
    const t = setTimeout(() => fetchSuggest(value), 250);
    return () => clearTimeout(t);
     
  }, [q]);

  return (
    <>
      <header className="sticky top-0 z-50 bg-white border-b border-[#cecede]">
        <div className="max-w-[1400px] mx-auto px-2 sm:px-2">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between py-3 sm:py-4 gap-3">
            {/* LEFT: LOGO */}
            <div className="flex items-center justify-between md:justify-start">
              <Link href="/" className="select-none">
                <img src="/MECHKART.png" alt="Mechkart" className="w-40 h-16" />
              </Link>

              {/* MOBILE ACTIONS */}
              <div className="flex md:hidden items-center gap-3 text-[14px] font-medium text-gray-700">
                <Link
  href={VENDOR_URL}
  className="text-[13px] font-semibold text-gray-800 hover:text-[#82008F] whitespace-nowrap"
>
  Become a Supplier
</Link>
                {!user ? (
                  <button onClick={openLogin} className="hover:text-[#82008F]">
                    Login
                  </button>
                ) : (
                  <Link href="/account" className="hover:text-[#82008F]">
                    {user.name}
                  </Link>
                )}

                <Link href="/cart" className="relative hover:text-[#82008F]">
                  <ShoppingCart className="h-5 w-5" />
                  {cartCount > 0 && (
                    <span className="absolute -top-2 -right-2 min-w-4 h-4 px-1 rounded-full bg-[#82008F] text-white text-[10px] font-semibold flex items-center justify-center leading-none">
                      {cartCount > 99 ? "99+" : cartCount}
                    </span>
                  )}
                </Link>
              </div>
            </div>

            {/* CENTER: SEARCH */}
            <div className="flex md:flex-1 md:justify-center">
              <div className="w-full md:max-w-[640px] relative" ref={suggestBoxRef}>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    goSearch(q);
                  }}
                >
                  <div className="h-11 sm:h-12 flex items-center rounded-full border border-gray-300 bg-gray-50 px-4 shadow-sm focus-within:border-[#82008F] focus-within:ring-2 focus-within:ring-[#82008F]/20">
                    <button
                      type="button"
                      onClick={() => goSearch(q)}
                      className="shrink-0"
                      aria-label="Search"
                    >
                      <Search className="h-5 w-5 text-gray-500 shrink-0" />
                    </button>

                    <input
                      type="text"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      onFocus={() => {
                        if (suggestItems.length) setSuggestOpen(true);
                      }}
                      placeholder="Try Saree, Kurti or Search by Product Code"
                      className="ml-3 w-full bg-transparent text-[14px] sm:text-[15px] text-gray-800 placeholder:text-gray-400 focus:outline-none"
                    />

                    {q ? (
                      <button
                        type="button"
                        onClick={() => {
                          setQ("");
                          setSuggestOpen(false);
                          setSuggestItems([]);
                        }}
                        className="ml-2 text-gray-400 hover:text-gray-700"
                        aria-label="Clear"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                </form>

                {/* Suggest dropdown */}
                {suggestOpen && (suggestLoading || suggestItems.length > 0) ? (
                  <div className="absolute left-0 right-0 mt-2 rounded-2xl border bg-white shadow-lg overflow-hidden z-50">
                    {suggestLoading ? (
                      <div className="px-4 py-3 text-sm text-gray-500">Searching...</div>
                    ) : null}

                    {!suggestLoading && suggestItems.map((s, idx) => (
                      <button
                        key={`${s.type}-${s.value}-${idx}`}
                        type="button"
                        onClick={() => {
                          // Simple behavior: everything goes to search page by label
                          // (Category/Subcategory bhi search query ki tarah work karega)
                          goSearch(s.label || q);
                        }}
                        className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 flex items-center justify-between"
                      >
                        <span className="text-gray-800">{s.label}</span>
                        <span className="text-[11px] font-semibold text-gray-500">{s.type}</span>
                      </button>
                    ))}

                    {!suggestLoading && suggestItems.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-gray-500">No suggestions</div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            {/* RIGHT: DESKTOP ACTIONS */}
            <div className="hidden md:flex items-center gap-6 text-[15px] font-medium text-gray-700">
  <Link
    href={VENDOR_URL}
    className="text-[14px] font-semibold text-gray-800 hover:text-[#82008F]"
  >
    Become a Supplier
  </Link>

  <ProfileButton />
  {CartIconWithBadge}
</div>

          </div>
        </div>
      </header>

      {/* ================= AUTH POPUP ================= */}
      {showAuth && (
        <div className="fixed inset-0 z-999 bg-black/40 flex items-center justify-center px-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl relative">
            <button
              onClick={() => setShowAuth(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-black"
              type="button"
            >
              <X />
            </button>

            <div className="px-8 py-7">
              <h2 className="text-2xl font-semibold text-center text-gray-900">
                {mode === "login" ? "Welcome Back" : "Create Account"}
              </h2>

              <p className="text-sm text-gray-500 text-center mt-1 mb-6">
                {mode === "login"
                  ? "Login to continue shopping"
                  : signupStep === "sendOtp"
                  ? "Enter email to receive OTP"
                  : signupStep === "verifyOtp"
                  ? "Enter OTP sent to your email"
                  : "Complete your profile to finish signup"}
              </p>

              {authError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {authError}
                </div>
              )}

              {/* LOGIN FORM */}
              {mode === "login" && (
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleLogin();
                  }}
                >
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Email Address</label>
                    <input
                      type="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#82008F]/30 focus:border-[#82008F]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Password</label>
                    <input
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#82008F]/30 focus:border-[#82008F]"
                      required
                    />
                  </div>

                  <div className="text-right">
                    <button type="button" className="text-xs text-[#82008F] hover:underline">
                      Forgot password?
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full mt-2 rounded-lg bg-[#82008F] py-2.5 text-white text-sm font-semibold hover:bg-[#6f007a] transition disabled:opacity-60"
                  >
                    {busy ? "Logging in..." : "Login"}
                  </button>
                </form>
              )}

              {/* SIGNUP FLOW (OTP) */}
              {mode === "signup" && (
                <div className="space-y-4">
                  {/* Step 1: Send OTP */}
                  {signupStep === "sendOtp" && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Email Address</label>
                        <input
                          type="email"
                          value={signupEmail}
                          onChange={(e) => setSignupEmail(e.target.value)}
                          placeholder="you@example.com"
                          className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#82008F]/30 focus:border-[#82008F]"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleSendOtp}
                        disabled={busy}
                        className="w-full rounded-lg bg-[#82008F] py-2.5 text-white text-sm font-semibold hover:bg-[#6f007a] transition disabled:opacity-60"
                      >
                        {busy ? "Sending OTP..." : "Send OTP"}
                      </button>
                    </>
                  )}

                  {/* Step 2: Verify OTP */}
                  {signupStep === "verifyOtp" && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                        <input
                          type="email"
                          value={signupEmail}
                          onChange={(e) => setSignupEmail(e.target.value)}
                          className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">OTP</label>
                        <input
                          type="text"
                          value={signupOtp}
                          onChange={(e) => setSignupOtp(e.target.value)}
                          placeholder="Enter OTP"
                          className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#82008F]/30 focus:border-[#82008F]"
                        />
                      </div>

                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={handleSendOtp}
                          disabled={busy}
                          className="w-full rounded-lg border border-gray-300 py-2.5 text-sm font-semibold hover:bg-gray-50 disabled:opacity-60"
                        >
                          Resend
                        </button>

                        <button
                          type="button"
                          onClick={handleVerifyOtp}
                          disabled={busy}
                          className="w-full rounded-lg bg-[#82008F] py-2.5 text-white text-sm font-semibold hover:bg-[#6f007a] transition disabled:opacity-60"
                        >
                          {busy ? "Verifying..." : "Verify"}
                        </button>
                      </div>
                    </>
                  )}

                  {/* Step 3: Register */}
                  {signupStep === "register" && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Full Name</label>
                        <input
                          type="text"
                          value={signupName}
                          onChange={(e) => setSignupName(e.target.value)}
                          placeholder="Enter your name"
                          className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#82008F]/30 focus:border-[#82008F]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                        <input
                          type="text"
                          value={signupPhone}
                          onChange={(e) => setSignupPhone(e.target.value)}
                          placeholder="Enter your number"
                          className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#82008F]/30 focus:border-[#82008F]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Password</label>
                        <input
                          type="password"
                          value={signupPassword}
                          onChange={(e) => setSignupPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#82008F]/30 focus:border-[#82008F]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Confirm Password</label>
                        <input
                          type="password"
                          value={signupConfirm}
                          onChange={(e) => setSignupConfirm(e.target.value)}
                          placeholder="••••••••"
                          className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#82008F]/30 focus:border-[#82008F]"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleRegister}
                        disabled={busy}
                        className="w-full rounded-lg bg-[#82008F] py-2.5 text-white text-sm font-semibold hover:bg-[#6f007a] transition disabled:opacity-60"
                      >
                        {busy ? "Creating..." : "Create Account"}
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Divider */}
              <div className="flex items-center my-6">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="px-3 text-xs text-gray-400">OR</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              {/* Toggle */}
              <div className="text-center text-sm text-gray-600">
                {mode === "login" ? (
                  <>
                    New to Mechkart?{" "}
                    <button onClick={openSignup} className="text-[#82008F] font-semibold hover:underline" type="button">
                      Create an account
                    </button>
                  </>
                ) : (
                  <>
                    Already have an account?{" "}
                    <button
                      onClick={() => {
                        setMode("login");
                        setSignupStep("sendOtp");
                        setAuthError("");
                      }}
                      className="text-[#82008F] font-semibold hover:underline"
                      type="button"
                    >
                      Login
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
