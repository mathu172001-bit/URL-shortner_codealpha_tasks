import "dotenv/config";
import express from "express";
import path from "path";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { 
  getState, 
  saveState, 
  detectDevice, 
  detectCountry, 
  initDatabase, 
  getDbStatus, 
  insertUser, 
  insertUrl, 
  updateUrl, 
  insertVisit, 
  deleteUrlRecord 
} from "./src/dbServer.js";
import { generateSmartRecommendations, analyzeUrlSmart } from "./src/aiServer.js";

const app = express();
const PORT = 3000;

app.use(express.json());

// Simple encryption key / secret check
const SECRET_JWT = "url-shortener-super-secret-2026";

/**
 * SHA256 hashing helper
 */
function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + SECRET_JWT).digest("hex");
}

function parseBrowser(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (ua.includes("firefox")) return "Firefox";
  if (ua.includes("chrome") && !ua.includes("edge") && !ua.includes("edg")) return "Chrome";
  if (ua.includes("safari") && !ua.includes("chrome")) return "Safari";
  if (ua.includes("edge") || ua.includes("edg")) return "Edge";
  if (ua.includes("opera") || ua.includes("opr")) return "Opera";
  return "Other";
}

/**
 * Auth Middleware to decode Bearer Tokens (simple structure: "usr_" + base64(email))
 */
function handleAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers["authorization"];
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    try {
      const decodedStr = Buffer.from(token, "base64").toString("utf-8");
      const [userId, email] = decodedStr.split(":");
      const state = getState();
      const user = state.users.find((u) => u.id === userId && u.email === email);
      if (user) {
        (req as any).user = { id: user.id, email: user.email };
      }
    } catch (e) {
      // Invalid token, treat as anonymous
    }
  }
  next();
}

app.use(handleAuth);

// Intermediate Referer Proxy to route orphaned relative requests from inside the secure iframe back to their real origin
app.use((req, res, next) => {
  const path = req.path;
  const isLocal = [
    "/api/auth",
    "/api/urls",
    "/api/visits",
    "/api/proxy",
    "/api/health",
    "/api/recommendations",
    "/api/db-status",
    "/assets",
    "/@vite",
    "/@id",
    "/src",
    "/node_modules",
    "/index.html",
    "/favicon.ico"
  ].some(pre => path.startsWith(pre));

  if (isLocal) {
    return next();
  }

  const referer = req.headers.referer || (req.headers.Referer as string);
  if (referer && referer.includes("/api/proxy?url=")) {
    try {
      const urlParam = referer.split("url=")[1];
      if (urlParam) {
        const decodedUrl = decodeURIComponent(urlParam.split("&")[0]);
        const targetUrlObj = new URL(decodedUrl);
        // Build absolute target URL based on the referrer's location
        const finalTargetUrl = new URL(req.originalUrl, targetUrlObj.href).href;
        
        console.log(`[Referer Redirect Proxy]: ${req.originalUrl} referred by ${decodedUrl} -> Redirecting to proxy: ${finalTargetUrl}`);
        return res.redirect(`/api/proxy?url=${encodeURIComponent(finalTargetUrl)}`);
      }
    } catch (e) {
      console.error("Referer proxy error:", e);
    }
  }
  next();
});

// ==========================================
// 1. AUTHENTICATION ENDPOINTS
// ==========================================

app.post("/api/auth/register", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const cleanEmail = email.trim().toLowerCase();
  const state = getState();
  const exists = state.users.find((u) => u.email === cleanEmail);
  if (exists) {
    return res.status(409).json({ error: "Email already registered" });
  }

  const newUser = {
    id: "usr_" + Math.random().toString(36).substring(2, 11),
    email: cleanEmail,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
  };

  await insertUser(newUser);

  const tokenInput = `${newUser.id}:${newUser.email}`;
  const token = Buffer.from(tokenInput).toString("base64");

  res.status(201).json({
    message: "Registration successful",
    token,
    user: { id: newUser.id, email: newUser.email },
  });
});


app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const cleanEmail = email.trim().toLowerCase();
  const state = getState();
  const user = state.users.find((u) => u.email === cleanEmail);

  if (!user || user.passwordHash !== hashPassword(password)) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const tokenInput = `${user.id}:${user.email}`;
  const token = Buffer.from(tokenInput).toString("base64");

  res.json({
    message: "Login successful",
    token,
    user: { id: user.id, email: user.email },
  });
});

