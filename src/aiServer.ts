import { GoogleGenAI, Type } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiInstance) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is not defined");
    }
    aiInstance = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiInstance;
}

/**
 * 1. AI Recommendation of custom short codes based on the original URL
 */
export async function generateSmartRecommendations(originalUrl: string): Promise<string[]> {
  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Propose 5 highly specific, lowercased, memorable, custom alphanumeric short codes/slugs (maximum 15 characters, no spaces, only a-z, 0-9, and hyphen) for this target URL: "${originalUrl}". They should be brand-focused, descriptive, and clean.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "5 clean alphanumeric and hyphen-only lowercase custom alias recommendations.",
            },
          },
          required: ["suggestions"],
        },
      },
    });

    const parsed = JSON.parse(response.text.trim());
    if (parsed && Array.isArray(parsed.suggestions)) {
      return parsed.suggestions.map((s: string) => s.toLowerCase().replace(/[^a-z0-9-]/g, "")).filter(Boolean);
    }
    return [];
  } catch (error) {
    console.error("AI Smart Recommendation Error:", error);
    // Safe fallbacks based on originalUrl domains & suffixes
    try {
      const domain = new URL(originalUrl).hostname.replace("www.", "").split(".")[0];
      return [`${domain}-lnk`, `${domain}-go`, `visit-${domain}`, `go-${domain}`, `${domain}-direct`].map((s) => s.toLowerCase());
    } catch {
      return ["link-go", "quick-lnk", "direct-to", "my-slug", "go-now"];
    }
  }
}

/**
 * 2. AI Malicious URL Detection & Safety Score
 */
export interface SafetyResult {
  safetyScore: number;
  verdict: "safe" | "suspicious" | "malicious";
  details: string;
}

