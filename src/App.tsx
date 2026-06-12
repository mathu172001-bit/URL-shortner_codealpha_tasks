import React, { useState, useEffect } from "react";
import {
  Link2,
  Sparkles,
  Key,
  Calendar,
  Zap,
  Globe,
  Plus,
  HelpCircle,
  FolderDot,
  User,
  LogOut,
  Moon,
  Sun,
  ShieldCheck,
  Compass,
  Laptop,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  TrendingUp,
  ExternalLink,
} from "lucide-react";

import { ShortUrl, AuthState } from "./types";
import AuthModal from "./components/AuthModal";
import LinkCard from "./components/LinkCard";
import AnalyticsPanel from "./components/AnalyticsPanel";

export default function App() {
  // 1. Accessibility Themes
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem("theme");
    return saved ? saved === "dark" : true; // Default dark
  });

  useEffect(() => {
    localStorage.setItem("theme", isDark ? "dark" : "light");
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDark]);

  // 2. Authentication States
  const [auth, setAuth] = useState<AuthState>(() => {
    const savedToken = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");
    if (savedToken && savedUser) {
      return { token: savedToken, user: JSON.parse(savedUser) };
    }
    return { token: null, user: null };
  });

  const handleAuthSuccess = (token: string, user: { id: string; email: string }) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
    setAuth({ token, user });
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setAuth({ token: null, user: null });
    setSelectedUrlId(null);
  };

  const [isAuthOpen, setIsAuthOpen] = useState(false);

  // 3. URLs States
  const [urls, setUrls] = useState<ShortUrl[]>([]);
  const [loadingUrls, setLoadingUrls] = useState(true);
  const [selectedUrlId, setSelectedUrlId] = useState<string | null>(null);

  // 4. Create Short link Form Data
  const [originalUrl, setOriginalUrl] = useState("");
  const [customAlias, setCustomAlias] = useState("");
  const [category, setCategory] = useState<ShortUrl["category"]>("Other");
  const [expiresAt, setExpiresAt] = useState("");
  const [password, setPassword] = useState("");
  const [oneTime, setOneTime] = useState(false);

  // Toggle submenus
  const [enableExpiry, setEnableExpiry] = useState(false);
  const [enablePassword, setEnablePassword] = useState(false);

  // Form State feedback
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // AI Recomendation suggestion states
  const [isAiSuggesting, setIsAiSuggesting] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);

  // Navigation / Dashboard filters
  const [activeFilter, setActiveFilter] = useState<string>("All");

  // Database Connection Engine checks
  const [dbStatus, setDbStatus] = useState<{
    isConfigured: boolean;
    isActive: boolean;
    error: string | null;
    sqlSchema: string;
  } | null>(null);
  const [isDbStatusOpen, setIsDbStatusOpen] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  const fetchDbStatus = async () => {
    try {
      const res = await fetch("/api/db-status");
      if (res.ok) {
        const data = await res.json();
        setDbStatus(data);
      }
    } catch (e) {
      console.error("Failed to fetch database status from server", e);
    }
  };

  useEffect(() => {
    fetchDbStatus();
  }, []);

  const handleCopySql = () => {
    if (!dbStatus?.sqlSchema) return;
    navigator.clipboard.writeText(dbStatus.sqlSchema);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  // Fetch URLs created in sandbox
  const fetchUrls = async () => {
    setLoadingUrls(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (auth.token) {
        headers["Authorization"] = `Bearer ${auth.token}`;
      }
      const response = await fetch("/api/urls", { headers });
      if (response.ok) {
        const data = await response.json();
        setUrls(data.urls || []);
      }
    } catch (e) {
      console.error("Failed to load short URLs list", e);
    } finally {
      setLoadingUrls(false);
    }
  };

  useEffect(() => {
    fetchUrls();
  }, [auth.token]);

  // Request smart recommendations from Gemini model
  const handleAiSuggest = async () => {
    if (!originalUrl) {
      setFormError("Please provide a destination URL first so the AI can analyze brand tags.");
      return;
    }
    // Simple verification
    try {
      new URL(originalUrl);
    } catch {
      setFormError("Destination URL has incorrect format. Make sure it starts with https://");
      return;
    }

    setFormError(null);
    setIsAiSuggesting(true);
    setAiSuggestions([]);

    try {
      const response = await fetch("/api/urls/recommend-aliases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ originalUrl }),
      });
      if (!response.ok) throw new Error();
      const data = await response.json();
      setAiSuggestions(data.suggestions || []);
    } catch (e) {
      setFormError("AI suggestion services were interrupted, please retry.");
    } finally {
      setIsAiSuggesting(false);
    }
  };

  // Submit Short Url Creation
  const handleShortenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!originalUrl) {
      setFormError("Destination URL target is required");
      return;
    }

    try {
      new URL(originalUrl);
    } catch {
      setFormError("Incorrect URL target formatting. Please prepend http:// or https:// to your target.");
      return;
    }

    setIsSubmitting(true);

    const payload = {
      originalUrl,
      customAlias: customAlias ? customAlias.trim() : undefined,
      category,
      expiresAt: enableExpiry && expiresAt ? expiresAt : undefined,
      password: enablePassword && password ? password : undefined,
      oneTime,
    };

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (auth.token) {
        headers["Authorization"] = `Bearer ${auth.token}`;
      }

      const response = await fetch("/api/urls", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Creation process ceased due to verification conflict.");
      }

      setFormSuccess(`URL shortened successfully! Code: /${data.url.shortCode}`);
      
      // Cleanup inputs
      setOriginalUrl("");
      setCustomAlias("");
      setCategory("Other");
      setExpiresAt("");
      setPassword("");
      setOneTime(false);
      setEnableExpiry(false);
      setEnablePassword(false);
      setAiSuggestions([]);

      // Reload lists
      fetchUrls();
    } catch (error: any) {
      setFormError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Url code
  const handleDeleteUrl = async (id: string) => {
    try {
      const headers: Record<string, string> = {};
      if (auth.token) {
        headers["Authorization"] = `Bearer ${auth.token}`;
      }

      const response = await fetch(`/api/urls/${id}`, {
        method: "DELETE",
        headers,
      });

      if (!response.ok) {
        const d = await response.json();
        throw new Error(d.error || "Delete action rejected.");
      }

      if (selectedUrlId === id) {
        setSelectedUrlId(null);
      }

      fetchUrls();
    } catch (e: any) {
      alert(e.message);
    }
  };

  // Filter existing URLs by tab categories
  const filteredUrls = urls.filter((u) => {
    if (activeFilter === "All") return true;
    return u.category === activeFilter;
  });

  const getCategoryCount = (catName: string) => {
    if (catName === "All") return urls.length;
    return urls.filter((u) => u.category === catName).length;
  };

  // Bento Grid live metric calculations
  const totalClicks = urls.reduce((sum, u) => sum + (u.visitCount || 0), 0);
  const activeLinks = urls.length;
  const avgSafetyScore = urls.length > 0 
    ? Math.round(urls.reduce((sum, u) => sum + (u.safetyScore || 99), 0) / urls.length) 
    : 98;
  const threatFlags = urls.filter(u => u.safetyVerdict === "malicious" || u.safetyVerdict === "suspicious").length;

  return (
    <div className={`min-h-screen font-sans transition-colors duration-250 ${isDark ? "bg-slate-950 text-slate-100 dark" : "bg-slate-50 text-slate-900"}`}>
      
      {/* 1. MASTER VIEWPORT LAYER */}
      <div className="max-w-6xl mx-auto px-4 py-6 md:py-10 space-y-8">
        
        {/* Navigation & Session Management Toolbar */}
        <header className="flex flex-col md:flex-row justify-between items-center gap-4 pb-6 border-b border-dashed border-slate-800/10 dark:border-slate-800">
          
          {/* Logo segment with Bento dynamic status info pill */}
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-600/30">
                <Link2 className="w-5.5 h-5.5" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">URL Gateway <span className="text-indigo-600 font-normal">AI</span></h1>
                <p className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-widest leading-none">
                  Smart Redirection & Visitor Tracing
                </p>
              </div>
            </div>


          </div>

          {/* Settings & User actions */}
          <div className="flex items-center gap-2.5">
            {/* Theme switches */}
            <button
              onClick={() => setIsDark(!isDark)}
              className={`p-2.5 rounded-xl border transition-colors ${
                isDark ? "bg-slate-900 border-slate-800 hover:bg-slate-850 text-amber-400" : "bg-white border-slate-200 hover:bg-slate-100 text-slate-600 shadow-sm"
              }`}
              title="Toggle Accessibility Modes"
              id="theme-switcher-btn"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* User Session Controller */}
            {auth.user ? (
              <div className="flex items-center gap-2.5">
                <div className={`hidden md:block px-3.5 py-1.5 rounded-xl text-xs font-semibold ${isDark ? "bg-indigo-950/40 text-indigo-300 border border-indigo-900/20" : "bg-indigo-50 text-indigo-700"}`}>
                  <span className="opacity-60 mr-1.5 font-normal">Active User:</span>
                  {auth.user.email}
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold text-red-400 hover:text-red-300 bg-red-500/5 hover:bg-red-500/10 rounded-xl transition border border-red-500/10"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsAuthOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition shadow-md hover:scale-[1.02] transform"
              >
                <User className="w-3.5 h-3.5" />
                Sign In / Register
              </button>
            )}
          </div>
        </header>



        {/* BENTO QUICK STATS GRID */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className={`rounded-3xl border p-5 flex items-center gap-4 transition-all hover:shadow-md ${
            isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200 shadow-sm"
          }`}>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold ${
              isDark ? "bg-emerald-500/10 text-emerald-400 font-mono" : "bg-emerald-50 text-emerald-600"
            }`}>
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className={`text-xl md:text-2xl font-black font-mono tracking-tight leading-none ${isDark ? "text-white" : "text-slate-900"}`}>{totalClicks.toLocaleString()}</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mt-1.5 leading-none">Total Clicks</div>
            </div>
          </div>

          <div className={`rounded-3xl border p-5 flex items-center gap-4 transition-all hover:shadow-md ${
            isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200 shadow-sm"
          }`}>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
              isDark ? "bg-amber-500/10 text-amber-400" : "bg-amber-50 text-amber-600"
            }`}>
              <Link2 className="w-5 h-5" />
            </div>
            <div>
              <div className={`text-xl md:text-2xl font-black font-mono tracking-tight leading-none ${isDark ? "text-white" : "text-slate-900"}`}>{activeLinks}</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mt-1.5 leading-none">Active Links</div>
            </div>
          </div>

          <div className={`rounded-3xl border p-5 flex items-center gap-4 transition-all hover:shadow-md ${
            isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200 shadow-sm"
          }`}>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
              isDark ? "bg-sky-500/10 text-sky-400" : "bg-sky-50 text-sky-600"
            }`}>
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <div className={`text-xl md:text-2xl font-black font-mono tracking-tight leading-none ${isDark ? "text-white" : "text-slate-900"}`}>{avgSafetyScore}%</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mt-1.5 leading-none">AI Safety Scan</div>
            </div>
          </div>

          <div className={`rounded-3xl border p-5 flex items-center gap-4 transition-all hover:shadow-md ${
            isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200 shadow-sm"
          }`}>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
              isDark ? "bg-rose-500/10 text-rose-400" : "bg-rose-50 text-rose-600"
            }`}>
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <div className={`text-xl md:text-2xl font-black font-mono tracking-tight leading-none ${isDark ? "text-white" : "text-slate-900"}`}>{threatFlags}</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mt-1.5 leading-none">Safety Flags</div>
            </div>
          </div>
        </div>

        {/* 2. MAIN ENGINE GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT COLUMN: URL Creation Engine */}
          <section className="lg:col-span-5 space-y-6">
            <div className={`p-8 border rounded-3xl transition duration-300 hover:shadow-md ${isDark ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200 shadow-sm"}`}>
              <h2 className={`text-md font-bold uppercase tracking-widest flex items-center gap-2 mb-6 ${
                isDark ? "text-indigo-400" : "text-indigo-650"
              }`}>
                <Plus className="w-4 h-4" /> Create Custom Short Link
              </h2>

              <form onSubmit={handleShortenSubmit} className="space-y-5">
                {formError && (
                  <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-200 text-xs">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <span>{formError}</span>
                  </div>
                )}

                {formSuccess && (
                  <div className="flex items-start gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-200 text-xs">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{formSuccess}</span>
                  </div>
                )}

                {/* Target Destination Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block pb-0.5">
                    Destination long URL
                  </label>
                  <input
                    type="url"
                    required
                    value={originalUrl}
                    onChange={(e) => setOriginalUrl(e.target.value)}
                    placeholder="https://example.com/very-long-target-link"
                    className={`w-full px-4 py-2.5 rounded-xl border text-sm outline-none transition-colors ${
                      isDark ? "bg-slate-800/60 border-slate-800 focus:border-slate-700" : "bg-slate-50 border-slate-200 focus:border-slate-300"
                    }`}
                  />
                </div>

                {/* Custom Alias & AI Recommendations */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center pb-0.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Custom Alias (Optional)
                    </label>
                    <button
                      type="button"
                      onClick={handleAiSuggest}
                      disabled={isAiSuggesting}
                      className="text-xs font-semibold text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 flex items-center gap-1.5 transition disabled:opacity-55"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {isAiSuggesting ? "Analyzing..." : "AI Suggestions"}
                    </button>
                  </div>

                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-500">
                      /
                    </span>
                    <input
                      type="text"
                      value={customAlias}
                      onChange={(e) => setCustomAlias(e.target.value)}
                      placeholder="e.g. business-doc"
                      className={`w-full pl-6 pr-4 py-2.5 rounded-xl border text-sm outline-none transition-colors ${
                        isDark ? "bg-slate-800/60 border-slate-800 focus:border-slate-700" : "bg-slate-50 border-slate-200 focus:border-slate-300"
                      }`}
                    />
                  </div>

                  {/* AI Suggested Tags display */}
                  {aiSuggestions.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-widest animate-pulse">
                        Smart Custom Alias Recommendations:
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {aiSuggestions.map((suggestion) => (
                          <button
                            key={suggestion}
                            type="button"
                            onClick={() => setCustomAlias(suggestion)}
                            className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all hover:scale-[1.02] transform active:scale-95 ${
                              isDark
                                ? "bg-indigo-500/5 hover:bg-indigo-500/10 border-indigo-500/20 text-indigo-300"
                                : "bg-indigo-50 hover:bg-indigo-100 border-indigo-200 text-indigo-700 font-medium"
                            }`}
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Links categories folder selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block pb-0.5">
                    Category Tag
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ShortUrl["category"])}
                    className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-colors ${
                      isDark ? "bg-slate-800/60 border-slate-800 focus:border-slate-700 text-white" : "bg-slate-50 border-slate-200 focus:border-slate-300 text-slate-800"
                    }`}
                  >
                    <option value="Personal">Personal</option>
                    <option value="Business">Business</option>
                    <option value="Education">Education</option>
                    <option value="Social Media">Social Media</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* Additional advanced parameters trigger */}
                <div className="space-y-3.5 pt-2 border-t border-dashed border-slate-800/10 dark:border-slate-800">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Routing Restrictions & Security
                  </h3>

                  {/* Expiration date controller */}
                  <div className="space-y-2">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={enableExpiry}
                        onChange={(e) => setEnableExpiry(e.target.checked)}
                        className={`rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 bg-transparent ${isDark ? "border-slate-850" : "border-slate-300"}`}
                      />
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 select-none">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-300" />
                        Configure Expiry Date
                      </span>
                    </label>

                    {enableExpiry && (
                      <input
                        type="datetime-local"
                        required={enableExpiry}
                        value={expiresAt}
                        onChange={(e) => setExpiresAt(e.target.value)}
                        className={`w-full px-4 py-2 rounded-xl border text-xs outline-none transition-colors font-mono ${
                          isDark ? "bg-slate-800/60 border-slate-800 text-white" : "bg-slate-50 border-slate-200 text-slate-800"
                        }`}
                      />
                    )}
                  </div>

                  {/* Password Protection locked gate */}
                  <div className="space-y-2">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={enablePassword}
                        onChange={(e) => setEnablePassword(e.target.checked)}
                        className={`rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 bg-transparent ${isDark ? "border-slate-850" : "border-slate-300"}`}
                      />
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 select-none">
                        <Key className="w-3.5 h-3.5 text-slate-400 dark:text-slate-300" />
                        Credentials Verification Lock
                      </span>
                    </label>

                    {enablePassword && (
                      <input
                        type="text"
                        required={enablePassword}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter direct access password"
                        className={`w-full px-4 py-2.5 rounded-xl border text-xs outline-none transition-colors ${
                          isDark ? "bg-slate-800/60 border-slate-800 text-white" : "bg-slate-50 border-slate-200 text-slate-800"
                        }`}
                      />
                    )}
                  </div>

                  {/* One-Time link constraints */}
                  <div>
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={oneTime}
                        onChange={(e) => setOneTime(e.target.checked)}
                        className={`rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 bg-transparent ${isDark ? "border-slate-850" : "border-slate-300"}`}
                      />
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 select-none">
                        <Zap className="w-3.5 h-3.5 text-slate-400 dark:text-slate-300" />
                        One-Time redirect lock
                      </span>
                    </label>
                    <p className={`text-[10px] ml-6.5 mt-0.5 leading-normal ${isDark ? "text-slate-550" : "text-slate-500"}`}>
                      URL expires instantly once visited. Successive scans will return a locked state.
                    </p>
                  </div>
                </div>

                {/* Submitting button trigger */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full mt-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition shadow-lg shadow-indigo-600/30 text-sm flex items-center justify-center gap-2.5 hover:scale-[1.01] active:scale-98 transform"
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-4.5 h-4.5 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                      <span>Scanning Safety & Summarizing webpage...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Shorten Target URL</span>
                    </>
                  )}
                </button>
              </form>
            </div>
            

          </section>

          {/* RIGHT COLUMN: Active URL Queue & Telemetry Charts Dashboard */}
          <section className="lg:col-span-7 space-y-6">
            
            {/* Dashboard category filters tabs */}
            <div className="flex flex-wrap items-center gap-1.5 border-b border-dashed border-slate-800/15 dark:border-slate-800 pb-4">
              {["All", "Personal", "Business", "Education", "Social Media", "Other"].map((tab) => {
                const count = getCategoryCount(tab);
                const isCurrent = tab === activeFilter;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveFilter(tab)}
                    className={`flex items-center gap-1.5 text-xs px-3.5 py-2.5 rounded-xl font-bold transition-all border ${
                      isCurrent
                        ? "bg-indigo-600 border-indigo-500 text-white"
                        : isDark
                        ? "bg-slate-900 border-slate-800/80 text-slate-300 hover:bg-slate-800"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <span>{tab}</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                      isCurrent
                        ? "bg-white/20 text-white"
                        : isDark
                        ? "bg-slate-800/25 text-slate-400"
                        : "bg-slate-200/60 text-slate-600"
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Main listing of URLs */}
            {loadingUrls ? (
              <div className="py-20 text-center space-y-4">
                <span className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin inline-block"></span>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Syncing dashboard records...</p>
              </div>
            ) : filteredUrls.length === 0 ? (
              <div className={`py-16 text-center rounded-2xl border border-dashed ${
                isDark ? "bg-slate-900/10 border-slate-800" : "bg-slate-100/10 border-slate-200"
              }`}>
                <div className={`p-3 mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
                  isDark ? "bg-slate-850 text-slate-500" : "bg-slate-100 text-slate-555"
                }`}>
                  <Link2 className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-600 dark:text-slate-400">No shortened links currently verified</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
                  {activeFilter === "All"
                    ? "Input a destination target above and explore analytics with smart AI safety reporting."
                    : `No registered destination links matching Category folder "${activeFilter}" yet.`}
                </p>
              </div>
            ) : (
              <div className="space-y-4.5">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Displaying {filteredUrls.length} shortened links</span>
                  <span className="font-mono text-[10px]">Active Server Gateway: Standard Port 3000</span>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {filteredUrls.slice().reverse().map((url) => (
                    <LinkCard
                      key={url.id}
                      url={url}
                      onDeleteUrl={handleDeleteUrl}
                      onSelectAnalytics={(id) => setSelectedUrlId(id)}
                      isDark={isDark}
                    />
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* 3. MODAL / DRAWER SYSTEM LAYERS */}
      
      {/* Real-time analytical statistics drawer */}
      {selectedUrlId && (
        <>
          {/* Overlay mask */}
          <div
            onClick={() => setSelectedUrlId(null)}
            className="fixed inset-0 z-30 bg-slate-950/70 backdrop-blur-sm cursor-pointer"
          />
          <AnalyticsPanel
            urlId={selectedUrlId}
            onClose={() => setSelectedUrlId(null)}
            isDark={isDark}
          />
        </>
      )}

      {/* Login authorization popups */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={handleAuthSuccess}
        isDark={isDark}
      />

      {/* Database Control Center / SQL Setup Modal */}
      {isDbStatusOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            onClick={() => setIsDbStatusOpen(false)}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm cursor-pointer"
          />
          <div className={`relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl border p-6 md:p-8 flex flex-col space-y-6 shadow-2xl transition duration-300 ${
            isDark ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-900"
          }`}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-bold tracking-tight">Database Control Center</h3>
                <p className={`text-xs mt-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>Configure secure live database clustering with Supabase.</p>
              </div>
              <button
                onClick={() => setIsDbStatusOpen(false)}
                className={`p-1.5 px-3 rounded-xl border text-xs font-bold transition cursor-pointer ${
                  isDark ? "hover:bg-slate-800 border-slate-800 text-slate-300" : "hover:bg-slate-100 border-slate-200 text-slate-600"
                }`}
              >
                Close
              </button>
            </div>

            {/* Connection Telemetry Panel */}
            <div className={`p-5 rounded-2xl border flex items-start gap-4 ${
              dbStatus?.isActive
                ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                : dbStatus?.isConfigured
                  ? "bg-amber-500/5 border-amber-500/20 text-text-amber-600 dark:text-amber-400"
                  : isDark ? "bg-slate-950/40 border-slate-800/80 text-sky-400" : "bg-sky-50/20 border-slate-200 text-indigo-700 shadow-inner"
            }`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                dbStatus?.isActive
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : dbStatus?.isConfigured
                    ? "bg-amber-500/10 text-amber-650 dark:text-amber-400"
                    : "bg-indigo-605/10 text-indigo-600"
              }`}>
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold">
                    {dbStatus?.isActive 
                      ? "Supabase Connection: Active & Secured" 
                      : dbStatus?.isConfigured 
                        ? "Supabase Configured (Tables Missing)" 
                        : "Sandbox Mode: Local Cache db.json"
                    }
                  </span>
                  <span className={`w-2 h-2 rounded-full ${
                    dbStatus?.isActive ? "bg-emerald-500 animate-pulse" : dbStatus?.isConfigured ? "bg-amber-500" : "bg-slate-400"
                  }`} />
                </div>
                <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-600"} leading-relaxed`}>
                  {dbStatus?.isActive
                    ? "Status normal. All URL registers, expiration rules, user authentications, and clickstream metrics are synced live with your remote database cluster."
                    : dbStatus?.isConfigured
                      ? `Your connection tokens align, but the tables do not respond. Database Error: ${dbStatus.error || "Check table schema"}`
                      : "The server is securely persisting data inside database engine cache (db.json). To attach a scalable Supabase database, copy the setup variables below."
                  }
                </p>
              </div>
            </div>

            {/* Instruction Wizard */}
            <div className="space-y-3.5">
              <h4 className="text-xs uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">Setup Integration Instructions</h4>
              <ol className={`text-xs space-y-2 leading-relaxed ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                <li className="flex gap-2.5">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-mono text-[10px] shrink-0 font-bold">1</span>
                  <span>Open your <b>Supabase Dashboard</b> and create a new project.</span>
                </li>
                <li className="flex gap-2.5">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-mono text-[10px] shrink-0 font-bold">2</span>
                  <span>Navigate to <b>Settings &rarr; API</b> and retrieve your API Keys.</span>
                </li>
                <li className="flex gap-2.5">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-mono text-[10px] shrink-0 font-bold">3</span>
                  <span>Attach <b>SUPABASE_URL</b> and <b>SUPABASE_ANON_KEY</b> inside the Secrets panel of AI Studio.</span>
                </li>
                <li className="flex gap-2.5">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-mono text-[10px] shrink-0 font-bold">4</span>
                  <span>Click SQL Editor inside your Supabase dashboard and run the DDL schema script block below to launch table relations!</span>
                </li>
              </ol>
            </div>

            {/* Schema section */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Required SQL DDL Script Schema</span>
                <button
                  onClick={handleCopySql}
                  className={`px-3 py-1 text-[11px] font-bold rounded-lg border transition ${
                    copiedSql 
                      ? "text-emerald-700 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/5" 
                      : isDark ? "hover:bg-slate-800 border-slate-800 text-slate-300" : "hover:bg-slate-100 border-slate-200 text-slate-600 shadow-sm"
                  }`}
                >
                  {copiedSql ? "✓ SQL Copied!" : "Copy SQL Script"}
                </button>
              </div>
              <pre className={`text-[11px] rounded-xl font-mono p-4 overflow-x-auto border max-h-[180px] leading-relaxed shadow-inner ${
                isDark ? "bg-slate-950 border-slate-850 text-indigo-300" : "bg-slate-50 border-slate-200 text-indigo-800"
              }`}>
                {dbStatus?.sqlSchema}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