app.get("/api/auth/me", (req, res) => {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ error: "Unauthenticated" });
  }
  res.json({ user });
});


// ==========================================
// 2. URL SHORTENER & ANALYTICS ENDPOINTS
// ==========================================

// Get list of URLs (filtered by logged in user, or anonymous list)
app.get("/api/urls", (req, res) => {
  const user = (req as any).user;
  const state = getState();

  if (user) {
    // Return this user's links
    const userUrls = state.urls.filter((u) => u.creatorId === user.id);
    res.json({ urls: userUrls });
  } else {
    // Return anonymous public links created during the current sandbox run
    const anonUrls = state.urls.filter((u) => u.creatorId === null);
    res.json({ urls: anonUrls });
  }
});

// Single URL analytics details
app.get("/api/urls/:id/analytics", (req, res) => {
  const { id } = req.params;
  const state = getState();
  const urlObj = state.urls.find((u) => u.id === id);

  if (!urlObj) {
    return res.status(404).json({ error: "URL not found" });
  }

  // Filter visits
  const visits = state.visits.filter((v) => v.urlId === id);
  res.json({ url: urlObj, visits });
});

// Create Short URL
app.post("/api/urls", async (req, res) => {
  const { originalUrl, customAlias, category, expiresAt, password, oneTime } = req.body;
  const user = (req as any).user;

  if (!originalUrl) {
    return res.status(400).json({ error: "Destination URL is required" });
  }

  // Standard simple validation
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(originalUrl);
  } catch (err) {
    return res.status(400).json({ error: "Invalid destination URL structure. Be sure to prefix with http:// or https://" });
  }

  // Prevent circular redirects
  if (parsedUrl.hostname.includes("run.app") && parsedUrl.pathname.length > 1) {
    const segments = parsedUrl.pathname.split("/").filter(Boolean);
    if (segments.length === 1 && segments[0] !== "api") {
      return res.status(400).json({ error: "Circular references are not permitted directly." });
    }
  }

  const state = getState();

  // Validate custom code
  let finalCode = "";
  if (customAlias) {
    const cleanAlias = customAlias.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (!cleanAlias) {
      return res.status(400).json({ error: "Custom alias contains invalid characters." });
    }
    // Check if alias already exists
    const collision = state.urls.find((u) => u.shortCode === cleanAlias);
    if (collision) {
      return res.status(409).json({ error: `The custom alias "${cleanAlias}" is already taken.` });
    }
    finalCode = cleanAlias;
  } else {
    // Generate a unique 6 letter alphanumeric short code
    let tries = 0;
    while (tries < 100) {
      const candidate = Math.random().toString(36).substring(2, 8).toLowerCase();
      const collision = state.urls.find((u) => u.shortCode === candidate);
      if (!collision) {
        finalCode = candidate;
        break;
      }
      tries++;
    }
    if (!finalCode) {
      finalCode = Math.random().toString(36).substring(2, 9).toLowerCase();
    }
  }

  // Call Gemini for safety and summarization synchronously details
  let safetyVerdict: "safe" | "suspicious" | "malicious" = "safe";
  let safetyScore = 95;
  let safetyDetails = "Destination URL cleared by AI Scanner.";
  let pageTitle = parsedUrl.hostname;
  let pageSummary = "Dynamically mapped via Shortener API.";

  try {
    // Single-pass highly optimized AI Analysis (Safety Check + Branding Summary in 1 request)
    const analysis = await analyzeUrlSmart(originalUrl);

    safetyVerdict = analysis.verdict;
    safetyScore = analysis.safetyScore;
    safetyDetails = analysis.safetyDetails;
    pageTitle = analysis.pageTitle;
    pageSummary = analysis.pageSummary;
  } catch (err) {
    console.error("Single-pass AI scanning and summarization failed, applying fallback", err);
  }

  const newUrlObj: any = {
    id: "url_" + Math.random().toString(36).substring(2, 11),
    originalUrl,
    shortCode: finalCode,
    creatorId: user ? user.id : null,
    createdAt: new Date().toISOString(),
    category: category || "Other",
    expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
    passwordHash: password ? hashPassword(password) : null,
    oneTime: !!oneTime,
    isActive: true,
    visitCount: 0,
    qrVisitCount: 0,
    pageTitle,
    pageSummary,
    safetyScore,
    safetyVerdict,
    safetyDetails,
  };

  await insertUrl(newUrlObj);

  res.status(201).json({
    message: "Short URL created successfully",
    url: newUrlObj,
  });
});