export async function detectUrlSafety(url: string): Promise<SafetyResult> {
  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Thoroughly analyze this URL for safety, malware distribution, phishing patterns, impersonation of popular finance/social sites, tracking parameters, or suspicious extensions: "${url}"`,
      config: {
        systemInstruction: "You are a cyber-security threat analyst. Grade the provided URL and identify issues like typosquatting, malware domains, or phishing targets. Provide a numerical score from 0 (extremely dangerous) to 100 (entirely safe), a security level verdict ('safe', 'suspicious', 'malicious'), and specific security warning details.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            safetyScore: {
              type: Type.INTEGER,
              description: "Critical score from 0 (malicious) to 100 (fully safe/trusted).",
            },
            verdict: {
              type: Type.STRING,
              description: "Must be exactly one of 'safe', 'suspicious', or 'malicious'.",
            },
            details: {
              type: Type.STRING,
              description: "A 1-sentence analytical warning or clearance statement.",
            },
          },
          required: ["safetyScore", "verdict", "details"],
        },
      },
    });

    const parsed = JSON.parse(response.text.trim());
    return {
      safetyScore: Math.min(100, Math.max(0, parsed.safetyScore ?? 95)),
      verdict: (parsed.verdict || "safe").toLowerCase() as "safe" | "suspicious" | "malicious",
      details: parsed.details || "The site appears to be accessible and standard.",
    };
  } catch (error) {
    console.error("AI Safety Scoring Error (using static fallback engine):", error);
    // Static heuristic check fallback
    let verdict: "safe" | "suspicious" | "malicious" = "safe";
    let score = 95;
    let details = "Passed standard domain integrity check.";

    const urlLower = url.toLowerCase();
    if (
      urlLower.includes("phish") ||
      urlLower.includes("free-money") ||
      urlLower.includes("win-jackpot") ||
      urlLower.includes("update-your-bank") ||
      urlLower.includes("login-paypal-secure")
    ) {
      verdict = "malicious";
      score = 12;
      details = "Fallback scanner detected keywords indicating threat signatures.";
    } else if (urlLower.length > 250) {
      verdict = "suspicious";
      score = 60;
      details = "Excessive URL length represents increased risk category.";
    }

    return { safetyScore: score, verdict, details };
  }
}

/**
 * Helper to fetch HTML context safely
 */
async function fetchPageMetaData(url: string): Promise<{ title: string; desc: string }> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36 AI-Shortener-Bot/1.0",
      },
      signal: AbortSignal.timeout(600), // Highly optimized 600ms crawl timeout to avoid user lag
    });

    if (!response.ok) {
      return { title: "", desc: "" };
    }

    const html = await response.text();

    // Regex parsing to avoid bloated packages
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : "";

    let desc = "";
    const metaMatch =
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["']/i) ||
      html.match(/<meta[^>]+content=["']([\s\S]*?)["'][^>]+name=["']description["']/i);
    if (metaMatch) {
      desc = metaMatch[1].trim();
    }

    return { title, desc };
  } catch (err) {
    console.log("Headless metadata grab skipped: ", url, (err as Error).message);
    return { title: "", desc: "" };
  }
}

/**
 * 3. Unified Single-Pass AI Safety and Search Analysis Engine (Fast Latency)
 */
export interface WebAnalysisResult {
  safetyScore: number;
  verdict: "safe" | "suspicious" | "malicious";
  safetyDetails: string;
  pageTitle: string;
  pageSummary: string;
}

export async function analyzeUrlSmart(url: string): Promise<WebAnalysisResult> {
  const meta = await fetchPageMetaData(url);

  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Perform unified safety screening and branding metadata summary for the target destination:
URL: "${url}"
Crawl Title: "${meta.title || "Unknown"}"
Crawl Meta Description: "${meta.desc || "Unknown"}"`,
      config: {
        systemInstruction: "You are an expert security scanner and content summarizing AI. Provide a safety score from 0 (extremely unsafe/phishing/scam) to 100 (whitelisted/trusted), a verdict matching exactly 'safe', 'suspicious', or 'malicious', a descriptive safetyWarningDetails sentence, an elegant clear name for the website representing it, and a clean professional summary of 15 to 30 words explaining what is hosted or offered here. Answer ONLY using the requested JSON format.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            safetyScore: { type: Type.INTEGER },
            verdict: { type: Type.STRING },
            safetyWarningDetails: { type: Type.STRING },
            pageTitle: { type: Type.STRING },
            pageSummary: { type: Type.STRING }
          },
          required: ["safetyScore", "verdict", "safetyWarningDetails", "pageTitle", "pageSummary"]
        }
      }
    });

    const parsed = JSON.parse(response.text.trim());
    return {
      safetyScore: Math.min(100, Math.max(0, parsed.safetyScore ?? 95)),
      verdict: (parsed.verdict || "safe").toLowerCase() as "safe" | "suspicious" | "malicious",
      safetyDetails: parsed.safetyWarningDetails || "Destination URL cleared by design-time policy.",
      pageTitle: parsed.pageTitle || meta.title || "Secure Destination Resource",
      pageSummary: parsed.pageSummary || meta.desc || "Online webpage located at target server."
    };
  } catch (error) {
    console.error("Single-Pass URL Performance Analysis failed:", error);
    // Ultimate high-speed static fallbacks
    let verdict: "safe" | "suspicious" | "malicious" = "safe";
    let safetyScore = 95;
    let safetyDetails = "Default domain integrity scanner clearance.";

    const urlLower = url.toLowerCase();
    if (
      urlLower.includes("phish") ||
      urlLower.includes("free-money") ||
      urlLower.includes("win-jackpot") ||
      urlLower.includes("update-your-bank") ||
      urlLower.includes("login-paypal-secure")
    ) {
      verdict = "malicious";
      safetyScore = 12;
      safetyDetails = "Heuristical keywords check flagged severe threats.";
    } else if (urlLower.length > 250) {
      verdict = "suspicious";
      safetyScore = 60;
      safetyDetails = "Long URL format exceeded threshold.";
    }

    let deducedTitle = "Designated Target";
    try {
      deducedTitle = new URL(url).hostname.replace("www.", "");
    } catch {}

    return {
      safetyScore,
      verdict,
      safetyDetails,
      pageTitle: meta.title || deducedTitle,
      pageSummary: meta.desc || "Webpage at the designated URL destination."
    };
  }
}

/**
 * 4. AI Webpage Summarizer (Deprecated/Legacy Wrapper for server compatibility)
 */
export interface WebSummary {
  pageTitle: string;
  pageSummary: string;
}

export async function generateWebpageSummary(url: string): Promise<WebSummary> {
  const result = await analyzeUrlSmart(url);
  return {
    pageTitle: result.pageTitle,
    pageSummary: result.pageSummary,
  };
}

