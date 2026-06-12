import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { DbState, User, ShortUrl, Visit } from "./types.js";

const DB_FILE = path.join(process.cwd(), "db.json");

let state: DbState = {
  users: [],
  urls: [],
  visits: [],
};

// Initial synchronous load for local fallback
try {
  if (fs.existsSync(DB_FILE)) {
    const data = fs.readFileSync(DB_FILE, "utf-8");
    const parsed = JSON.parse(data);
    state = {
      users: parsed.users || [],
      urls: parsed.urls || [],
      visits: parsed.visits || [],
    };
  } else {
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), "utf-8");
  }
} catch (e) {
  console.error("Failed to initialize db.json:", e);
}

// Supabase lazy client setup
let supabaseClient: any = null;
let supabaseActive = false;
let supabaseError: string | null = null;

export function getSupabase() {
  if (supabaseClient) return supabaseClient;
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_ANON_KEY?.trim();
  
  if (url && key && url !== "" && key !== "" && /^https?:\/\//i.test(url)) {
    try {
      supabaseClient = createClient(url, key);
      console.log("Supabase Client initialized successfully.");
    } catch (e: any) {
      supabaseError = e?.message || String(e);
      console.log("Supabase connection bypass - client setup failed: " + (e?.message || e));
    }
  } else {
    if ((url && url !== "") || (key && key !== "")) {
      supabaseError = "Invalid configuration values. URL must start with http/https.";
    }
  }
  return supabaseClient;
}

// Atomic save helper (local fallback write)
export async function saveState(): Promise<void> {
  try {
    const tempPath = `${DB_FILE}.tmp`;
    await fs.promises.writeFile(tempPath, JSON.stringify(state, null, 2), "utf-8");
    await fs.promises.rename(tempPath, DB_FILE);
  } catch (error) {
    console.error("Failed to write to db.json securely:", error);
  }
}

export function getState(): DbState {
  return state;
}

// --- Supabase Async Startup Initialization ---
export async function initDatabase(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    console.log("Supabase environment configuration is unassigned. Mode: Local db.json persistence only.");
    return;
  }

  try {
    console.log("Verifying connection & active schema on Supabase database...");
    
    // Fetch users for validation
    const { data: usersData, error: usersError } = await supabase.from("linkflow_users").select("*");
    if (usersError) {
      if (usersError.code === "PGRST116" || usersError.message.toLowerCase().includes("does not exist")) {
        throw new Error("Tables linkflow_users, linkflow_urls, or linkflow_visits are not created yet on your Supabase instance.");
      }
      throw new Error(usersError.message);
    }

    // Fetch links
    const { data: urlsData, error: urlsError } = await supabase.from("linkflow_urls").select("*");
    if (urlsError) throw new Error(urlsError.message);

    // Fetch click logs
    const { data: visitsData, error: visitsError } = await supabase.from("linkflow_visits").select("*");
    if (visitsError) throw new Error(visitsError.message);

    // Connect fully if no schema exception was thrown
    state.users = (usersData || []) as User[];
    state.urls = (urlsData || []) as ShortUrl[];
    state.visits = (visitsData || []) as Visit[];
    
    // Save state cache locally
    await saveState();
    supabaseActive = true;
    console.log("Supabase Active Database Connection Succeeded. Data tables loaded.");
  } catch (err: any) {
    supabaseError = err.message || "Unknown database validation error";
    supabaseActive = false;
    console.error("Supabase Connection Bypassed. Initializing beautiful fallback local database context. Error:", supabaseError);
  }
}

// Helper getter for dashboard stats connection status information
export function getDbStatus() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_ANON_KEY?.trim();
  const isConfigured = !!(url && key && url !== "" && key !== "" && /^https?:\/\//i.test(url));
  return {
    isConfigured,
    isActive: supabaseActive,
    error: supabaseError,
    sqlSchema: `-- Execute this SQL script inside your Supabase project in the "SQL Editor" to configure tables:

-- 1. Setup secure Users database table
CREATE TABLE IF NOT EXISTS linkflow_users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Setup Short links registry table
CREATE TABLE IF NOT EXISTS linkflow_urls (
  id TEXT PRIMARY KEY,
  "originalUrl" TEXT NOT NULL,
  "shortCode" TEXT UNIQUE NOT NULL,
  "creatorId" TEXT REFERENCES linkflow_users(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  category TEXT NOT NULL,
  "expiresAt" TIMESTAMP WITH TIME ZONE,
  "passwordHash" TEXT,
  "oneTime" BOOLEAN DEFAULT false NOT NULL,
  "isActive" BOOLEAN DEFAULT true NOT NULL,
  "visitCount" INT DEFAULT 0 NOT NULL,
  "qrVisitCount" INT DEFAULT 0 NOT NULL,
  "pageTitle" TEXT,
  "pageSummary" TEXT,
  "safetyScore" INT,
  "safetyVerdict" TEXT,
  "safetyDetails" TEXT
);

-- 3. Setup Visitor traces telemetry table
CREATE TABLE IF NOT EXISTS linkflow_visits (
  id TEXT PRIMARY KEY,
  "urlId" TEXT REFERENCES linkflow_urls(id) ON DELETE CASCADE NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  country TEXT,
  device TEXT,
  browser TEXT,
  "isQr" BOOLEAN DEFAULT false NOT NULL
);`
  };
}

