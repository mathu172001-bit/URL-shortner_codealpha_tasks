import React, { useState } from "react";
import { Lock, Mail, CheckCircle, AlertCircle, X, ShieldAlert } from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (token: string, user: { id: string; email: string }) => void;
  isDark: boolean;
}

export default function AuthModal({ isOpen, onClose, onSuccess, isDark }: AuthModalProps) {
  if (!isOpen) return null;

  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    const endpoint = isRegister ? "/api/auth/register" : "/api/auth/login";

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Something went wrong. Please check your credentials.");
      }

      setSuccess(isRegister ? "Registration successful! Loading your dashboard..." : "Login successful!");
      
      // Delay to let success transition finish
      setTimeout(() => {
        onSuccess(data.token, data.user);
        onClose();
        setIsLoading(false);
      }, 900);
    } catch (err: any) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className={`w-full max-w-md border rounded-2xl shadow-2xl overflow-hidden transform transition-all ${
        isDark ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
      }`}>
        <div className={`px-6 py-4 border-b flex justify-between items-center ${
          isDark ? "border-slate-800 bg-slate-900/50 text-white" : "border-slate-200 bg-slate-50 text-slate-900"
        }`}>
          <h2 className={`text-lg font-bold flex items-center gap-2 ${isDark ? "text-white" : "text-slate-900"}`}>
            <Lock className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
            {isRegister ? "Create Account" : "Welcome Back"}
          </h2>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${
              isDark ? "text-slate-400 hover:text-white hover:bg-slate-800" : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-700 dark:text-red-200 text-xs">
              <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-start gap-2.5 p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-700 dark:text-emerald-200 text-xs animate-pulse">
              <CheckCircle className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className={`text-xs font-semibold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}>Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="developer@aistudio.com"
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-indigo-500/40 focus:outline-none text-sm ${
                  isDark 
                    ? "bg-slate-800/80 border-slate-800 focus:border-slate-700 text-white" 
                    : "bg-slate-50 border-slate-200 focus:border-indigo-300 text-slate-905"
                }`}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={`text-xs font-semibold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}>Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-indigo-500/40 focus:outline-none text-sm ${
                  isDark 
                    ? "bg-slate-800/80 border-slate-800 focus:border-slate-700 text-white" 
                    : "bg-slate-50 border-slate-200 focus:border-indigo-300 text-slate-905"
                }`}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 mt-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:text-slate-405 font-semibold rounded-xl text-white outline-none transform active:scale-98 transition duration-150 flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 text-sm cursor-pointer"
          >
            {isLoading ? (
              <span className="w-4.5 h-4.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : isRegister ? (
              "Sign Up"
            ) : (
              "Sign In"
            )}
          </button>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => {
                setIsRegister(!isRegister);
                setError(null);
                setSuccess(null);
              }}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 font-medium hover:underline transition-colors cursor-pointer"
            >
              {isRegister ? "Already matching? Sign in here" : "Don't have an account? Register free here"}
            </button>
          </div>
        </form>

        <div className={`px-6 py-4 border-t flex items-center gap-2.5 text-[11px] ${
          isDark ? "bg-slate-950/30 border-slate-800/60 text-slate-400" : "bg-slate-50 border-slate-200 text-slate-500"
        }`}>
          <ShieldAlert className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          <span>Hashing is done using server-salted SHA256 structures.</span>
        </div>
      </div>
    </div>
  );
}
