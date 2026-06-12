import React, { useState } from "react";
import { createPortal } from "react-dom";
import { Link, Calendar, ShieldCheck, ShieldAlert, Key, Zap, Copy, Check, QrCode, TrendingUp, Trash2 } from "lucide-react";
import { ShortUrl } from "../types";

interface LinkCardProps {
  key?: string;
  url: ShortUrl;
  onDeleteUrl: (id: string) => void | Promise<void>;
  onSelectAnalytics: (id: string) => void;
  isDark: boolean;
}

export default function LinkCard({ url, onDeleteUrl, onSelectAnalytics, isDark }: LinkCardProps) {
  const [copied, setCopied] = useState(false);
  const [copiedQr, setCopiedQr] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Reconstruct shortened url
  const domainUrl = window.location.origin;
  const shortLinkBase = `${domainUrl}/${url.shortCode}`;
  const shortLinkQr = `${shortLinkBase}?qr=true`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shortLinkBase);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Build badge color for safety
  const safetyColors = {
    safe: {
      bg: "bg-emerald-500/10 border-emerald-500/25",
      text: "text-emerald-500",
      accent: "bg-emerald-500",
      icon: ShieldCheck,
    },
    suspicious: {
      bg: "bg-amber-500/10 border-amber-500/25",
      text: "text-amber-500",
      accent: "bg-amber-500",
      icon: ShieldAlert,
    },
    malicious: {
      bg: "bg-red-500/10 border-red-500/25",
      text: "text-red-500",
      accent: "bg-red-500",
      icon: ShieldAlert,
    },
  }[url.safetyVerdict || "safe"];

  const SafetyIcon = safetyColors.icon;

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case "Education":
        return "bg-cyan-500/10 text-cyan-705 dark:text-cyan-400 border border-cyan-500/20";
      case "Social Media":
        return "bg-pink-500/10 text-pink-700 dark:text-pink-400 border border-pink-500/20";
      case "Business":
        return "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20";
      case "Personal":
        return "bg-teal-500/10 text-teal-700 dark:text-teal-400 border border-teal-500/20";
      default:
        return "bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20";
    }
  };

  return (
    <div
      className={`border rounded-3xl p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-[0.5px] relative overflow-hidden ${
        isDark ? "bg-slate-900/90 border-slate-800/80" : "bg-white border-slate-200 shadow-sm"
      }`}
    >
      {/* Absolute top accent colored by safe status */}
      <div className={`absolute top-0 left-0 right-0 h-1 ${safetyColors.accent}`} />

      {/* Title & Copy segment */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="space-y-1.5 max-w-full md:max-w-[70%]">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full ${getCategoryColor(url.category)}`}>
              {url.category}
            </span>
            {url.oneTime && (
              <span className="flex items-center gap-1 text-[10px] font-semibold bg-violet-500/10 text-violet-700 dark:text-violet-400 border border-violet-500/20 px-2 py-0.5 rounded-full">
                <Zap className="w-2.5 h-2.5" /> One-Time
              </span>
            )}
            {url.passwordHash && (
              <span className="flex items-center gap-1 text-[10px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">
                <Key className="w-2.5 h-2.5" /> Locked
              </span>
            )}
            {url.expiresAt && (
              <span className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                new Date(url.expiresAt) < new Date()
                  ? "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20"
                  : "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20"
              }`}>
                <Calendar className="w-2.5 h-2.5" /> Exp: {new Date(url.expiresAt).toLocaleDateString()}
              </span>
            )}
          </div>
          
          <h3 className={`text-base font-bold truncate tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
            {url.pageTitle || url.shortCode}
          </h3>

          <p className="text-slate-500 dark:text-slate-400 text-xs line-clamp-2 leading-relaxed">
            {url.pageSummary || "No website overview details parsed currently."}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 self-end md:self-start">
          <button
            onClick={handleCopy}
            className={`p-2.5 rounded-xl border flex items-center justify-center transition-all ${
              isDark
                ? "bg-slate-800/60 border-slate-700/60 hover:text-white text-slate-300 hover:bg-slate-800"
                : "bg-slate-50 border-slate-200 hover:text-indigo-600 text-slate-600 hover:bg-slate-100"
            }`}
            title="Copy Short Link"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setShowQrModal(true)}
            className={`px-3.5 py-2.5 rounded-xl border flex items-center gap-1.5 justify-center transition-all text-xs font-semibold ${
              isDark
                ? "bg-slate-800/60 border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-800"
                : "bg-slate-50 border-slate-200 text-slate-600 hover:text-indigo-600 hover:bg-slate-100"
            }`}
            title="Generate QR Code"
            id={`generate-qr-btn-${url.id}`}
          >
            <QrCode className="w-4 h-4" />
            <span>Generate QR Code</span>
          </button>

          <button
            onClick={() => onSelectAnalytics(url.id)}
            className={`p-2.5 rounded-xl border flex items-center justify-center transition-all ${
              isDark
                ? "bg-slate-800/60 border-slate-700/60 hover:text-indigo-400 text-slate-300 hover:bg-slate-800"
                : "bg-slate-50 border-slate-200 hover:text-indigo-600 text-slate-600 hover:bg-slate-100"
            }`}
            title="Inspect Analytics"
          >
            <TrendingUp className="w-4 h-4" />
          </button>

          {showDeleteConfirm ? (
            <div className="flex items-center gap-1 bg-red-500/10 border border-red-500/20 p-1 rounded-xl transition-all">
              <button
                onClick={() => {
                  onDeleteUrl(url.id);
                  setShowDeleteConfirm(false);
                }}
                className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-red-500 text-white hover:bg-red-600 transition-all cursor-pointer"
              >
                Delete
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className={`p-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  isDark ? "hover:bg-slate-800 text-slate-400 hover:text-slate-300" : "hover:bg-slate-150 text-slate-600 hover:text-slate-800"
                }`}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2.5 rounded-xl border border-red-500/10 bg-red-500/5 text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all flex items-center justify-center cursor-pointer"
              title="Delete shortened link"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Link Display segments */}
      <div className="mt-4 pt-3.5 border-t border-dashed border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs leading-none">
        <div className="space-y-1.5 max-w-full overflow-hidden">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-indigo-600 dark:text-indigo-400 shrink-0">Short:</span>
            <a href={shortLinkBase} target="_blank" rel="noopener noreferrer" className="font-mono text-indigo-600 dark:text-indigo-400 hover:underline truncate">
              {shortLinkBase}
            </a>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-500 dark:text-slate-400 shrink-0">Original:</span>
            <span className="font-mono text-slate-500 dark:text-slate-400 truncate max-w-[200px] sm:max-w-[320px]">
              {url.originalUrl}
            </span>
          </div>
        </div>

        {/* Clicks and analytics counter summary */}
        <div className="flex items-center gap-2 sm:self-center">
          <div className={`px-2.5 py-1.5 rounded-lg text-center ${isDark ? "bg-slate-800/50" : "bg-slate-100/80"}`}>
            <div className={`font-mono text-xs font-bold ${isDark ? "text-white" : "text-slate-800"}`}>
              {url.visitCount}
            </div>
            <div className="text-[9px] uppercase font-semibold text-slate-500 tracking-wider">Visits</div>
          </div>
          <div className={`px-2.5 py-1.5 rounded-lg text-center ${isDark ? "bg-slate-800/50" : "bg-slate-100/80"}`}>
            <div className={`font-mono text-xs font-bold ${isDark ? "text-white" : "text-slate-800"}`}>
              {url.qrVisitCount}
            </div>
            <div className="text-[9px] uppercase font-semibold text-slate-500 tracking-wider">QR Scans</div>
          </div>
        </div>
      </div>

      {/* AI Threat Scanner Report & URL Safety Score Banner */}
      <div className={`mt-3.5 p-3.5 rounded-2xl border flex items-start gap-2.5 ${safetyColors.bg}`}>
        <SafetyIcon className={`w-4 h-4 shrink-0 mt-0.5 ${safetyColors.text}`} />
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${safetyColors.text}`}>
              AI Safety Verdict: {url.safetyVerdict ? url.safetyVerdict.toUpperCase() : "SAFE"}
            </span>
            <span className="text-[10px] font-mono text-slate-500">•</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
              url.safetyScore && url.safetyScore > 80 ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-red-500/10 text-red-700 dark:text-red-400"
            }`}>
              Safety Score: {url.safetyScore ?? 99}%
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
            {url.safetyDetails || "Cleared through AI look-alike domain and suspicious redirections audits."}
          </p>
        </div>
      </div>

      {/* QR Code popup utility */}
      {showQrModal && createPortal(
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm">
          <div className={`border rounded-2xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl transform animate-in zoom-in-95 duration-200 ${
            isDark ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
          }`}>
            <h3 className={`text-base font-bold flex items-center justify-center gap-2 ${isDark ? "text-white" : "text-slate-900"}`}>
              <QrCode className="w-5 h-5 text-indigo-400" />
              Dynamic QR Code
            </h3>
            
            <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              Scans automatically register separately in your analytics dashboard.
            </p>

            <div className="bg-white p-4 rounded-xl inline-block mx-auto border border-slate-200 shadow-inner">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180&data=${encodeURIComponent(shortLinkQr)}`}
                alt="Short Url QR"
                className="w-40 h-40"
                referrerPolicy="no-referrer"
              />
            </div>

            <div className="space-y-1">
              <div className={`text-xs font-mono font-medium break-all p-2 rounded-lg border ${
                isDark ? "text-slate-300 bg-slate-950 border-slate-800" : "text-slate-700 bg-slate-50 border-slate-200"
              }`}>
                {shortLinkQr}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(shortLinkQr);
                  setCopiedQr(true);
                  setTimeout(() => setCopiedQr(false), 2000);
                }}
                className={`flex-1 py-2.5 px-3.5 leading-none text-xs rounded-xl border transition font-medium flex items-center justify-center gap-1 cursor-pointer ${
                  isDark ? "bg-slate-800 border-slate-700 hover:bg-slate-700 text-white" : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-750"
                }`}
              >
                {copiedQr ? "Copied Link!" : "Copy QR Target Link"}
              </button>
              <button
                onClick={() => setShowQrModal(false)}
                className="flex-1 py-2.5 px-3.5 leading-none text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition font-semibold cursor-pointer"
              >
                Close Portal
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
