import React, { useState, useEffect } from "react";
import { X, TrendingUp, HelpCircle, Activity, Globe, Monitor, ShieldAlert, Cpu, Calendar, Compass } from "lucide-react";
import { ShortUrl, Visit } from "../types";

interface AnalyticsPanelProps {
  urlId: string | null;
  onClose: () => void;
  isDark: boolean;
}

export default function AnalyticsPanel({ urlId, onClose, isDark }: AnalyticsPanelProps) {
  if (!urlId) return null;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [urlObj, setUrlObj] = useState<ShortUrl | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);

  useEffect(() => {
    async function fetchAnalytics() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/urls/${urlId}/analytics`);
        if (!response.ok) {
          throw new Error("Failed to load analytics details.");
        }
        const data = await response.json();
        setUrlObj(data.url);
        setVisits(data.visits || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchAnalytics();
  }, [urlId]);

  // Aggregate stats
  const totalClicks = visits.length;
  const qrClicks = visits.filter((v) => v.isQr).length;
  const directClicks = totalClicks - qrClicks;

  // 1. Device Breakdowns
  const deviceCounts = visits.reduce((acc, visit) => {
    acc[visit.device] = (acc[visit.device] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const devices = (["Desktop", "Mobile", "Tablet"] as const).map((dev) => ({
    name: dev,
    count: deviceCounts[dev] || 0,
    pct: totalClicks > 0 ? Math.round(((deviceCounts[dev] || 0) / totalClicks) * 100) : 0,
  }));

  // 2. Country Breakdowns
  const countryCounts = visits.reduce((acc, visit) => {
    acc[visit.country] = (acc[visit.country] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const countries = Object.entries(countryCounts)
    .map(([code, count]) => {
      const numCount = Number(count);
      return {
        code,
        count: numCount,
        pct: totalClicks > 0 ? Math.round((numCount / totalClicks) * 100) : 0,
      };
    })
    .sort((a, b) => b.count - a.count);

  // 3. Browser Aggregation
  const browserCounts = visits.reduce((acc, visit) => {
    acc[visit.browser] = (acc[visit.browser] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const browsers = Object.entries(browserCounts)
    .map(([name, count]) => {
      const numCount = Number(count);
      return {
        name,
        count: numCount,
        pct: totalClicks > 0 ? Math.round((numCount / totalClicks) * 100) : 0,
      };
    })
    .sort((a, b) => b.count - a.count);

  return (
    <div className={`fixed inset-y-0 right-0 z-40 w-full max-w-xl shadow-2xl flex flex-col transform animate-in slide-in-from-right duration-300 ${
      isDark ? "bg-slate-900 border-l border-slate-800 text-white" : "bg-white border-l border-slate-200 text-slate-900"
    }`}>
      {/* Drawer Header */}
      <div className={`px-6 py-5 border-b flex justify-between items-center ${
        isDark ? "border-slate-800 bg-slate-950/45" : "border-slate-200 bg-slate-50"
      }`}>
        <div>
          <h2 className={`text-lg font-bold flex items-center gap-2 ${isDark ? "text-white" : "text-slate-900"}`}>
            <TrendingUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Link Click-Analytics
          </h2>
          {urlObj && (
            <p className={`text-xs font-mono mt-1 break-all ${isDark ? "text-indigo-300/80" : "text-indigo-600"}`}>
              {window.location.origin}/{urlObj.shortCode}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className={`p-2 rounded-xl transition ${
            isDark ? "text-slate-400 hover:text-white hover:bg-slate-800" : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col justify-center items-center gap-3">
          <span className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-550 dark:border-t-indigo-400 rounded-full animate-spin"></span>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium tracking-wider">Compiling visitor logs...</p>
        </div>
      ) : error || !urlObj ? (
        <div className="flex-1 p-6 flex flex-col justify-center items-center text-center space-y-4">
          <ShieldAlert className="w-12 h-12 text-red-500 dark:text-red-400" />
          <h3 className={`text-base font-bold ${isDark ? "text-white" : "text-slate-900"}`}>Failed to retrieve telemetry data</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed">{error || "Record could not be resolved."}</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Main Counter Hub */}
          <div className="grid grid-cols-3 gap-3">
            <div className={`p-4 rounded-2xl text-center space-y-1 border ${
              isDark ? "bg-slate-950/60 border-slate-800/80" : "bg-slate-50 border-slate-200"
            }`}>
              <div className={`text-xl font-bold font-mono ${isDark ? "text-white" : "text-slate-900"}`}>{totalClicks}</div>
              <div className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 tracking-wider">Total Hits</div>
            </div>
            <div className={`p-4 rounded-2xl text-center space-y-1 border ${
              isDark ? "bg-slate-950/60 border-slate-800/80" : "bg-slate-50 border-slate-200"
            }`}>
              <div className={`text-xl font-bold font-mono ${isDark ? "text-indigo-400" : "text-indigo-600"}`}>{directClicks}</div>
              <div className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 tracking-wider">Direct</div>
            </div>
            <div className={`p-4 rounded-2xl text-center space-y-1 border ${
              isDark ? "bg-slate-950/60 border-slate-800/80" : "bg-slate-50 border-slate-200"
            }`}>
              <div className={`text-xl font-bold font-mono ${isDark ? "text-pink-400" : "text-pink-600"}`}>{qrClicks}</div>
              <div className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 tracking-wider">QR Scans</div>
            </div>
          </div>

          {/* AI Page Summarizer Overview in Header */}
          <div className={`p-4 rounded-2xl space-y-2 border ${
            isDark ? "bg-indigo-500/5 border-indigo-500/10" : "bg-indigo-50/40 border-indigo-100"
          }`}>
            <h4 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" /> Destination Analytics Profile
            </h4>
            <div className={`text-xs leading-relaxed ${isDark ? "text-slate-300" : "text-slate-800"}`}>
              <span className={`font-semibold ${isDark ? "text-white" : "text-slate-950"}`}>Target Name:</span> {urlObj.pageTitle || "N/A"}
            </div>
            <div className={`text-xs leading-relaxed ${isDark ? "text-slate-400" : "text-slate-600"}`}>
              <span className={`font-semibold ${isDark ? "text-slate-300" : "text-slate-850"}`}>Target Summary:</span> {urlObj.pageSummary || "No insights created yet."}
            </div>
            <div className={`pt-1.5 flex items-center justify-between border-t text-[10px] ${
              isDark ? "border-slate-800 text-slate-500" : "border-slate-200 text-slate-550"
            }`}>
              <span>Category: {urlObj.category}</span>
              <span>Status: {urlObj.isActive ? "Active" : "Archived / Filled"}</span>
            </div>
          </div>

          {/* Device Telemetry Breakdown  */}
          <div className={`space-y-3 p-4 rounded-2xl border ${
            isDark ? "bg-slate-950/30 border-slate-800/50" : "bg-slate-50 border-slate-200"
          }`}>
            <h4 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${isDark ? "text-white" : "text-slate-800"}`}>
              <Monitor className={`w-4 h-4 ${isDark ? "text-slate-400" : "text-slate-500"}`} />
              Device Classification
            </h4>
            <div className="space-y-2.5 pt-1">
              {devices.map((dev) => (
                <div key={dev.name} className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className={`flex items-center gap-2 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${dev.name === "Desktop" ? "bg-cyan-455 dark:bg-cyan-400" : dev.name === "Mobile" ? "bg-violet-500 dark:bg-violet-400" : "bg-pink-500 dark:bg-pink-400"}`}></span>
                      {dev.name}
                    </span>
                    <span className={`font-mono font-semibold ${isDark ? "text-slate-300" : "text-slate-800"}`}>{dev.count} ({dev.pct}%)</span>
                  </div>
                  {/* Styled Segment Meter */}
                  <div className={`h-2 w-full rounded-full overflow-hidden ${isDark ? "bg-slate-800" : "bg-slate-200"}`}>
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        dev.name === "Desktop" ? "bg-cyan-500" : dev.name === "Mobile" ? "bg-violet-500" : "bg-pink-500"
                      }`}
                      style={{ width: `${dev.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Geolocation distribution */}
          <div className={`space-y-3 p-4 rounded-2xl border ${
            isDark ? "bg-slate-950/30 border-slate-800/50" : "bg-slate-50 border-slate-200"
          }`}>
            <h4 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${isDark ? "text-white" : "text-slate-800"}`}>
              <Globe className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              Visitor Country Demographics
            </h4>
            {countries.length === 0 ? (
              <div className="text-xs text-slate-500 text-center py-4">No geo location logs compiled yet.</div>
            ) : (
              <div className="space-y-2 pt-1 max-h-[160px] overflow-y-auto pr-1">
                {countries.map((c) => (
                  <div key={c.code} className={`flex items-center justify-between text-xs py-1 px-1 rounded-lg transition-colors ${
                    isDark ? "hover:bg-slate-800/20" : "hover:bg-slate-100"
                  }`}>
                    <div className="flex items-center gap-2.5">
                      <span className={`w-6 h-4 inline-flex items-center justify-center border rounded-sm text-[10px] font-bold ${
                        isDark ? "bg-slate-800 border-slate-705 text-indigo-300" : "bg-slate-100 border-slate-200 text-indigo-750"
                      }`}>
                        {c.code}
                      </span>
                      <span className={`font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                        {c.code === "US" ? "United States" : c.code === "IN" ? "India" : c.code === "GB" ? "United Kingdom" : c.code === "DE" ? "Germany" : c.code === "FR" ? "France" : c.code === "JP" ? "Japan" : c.code === "CA" ? "Canada" : c.code === "AU" ? "Australia" : c.code === "SG" ? "Singapore" : c.code === "NL" ? "Netherlands" : "Global Target"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={`w-24 h-1.5 rounded-full overflow-hidden hidden sm:block ${isDark ? "bg-slate-800" : "bg-slate-200"}`}>
                        <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${c.pct}%` }} />
                      </div>
                      <span className={`font-mono font-bold ${isDark ? "text-white" : "text-slate-900"}`}>{c.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Browser analytics */}
          <div className={`space-y-3 p-4 rounded-2xl border ${
            isDark ? "bg-slate-950/30 border-slate-800/50" : "bg-slate-50 border-slate-200"
          }`}>
            <h4 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${isDark ? "text-white" : "text-slate-800"}`}>
              <Compass className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              Browser Analytics
            </h4>
            {browsers.length === 0 ? (
              <div className="text-xs text-slate-500 text-center py-2">Waiting for first user redirect.</div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                {browsers.map((b) => (
                  <div key={b.name} className={`flex flex-col justify-between p-3 border rounded-xl space-y-1 ${
                    isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
                  }`}>
                    <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">{b.name}</span>
                    <div className="flex items-baseline justify-between">
                      <span className={`text-lg font-bold font-mono ${isDark ? "text-white" : "text-slate-900"}`}>{b.count}</span>
                      <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 font-semibold">({b.pct}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Visit History Log list */}
          <div className="space-y-3">
            <h4 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${isDark ? "text-white" : "text-slate-800"}`}>
              <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Real-Time Hit Streams
            </h4>
            {visits.length === 0 ? (
              <div className={`text-xs text-slate-500 text-center py-8 rounded-2xl border ${
                isDark ? "bg-slate-950/20 border-slate-800/40" : "bg-slate-50 border-slate-200"
              }`}>
                Awaiting first visitor. Spread the URL to start tracking telemetry.
              </div>
            ) : (
              <div className={`border rounded-2xl overflow-hidden max-h-[220px] overflow-y-auto ${
                isDark ? "border-slate-800/80" : "border-slate-205"
              }`}>
                <table className="w-full text-left text-xs">
                  <thead className={`uppercase tracking-wider text-[9px] font-bold ${
                    isDark ? "bg-slate-950 text-slate-400" : "bg-slate-100 text-slate-600"
                  }`}>
                    <tr>
                      <th className="px-4 py-2.5">Timestamp</th>
                      <th className="px-4 py-2.5">Country</th>
                      <th className="px-4 py-2.5">Device</th>
                      <th className="px-4 py-2.5">Channel</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${
                    isDark ? "divide-slate-800 bg-slate-900/50" : "divide-slate-200 bg-white"
                  }`}>
                    {visits.slice(0, 50).reverse().map((v) => (
                      <tr key={v.id} className={`transition-colors ${
                        isDark ? "hover:bg-slate-800/40 text-slate-300" : "hover:bg-slate-50 text-slate-750"
                      }`}>
                        <td className="px-4 py-2 font-mono text-[10px]">
                          {new Date(v.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </td>
                        <td className="px-4 py-2 font-semibold">{v.country}</td>
                        <td className={`px-4 py-2 ${isDark ? "text-slate-400" : "text-slate-550"}`}>{v.device}</td>
                        <td className="px-4 py-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                            v.isQr 
                              ? "bg-pink-500/10 text-pink-700 dark:text-pink-400 border-pink-500/10" 
                              : "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/10"
                          }`}>
                            {v.isQr ? "QR-Scan" : "Direct Link"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
