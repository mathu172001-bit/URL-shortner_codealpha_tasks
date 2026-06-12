/**
 * Shared Type Definitions for the AI URL Shortener & Analytics Platform
 */

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

export interface ShortUrl {
  id: string;
  originalUrl: string;
  shortCode: string;
  creatorId: string | null; // null for anonymous link creation
  createdAt: string;
  category: "Education" | "Social Media" | "Business" | "Personal" | "Other";
  expiresAt: string | null; // null if no expiry
  passwordHash: string | null; // hashed or simple string for password protection
  oneTime: boolean; // whether this link works only once
  isActive: boolean; // can become false if expired, one-time used, etc.
  
  // Stats
  visitCount: number;
  qrVisitCount: number;

  // AI-Generated Metadata
  pageTitle: string | null;
  pageSummary: string | null;
  safetyScore: number | null; // 0 to 100
  safetyVerdict: "safe" | "suspicious" | "malicious" | null;
  safetyDetails: string | null;
}

export interface Visit {
  id: string;
  urlId: string;
  timestamp: string;
  country: string;
  device: "Desktop" | "Mobile" | "Tablet";
  browser: string;
  isQr: boolean;
}

export interface DbState {
  users: User[];
  urls: ShortUrl[];
  visits: Visit[];
}

export interface AuthState {
  user: { id: string; email: string } | null;
  token: string | null;
}