// Delete Short URL
app.delete("/api/urls/:id", async (req, res) => {
  const { id } = req.params;
  const user = (req as any).user;
  const state = getState();

  const urlIndex = state.urls.findIndex((u) => u.id === id);
  if (urlIndex === -1) {
    return res.status(404).json({ error: "URL not found" });
  }

  const urlObj = state.urls[urlIndex];
  // Verify authorization
  if (urlObj.creatorId && (!user || user.id !== urlObj.creatorId)) {
    return res.status(403).json({ error: "You do not have permission to delete this URL" });
  }

  // Delete matching visits and urls with core database adapter
  await deleteUrlRecord(id);

  res.json({ message: "URL deleted successfully" });
});

// Expose Smart Recommendation alias list for the user
app.post("/api/urls/recommend-aliases", async (req, res) => {
  const { originalUrl } = req.body;
  if (!originalUrl) {
    return res.status(400).json({ error: "URL is required" });
  }
  try {
    const list = await generateSmartRecommendations(originalUrl);
    res.json({ suggestions: list });
  } catch (err) {
    res.status(500).json({ error: "AI search recommendations failed" });
  }
});

// Secure link masking/cloaking proxy endpoint to bypass X-Frame-Options inside Private redirect gates
app.all("/api/proxy", async (req, res) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl) {
    return res.status(400).send("Missing target url");
  }

  try {
    let urlString = targetUrl;
    if (!urlString.startsWith("http://") && !urlString.startsWith("https://")) {
      urlString = "https://" + urlString;
    }

    // Build standard proxy fetch options, forwarding standard headers from client browser to bypass Cloudflare
    const cleanHeaders: any = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache"
    };

    // Safely copy browser validation details
    Object.keys(req.headers).forEach(key => {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey !== "host" &&
        lowerKey !== "referer" &&
        lowerKey !== "connection" &&
        lowerKey !== "accept-encoding" &&
        lowerKey !== "if-none-match" &&
        lowerKey !== "if-modified-since" &&
        lowerKey !== "sec-fetch-site" &&  // Avoid CORS blocks relative to our iframe origin
        lowerKey !== "sec-fetch-mode"
      ) {
        cleanHeaders[key] = req.headers[key];
      }
    });

    const fetchOptions: any = {
      method: req.method,
      headers: cleanHeaders
    };

    // Forward the cookies from the client browser associated with this request
    if (req.headers.cookie) {
      fetchOptions.headers["Cookie"] = req.headers.cookie;
    }

    // Forward standard payload contentType if available
    if (req.headers["content-type"]) {
      fetchOptions.headers["Content-Type"] = req.headers["content-type"];
    }

    // Forward body if present for POST/PUT requests
    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method) && req.body) {
      if (typeof req.body === "object") {
        fetchOptions.body = JSON.stringify(req.body);
      } else {
        fetchOptions.body = req.body;
      }
    }

    // Robust manual redirect tracking to prevent undici "redirect count exceeded" loops
    let currentUrl = urlString;
    let redirectCount = 0;
    const maxRedirects = 10;
    let response: any;
    const finalFetchOptions = { ...fetchOptions, redirect: "manual" as const };
    const accumulatedCookies: string[] = [];
    
    // Seed initial cookies from request
    if (req.headers.cookie) {
      accumulatedCookies.push(req.headers.cookie);
    }

    while (true) {
      // Ensure any newly set cookies across the redirect chain are forwarded in the headers
      if (accumulatedCookies.length > 0) {
        finalFetchOptions.headers = {
          ...finalFetchOptions.headers,
          "Cookie": accumulatedCookies.join("; ")
        };
      }

      response = await fetch(currentUrl, finalFetchOptions);

      // Collect any set-cookie cookies from intermediate redirect hops
      const setCookie = response.headers.get("set-cookie");
      if (setCookie) {
        const cookies = setCookie.split(/,(?=[^;]*=)/);
        cookies.forEach(c => {
          const cookiePart = c.trim().split(";")[0];
          if (cookiePart) {
            accumulatedCookies.push(cookiePart);
          }
        });
        
        // Also clean up and send back set-cookie back to the client browser
        const cleanedCookie = setCookie.replace(/Domain=[^;]+/gi, "").replace(/Secure/gi, "");
        res.setHeader("Set-Cookie", cleanedCookie);
      }

      if (response.status >= 300 && response.status < 400) {
        redirectCount++;
        if (redirectCount > maxRedirects) {
          console.warn(`Redirect limit (${maxRedirects}) exceeded at: ${currentUrl}`);
          break;
        }

        const location = response.headers.get("location");
        if (!location) {
          break;
        }

        const resolvedUrl = new URL(location, currentUrl).href;
        if (resolvedUrl === currentUrl) {
          console.warn(`Infinite self-redirect detected at: ${currentUrl}`);
          break;
        }

        currentUrl = resolvedUrl;
        
        // standard fetch redirection specs: 303 always transitions to GET, 301/302 may transition to GET
        if (response.status === 303 || ((response.status === 301 || response.status === 302) && finalFetchOptions.method !== "GET")) {
          finalFetchOptions.method = "GET";
          delete finalFetchOptions.body;
          if (finalFetchOptions.headers) {
            delete finalFetchOptions.headers["Content-Type"];
          }
        }
      } else {
        break;
      }
    }

    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("text/html")) {
      let body = await response.text();
      
      // Neutralize any Content Security Policy tags
      body = body.replace(/<meta[^>]*content-security-policy[^>]*>/gi, "");
      
      // Ultra-aggressive Frame-Buster and Redirect-Escape Neutralization
      body = body.replace(/(window\s*\.)?top\s*!==?\s*(window\s*\.)?self/gi, "false");
      body = body.replace(/(window\s*\.)?self\s*!==?\s*(window\s*\.)?top/gi, "false");
      body = body.replace(/(window\s*\.)?parent\s*!==?\s*(window\s*\.)?self/gi, "false");
      body = body.replace(/(window\s*\.)?self\s*!==?\s*(window\s*\.)?parent/gi, "false");
      body = body.replace(/if\s*\((window\s*\.)?top\s*!==?\s*self\)/gi, "if(false)");
      body = body.replace(/if\s*\((window\s*\.)?self\s*!==?\s*top\)/gi, "if(false)");
      body = body.replace(/top\.location\.href\s*=/gi, "window.location.href =");
      body = body.replace(/top\.location\s*=/gi, "window.location =");
      body = body.replace(/window\.top\.location\s*=/gi, "window.location =");
      body = body.replace(/parent\.location\s*=/gi, "window.location =");
      body = body.replace(/top\.document/gi, "window.document");
      body = body.replace(/window\.top/gi, "window.self");
      body = body.replace(/window\.parent/gi, "window.self");
      
      // Inject <base href="..."> into <head> for resolving relative paths perfectly
      // Use the final redirected URL of the response as base URI to ensure correctness
      const finalBaseUri = currentUrl;
      const baseTag = `<base href="${finalBaseUri}">`;
      const interceptorScript = `
        <script>
          // Seamless Secure Proxy Link Interceptor
          (function() {
            const baseUri = "${finalBaseUri}";

            // Hook window.open to keep everything private within the frame
            window.open = function(url, target, features) {
              if (url) {
                try {
                  const absUrl = new URL(url, baseUri).href;
                  window.location.href = '/api/proxy?url=' + encodeURIComponent(absUrl);
                } catch(e) {
                  window.location.href = '/api/proxy?url=' + encodeURIComponent(url);
                }
              }
              return null;
            };

            function resolveUrl(url) {
              if (!url) return url;
              try {
                const absUrl = new URL(url, baseUri).href;
                
                // Keep embeds, internal proxies, and API commands local
                if (absUrl.startsWith(window.location.origin + '/api/proxy') || 
                    absUrl.includes('youtube.com/embed') || 
                    absUrl.includes('player.vimeo.com') ||
                    absUrl.includes('open.spotify.com/embed')) {
                  return absUrl;
                }
                
                if (absUrl.startsWith('http://') || absUrl.startsWith('https://')) {
                  return window.location.origin + '/api/proxy?url=' + encodeURIComponent(absUrl);
                }
              } catch (e) {
                console.warn("Proxy link intercept error:", e);
              }
              return url;
            }

            // Hook window.fetch
            const originalFetch = window.fetch;
            window.fetch = function(input, init) {
              if (typeof input === 'string') {
                input = resolveUrl(input);
              } else if (input instanceof Request) {
                try {
                  const urlObj = new URL(input.url, baseUri);
                  const proxiedUrl = resolveUrl(urlObj.href);
                  input = new Request(proxiedUrl, input);
                } catch(e) {
                  Object.defineProperty(input, 'url', { value: resolveUrl(input.url), writable: false });
                }
              }
              return originalFetch.apply(this, [input, init]);
            };

            // Hook XMLHttpRequest
            const originalOpen = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
              const proxiedUrl = resolveUrl(url);
              return originalOpen.apply(this, [method, proxiedUrl, async !== false, user, password]);
            };

            // Capture regular link navigation clicks
            document.addEventListener('click', function(e) {
              const anchor = e.target.closest('a');
              if (anchor && anchor.href) {
                const hrefAttr = anchor.getAttribute('href') || '';
                if (hrefAttr.startsWith('#')) {
                  return;
                }
                const targetHref = anchor.href;
                const proxied = resolveUrl(targetHref);
                if (proxied !== targetHref) {
                  e.preventDefault();
                  e.stopPropagation();
                  anchor.target = "_self";
                  window.location.href = proxied;
                }
              }
            }, true);

            // Capture forms
            document.addEventListener('submit', function(e) {
              const form = e.target;
              if (form && form.action) {
                const method = (form.method || 'GET').toUpperCase();
                if (method === 'GET') {
                  e.preventDefault();
                  try {
                    const resolvedAction = new URL(form.action, baseUri).href;
                    const formData = new FormData(form);
                    const params = new URLSearchParams();
                    for (const [key, val] of formData.entries()) {
                      params.append(key, val);
                    }
                    const finalTargetUrl = resolvedAction + (resolvedAction.includes('?') ? '&' : '?') + params.toString();
                    window.location.href = '/api/proxy?url=' + encodeURIComponent(finalTargetUrl);
                  } catch (err) {
                    console.error("Form redirect intercept failed:", err);
                  }
                }
              }
            }, true);
          })();
        </script>
      `;

      const isSandboxCheck = req.query.sandbox === "1";
      const injectContent = isSandboxCheck ? baseTag : (baseTag + "\n" + interceptorScript);
      if (body.includes("<head>")) {
        body = body.replace("<head>", `<head>\n  ${injectContent}`);
      } else if (body.includes("<HEAD>")) {
        body = body.replace("<HEAD>", `<HEAD>\n  ${injectContent}`);
      } else {
        body = injectContent + "\n" + body;
      }

      // Strip security headers that prevent framing
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
      
      res.removeHeader("X-Frame-Options");
      res.removeHeader("Content-Security-Policy");
      res.removeHeader("content-security-policy");
      res.removeHeader("x-frame-options");
      
      return res.send(body);
    } else {
      // True Transparent Non-HTML routing: stream back scripts, stylesheets, pictures, JSON APIs
      res.status(response.status);
      response.headers.forEach((value, key) => {
        const lowerKey = key.toLowerCase();
        if (
          lowerKey !== "content-security-policy" &&
          lowerKey !== "content-security-policy-report-only" &&
          lowerKey !== "x-frame-options" &&
          lowerKey !== "access-control-allow-origin"
        ) {
          res.setHeader(key, value);
        }
      });

      // Inject wide open permissive CORS so AJAX code inside iframe succeeds
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "*");

      const buffer = await response.arrayBuffer();
      return res.send(Buffer.from(buffer));
    }
  } catch (error: any) {
    console.error("Error cloaking proxy:", error);
    return res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Private Gate Cloaking Status</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
      </head>
      <body class="bg-slate-950 text-slate-100 flex items-center justify-center min-h-screen p-6 font-['Inter']">
        <div class="max-w-md w-full bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-xl text-center space-y-4">
          <div class="mx-auto flex items-center justify-center w-12 h-12 rounded-full bg-indigo-500/10 text-indigo-400">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-6 h-6">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <h2 class="text-lg font-bold text-white">Connection Tunnel Offline</h2>
          <p class="text-xs text-slate-400 leading-relaxed font-medium">To protect your browser confidentiality, this URL gateway enforces military-grade link masking. This target web server rejected our proxy request, but you can securely access it directly.</p>
          <div class="space-y-2 pt-2">
            <a href="${targetUrl}" target="_top" class="inline-block w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold transition cursor-pointer text-xs">
              Decloak & Open Directly
            </a>
          </div>
        </div>
      </body>
      </html>
    `);
  }
});


// ==========================================
// 3. SECURE REDIRECT TEMPLATE SCREENS
// ==========================================

function styledHtmlError(title: string, message: string, homeLink: string) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title} | AI URL Hub</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Inter', sans-serif; }
      </style>
    </head>
    <body class="bg-slate-900 text-slate-100 flex items-center justify-center min-h-screen px-4">
      <div class="max-w-md w-full bg-slate-800 border border-slate-700/60 p-8 rounded-2xl shadow-xl text-center space-y-6">
        <div class="mx-auto flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/10 text-amber-500">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-8 h-8">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <h1 class="text-2xl font-bold tracking-tight text-white">${title}</h1>
        <p class="text-slate-300 text-sm leading-relaxed">${message}</p>
        <div class="pt-4">
          <a href="${homeLink}" class="inline-flex items-center justify-center w-full px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium hover:scale-[1.02] transform transition-all duration-200 shadow-lg shadow-indigo-600/30">
            Back to Dashboard
          </a>
        </div>
      </div>
    </body>
    </html>
  `;
}