// --- Unified direct CRUD mutations with concurrent Supabase support ---

export async function insertUser(user: User): Promise<void> {
  state.users.push(user);
  await saveState();

  const supabase = getSupabase();
  if (supabase && supabaseActive) {
    try {
      const { error } = await supabase.from("linkflow_users").insert(user);
      if (error) console.error("Supabase insertUser error:", error);
    } catch (e) {
      console.error("Supabase insertUser catch:", e);
    }
  }
}

export async function insertUrl(url: ShortUrl): Promise<void> {
  state.urls.push(url);
  await saveState();

  const supabase = getSupabase();
  if (supabase && supabaseActive) {
    try {
      const { error } = await supabase.from("linkflow_urls").insert(url);
      if (error) console.error("Supabase insertUrl error:", error);
    } catch (e) {
      console.error("Supabase insertUrl catch:", e);
    }
  }
}

export async function updateUrl(url: ShortUrl): Promise<void> {
  const idx = state.urls.findIndex((u) => u.id === url.id);
  if (idx !== -1) {
    state.urls[idx] = url;
  }
  await saveState();

  const supabase = getSupabase();
  if (supabase && supabaseActive) {
    try {
      const { error } = await supabase.from("linkflow_urls").update(url).eq("id", url.id);
      if (error) console.error("Supabase updateUrl error:", error);
    } catch (e) {
      console.error("Supabase updateUrl catch:", e);
    }
  }
}

export async function insertVisit(visit: Visit): Promise<void> {
  state.visits.push(visit);
  await saveState();

  const supabase = getSupabase();
  if (supabase && supabaseActive) {
    try {
      const { error } = await supabase.from("linkflow_visits").insert(visit);
      if (error) console.error("Supabase insertVisit error:", error);
    } catch (e) {
      console.error("Supabase insertVisit catch:", e);
    }
  }
}

export async function deleteUrlRecord(id: string): Promise<void> {
  state.visits = state.visits.filter((v) => v.urlId !== id);
  state.urls = state.urls.filter((u) => u.id !== id);
  await saveState();

  const supabase = getSupabase();
  if (supabase && supabaseActive) {
    try {
      // Cascading deleted entries automatically, but manual execution is cleaner
      await supabase.from("linkflow_visits").delete().eq("urlId", id);
      await supabase.from("linkflow_urls").delete().eq("id", id);
    } catch (e) {
      console.error("Supabase deleteUrlRecord catch:", e);
    }
  }
}

// --- Device & Country Detection Helpers ---
export function detectDevice(userAgent: string = ""): "Desktop" | "Mobile" | "Tablet" {
  const ua = userAgent.toLowerCase();
  if (/(ipad|tablet|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return "Tablet";
  }
  if (/mobile|android|iphone|ipod|iemobile|blackberry|kindle|silk-accelerated|(hpw|web)os|opera m(obi|ini)/i.test(ua)) {
    return "Mobile";
  }
  return "Desktop";
}

/**
 * Parses user request headers for geolocation or injects realistic telemetry in local development.
 */
const COUNTRY_CODES = ["US", "IN", "GB", "DE", "FR", "JP", "CA", "AU", "SG", "NL"];
export function detectCountry(headers: Record<string, any>): string {
  const countryHeader = headers["x-appengine-country"] || headers["cf-ipcountry"] || headers["x-cloud-trace-context"];
  if (countryHeader && typeof countryHeader === "string") {
    if (countryHeader.length === 2) {
      return countryHeader.toUpperCase();
    }
  }
  return COUNTRY_CODES[Math.floor(Math.random() * COUNTRY_CODES.length)];
}
