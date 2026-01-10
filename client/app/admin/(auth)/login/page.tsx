/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captcha, setCaptcha] = useState("");
  const [captchaInput, setCaptchaInput] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successLoader, setSuccessLoader] = useState(false);
  const [error, setError] = useState("");

  const CLIENT_URL = process.env.NEXT_PUBLIC_CLIENT_URL || "http://localhost:3000";

  useEffect(() => {
    generateCaptcha();
  }, []);

  const generateCaptcha = () => {
    const randomStr = Math.random().toString(36).substring(2, 7).toUpperCase();
    setCaptcha(randomStr);
  };

  const handleLogin = async (e: any) => {
    e.preventDefault();
    setError("");

  localStorage.removeItem("admin_token"); // ✅ clear stale token
    if (captchaInput !== captcha) {
      setError("Captcha does not match");
      generateCaptcha();
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Login failed");
        setLoading(false);
        return;
      }

      localStorage.setItem("admin_token", data.token);

      // **SUCCESS LOADER**
      setSuccessLoader(true);

      setTimeout(() => {
        window.location.href = `${CLIENT_URL}/admin/dashboard`;
      }, 1800);

    } catch (err) {
      setError("Server error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* SUCCESS OVERLAY LOADER */}
      {successLoader && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="animate-spin w-12 h-12 border-4 border-white border-t-transparent rounded-full"></div>
        </div>
      )}

      <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-slate-50 to-sky-100 p-4">
        <Card className="w-full max-w-sm shadow-xl border border-slate-200 bg-white">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="text-sky-600" size={26} />
              <CardTitle className="text-xl font-bold text-slate-800">
                Admin Login
              </CardTitle>
            </div>
            <CardDescription className="text-slate-500">
              Secure access panel
            </CardDescription>
          </CardHeader>

          <CardContent>
            {error && (
              <p className="text-red-500 text-sm mb-2">{error}</p>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              {/* Email */}
              <div className="flex flex-col gap-1">
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="border-slate-300 focus:ring-sky-300"
                />
              </div>

              {/* Password */}
              <div className="flex flex-col gap-1">
                <Label>Password</Label>
                <div className="relative">
                  <Input
                    type={showPass ? "text" : "password"}
                    placeholder="•••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="border-slate-300 focus:ring-sky-300 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-2 top-2 text-slate-500 hover:text-slate-700"
                  >
                    {showPass ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {/* Captcha */}
              <div className="flex flex-col gap-1">
                <Label>Captcha</Label>
                <div className="flex items-center justify-between border px-3 py-2 bg-slate-100 text-slate-700 font-semibold tracking-widest">
                  {captcha}
                  <button
                    type="button"
                    onClick={generateCaptcha}
                    className="text-sky-600 hover:text-sky-800 text-sm"
                  >
                    Refresh
                  </button>
                </div>
                <Input
                  type="text"
                  placeholder="Enter captcha"
                  value={captchaInput}
                  onChange={(e) =>
                    setCaptchaInput(e.target.value.toUpperCase())
                  }
                  required
                  className="border-slate-300 focus:ring-sky-300"
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-sky-600 hover:bg-sky-700"
                disabled={loading}
              >
                {loading ? "Checking..." : "Login"}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="text-center text-xs text-slate-400">
            Powered by{" "}
            <span className="text-sky-600 font-semibold ml-1">
              Mecharkrt
            </span>
          </CardFooter>
        </Card>
      </div>
    </>
  );
}