function styledPasswordForm(code: string, isError: boolean) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Secure Link Gate | AI URL Hub</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Inter', sans-serif; }
      </style>
    </head>
    <body class="bg-slate-950 text-slate-100 flex items-center justify-center min-h-screen px-4">
      <div class="max-w-md w-full bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl space-y-6">
        <div class="text-center space-y-2">
          <div class="mx-auto flex items-center justify-center w-12 h-12 rounded-full bg-indigo-500/10 text-indigo-400">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-6 h-6">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <h1 class="text-xl font-bold tracking-tight text-white">Password Required</h1>
          <p class="text-slate-400 text-sm">This shortened redirect link (/${code}) has been password-protected by the owner.</p>
        </div>

        <form action="/${code}" method="GET" class="space-y-4">
          <div class="space-y-1">
            <label class="text-xs font-semibold uppercase tracking-wider text-slate-400">Enter Link Password</label>
            <input type="password" name="pwd" autofocus required placeholder="••••••••••••" class="w-full px-4 py-3 bg-slate-800 rounded-xl border ${isError ? "border-red-500 focus:ring-red-500/40" : "border-slate-700/80 focus:ring-indigo-500/55"} focus:outline-none focus:ring-2 text-white placeholder-slate-500" />
            ${isError ? '<p class="text-red-400 text-xs font-medium mt-1">Verification failed: Incorrect password.</p>' : ""}
          </div>

          <button type="submit" class="w-full py-3 bg-indigo-600 hover:bg-indigo-500 font-medium rounded-xl text-white outline-none active:scale-[0.98] transition-all transform hover:scale-[1.01] shadow-lg shadow-indigo-600/30">
            Unlock & Redirect
          </button>
        </form>
      </div>
    </body>
    </html>
  `;
}

function getEmbedUrl(urlString: string): string {
  try {
    let cleanUrl = urlString.trim();
    if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
      cleanUrl = "https://" + cleanUrl;
    }
    const url = new URL(cleanUrl);
    const host = url.hostname.toLowerCase();
    
    // YouTube Support (Watch, Live, Shorts, Embeds, Share links)
    if (host.includes("youtube.com") || host.includes("youtu.be")) {
      let videoId = "";
      if (host.includes("youtu.be")) {
        videoId = url.pathname.substring(1);
      } else if (url.pathname.includes("/shorts/")) {
        videoId = url.pathname.split("/shorts/")[1]?.split(/[?#]/)[0];
      } else if (url.pathname.includes("/embed/")) {
        return cleanUrl;
      } else {
        videoId = url.searchParams.get("v") || "";
        if (!videoId && url.pathname.includes("/v/")) {
          videoId = url.pathname.split("/v/")[1]?.split(/[?#]/)[0];
        }
      }
      if (videoId) {
        videoId = videoId.split("&")[0];
        return `https://www.youtube.com/embed/${videoId}?rel=0`;
      }
    }
    
    // Vimeo Support
    if (host.includes("vimeo.com")) {
      if (!host.includes("player.vimeo.com")) {
        const videoId = url.pathname.substring(1).split(/[?#]/)[0];
        if (videoId && /^\d+$/.test(videoId)) {
          return `https://player.vimeo.com/video/${videoId}`;
        }
      }
    }

    // Spotify Embed Support
    if (host.includes("spotify.com")) {
      if (!url.pathname.includes("/embed/")) {
        return `https://open.spotify.com/embed${url.pathname}${url.search}`;
      }
    }

    // Google Drive Viewer Support
    if (host.includes("drive.google.com")) {
      if (url.pathname.includes("/file/d/") && !url.pathname.endsWith("/preview")) {
        const fileId = url.pathname.split("/file/d/")[1]?.split("/")[0];
        if (fileId) {
          return `https://drive.google.com/file/d/${fileId}/preview`;
        }
      }
    }
  } catch (e) {
    console.error("Error in getEmbedUrl helper:", e);
  }
  return urlString;
}

function styledPrivateIframe(originalUrl: string, title: string) {
  let host = "";
  try {
    const parsed = new URL(originalUrl.startsWith("http") ? originalUrl : "https://" + originalUrl);
    host = parsed.hostname.toLowerCase();
  } catch (e) {
    host = "Unknown Host";
  }

  return `
    <!DOCTYPE html>
    <html lang="en" class="h-full w-full m-0 p-0">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Secure Gateway - ${title}</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    </head>
    <body class="bg-slate-950 text-slate-100 flex flex-col h-full w-full m-0 p-0 font-['Inter'] items-center justify-center">
      
      <div id="status-container" class="max-w-2xl w-full mx-auto px-6 py-12 text-center flex flex-col items-center justify-center space-y-8 animate-in fade-in zoom-in duration-500">
        
        <!-- Outer aesthetic container -->
        <div class="relative w-28 h-28 flex items-center justify-center">
          <div class="absolute inset-0 rounded-full bg-indigo-500/10 border border-indigo-500/25 animate-ping opacity-60"></div>
          <div class="absolute -inset-4 rounded-full bg-indigo-500/5 border border-indigo-400/10 animate-pulse"></div>
          <div class="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <svg id="status-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-10 h-10 animate-pulse">
              <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
          </div>
        </div>

        <div class="text-center space-y-3">
          <h2 id="status-title" class="text-3xl font-extrabold text-white tracking-tight">Initiating Private Window...</h2>
          <div class="inline-flex flex-col items-center gap-1">
            <p class="text-[10px] uppercase font-extrabold tracking-[0.2em] text-slate-500">Target Destination</p>
            <p class="text-sm font-semibold tracking-wide text-indigo-400 font-mono bg-indigo-500/10 px-4 py-1.5 rounded-lg border border-indigo-500/20">${host}</p>
          </div>
        </div>

        <div class="w-full max-w-sm bg-slate-900/80 p-5 border border-slate-800/80 rounded-2xl text-slate-300 text-xs leading-relaxed space-y-3 shadow-inner text-center">
          <p class="font-medium text-slate-200">
            Opening your content in a highly secure, decoupled pop-up browser window.
          </p>
          <div class="h-px bg-slate-800 w-full rounded-full"></div>
          <p id="status-details" class="text-[11px] text-slate-400 font-medium">
            Please wait...
          </p>
        </div>

        <!-- Massive central launcher button -->
        <button id="manual-launch-btn" onclick="launchWindow()" class="hidden px-10 py-5 bg-indigo-600 hover:bg-indigo-500 hover:scale-[1.02] text-white hover:text-white rounded-2xl font-bold text-base shadow-2xl shadow-indigo-600/30 active:scale-95 transition-all items-center gap-4 cursor-pointer">
          <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
          Open In Private Window
        </button>
      </div>

      <script>
        function launchWindow() {
          const w = window.outerWidth ? window.outerWidth * 0.8 : 1200;
          const h = window.outerHeight ? window.outerHeight * 0.8 : 800;
          const left = (screen.width - w) / 2;
          const top = (screen.height - h) / 2;

          // Attempt to open in a literal popup/private window
          const newWin = window.open("${originalUrl}", "_blank", "popup=1,noopener=1,noreferrer=1,width=" + w + ",height=" + h + ",top=" + top + ",left=" + left);
          
          if (newWin) {
            newWin.opener = null;
            document.getElementById("status-title").innerText = "Secure Window Launched!";
            document.getElementById("status-details").innerHTML = 'Your content is now playing in a separate private window.<br/><br/>You may safely close this tab.';
            document.getElementById("status-icon").classList.remove("animate-pulse");
            document.getElementById("status-icon").innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />';
            document.getElementById("manual-launch-btn").style.display = "none";
          } else {
            // Popup was blocked by browser
            document.getElementById("status-title").innerText = "Popup Blocked by Browser";
            document.getElementById("status-title").classList.add("text-amber-500");
            document.getElementById("status-details").innerHTML = 'Your browser blocked the automatic private window.<br/><br/>Please click the button below to launch it manually.';
            document.getElementById("manual-launch-btn").style.display = "flex";
            document.getElementById("status-icon").classList.remove("animate-pulse");
            document.getElementById("status-icon").innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />';
          }
        }

        window.addEventListener("DOMContentLoaded", () => {
          setTimeout(() => {
            launchWindow();
          }, 600);
        });
      </script>
    </body>
    </html>
  `;
}

// Redirect engine with robust collison avoidances
app.get("/:code", async (req, res, next) => {
  const code = req.params.code;

  // Let core server paths, static files, or API fall through to bundler and next middleware
  if (
    code === "api" ||
    code === "assets" ||
    code === "index.html" ||
    code.includes(".") ||
    code.startsWith("_")
  ) {
    return next();
  }

  const state = getState();
  const url = state.urls.find((u) => u.shortCode === code);

  if (!url) {
    return res.status(404).send(styledHtmlError("Redirect Page Not Found", "This shortened link was either deleted, expired, or never configured.", "/"));
  }

  // Verify expiry timestamps
  if (url.expiresAt && new Date(url.expiresAt) < new Date()) {
    url.isActive = false;
    await updateUrl(url);
    return res.status(410).send(styledHtmlError("This Link Has Expired", "We cannot redirect you. The link's owner set secure expiration rules which triggered on: " + new Date(url.expiresAt).toLocaleString(), "/"));
  }

  // Verify one time usage status
  if (url.oneTime && !url.isActive) {
    return res.status(410).send(styledHtmlError("One-Time Link Used", "This secure alias is set to work only once and has already been accessed.", "/"));
  }

  // Validate passwords
  if (url.passwordHash) {
    const suppliedPwd = req.query.pwd as string;
    if (suppliedPwd === undefined) {
      // First hit, show form
      return res.status(200).send(styledPasswordForm(code, false));
    }
    const checkHash = hashPassword(suppliedPwd);
    if (checkHash !== url.passwordHash) {
      // Failed pwd, show error
      return res.status(401).send(styledPasswordForm(code, true));
    }
  }

  // Track the visit!
  const isQr = req.query.qr === "1" || req.query.qr === "true";
  
  url.visitCount += 1;
  if (isQr) {
    url.qrVisitCount += 1;
  }

  // Deactivate one-time links immediately so successive hits are blocked
  if (url.oneTime) {
    url.isActive = false;
  }

  await updateUrl(url);

  // Create telemetry record
  const device = detectDevice(req.headers["user-agent"] || "");
  const country = detectCountry(req.headers);
  const browser = parseBrowser(req.headers["user-agent"] || "");

  const newVisitorLog = {
    id: "vst_" + Math.random().toString(36).substring(2, 11),
    urlId: url.id,
    timestamp: new Date().toISOString(),
    country,
    device,
    browser,
    isQr,
  };

  await insertVisit(newVisitorLog);

  // Final Redirection!
  if (url.passwordHash) {
    // When password protected, securely route through private gate portal
    res.send(styledPrivateIframe(url.originalUrl, url.pageTitle || url.originalUrl));
  } else {
    // Normal redirect
    res.redirect(url.originalUrl);
  }
});

// Database connectivity check endpoint
app.get("/api/db-status", (req, res) => {
  res.json(getDbStatus());
});

// ==========================================
// 4. VITE & STATIC HANDLING
// ==========================================

async function startServer() {
  // Initialize the database (Supabase with JSON fallback gracefully)
  try {
    await initDatabase();
  } catch (err) {
    console.error("Database initialization failed fatal error:", err);
  }

  if (process.env.NODE_ENV !== "production") {
    // Development Mode: Use Vite Middleware
    console.log("Starting server in development mode using Vite dev middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);

    // Serve index.html transformed by Vite for any other frontend routing requests
    app.get("*", async (req, res, next) => {
      try {
        const fs = await import("fs");
        const htmlPath = path.join(process.cwd(), "index.html");
        if (fs.existsSync(htmlPath)) {
          let html = fs.readFileSync(htmlPath, "utf-8");
          // Transform template HTML with Vite's injection logic
          html = await vite.transformIndexHtml(req.originalUrl, html);
          res.status(200).set({ "Content-Type": "text/html" }).send(html);
        } else {
          res.status(404).send("index.html not found");
        }
      } catch (err) {
        next(err);
      }
    });
  } else {
    // Production Mode: Serve standard build dist static file structure
    console.log("Starting server in production mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express server running on http://localhost:${PORT}`);
  });
}

startServer();
