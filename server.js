const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const DB_PATH = path.join(DATA_DIR, "database.json");
const SESSION_MAX_AGE = 1000 * 60 * 60 * 8;
const sessions = new Map();

const defaultContent = {
  business: {
    name: "B Bhanja Poultry Supply",
    tagline: "Reliable poultry supply in Pokhara",
    location: "Amarsingh, Pokhara, Nepal",
    hours: "6:00 AM - 7:00 PM"
  },
  hero: {
    kicker: "Amarsingh, Pokhara Nepal",
    title: "B Bhanja Poultry Supply",
    subtitle: "Fresh poultry products, healthy birds, quality feed, and regular supply support for farms, shops, homes, and butchers."
  },
  productsIntro: "We supply daily poultry needs with reliable local coordination, practical quantities, and fresh stock.",
  whyCopy: "We focus on clean sourcing, dependable quantities, practical feed guidance, and quick local coordination for regular buyers.",
  products: [
    { title: "Broiler Chickens", icon: "bi-egg-fried", description: "Healthy broiler birds for meat production and regular market demand.", badge: "Meat Birds" },
    { title: "Layer Birds", icon: "bi-box2-heart", description: "Layer supply for egg-focused farms and growing poultry operations.", badge: "Egg Production" },
    { title: "Day-Old Chicks", icon: "bi-brightness-high", description: "Fresh chicks for farms starting or expanding poultry batches.", badge: "Chicks" },
    { title: "Fresh Eggs", icon: "bi-egg", description: "Clean eggs for homes, shops, hotels, and local retailers.", badge: "Daily Stock" },
    { title: "Poultry Feed", icon: "bi-bag-check", description: "Feed options for broiler, layer, and chick growth stages.", badge: "Feed" },
    { title: "Fresh Chicken for Butchers", icon: "bi-shop", description: "Regular fresh chicken supply arranged for butcher shops and meat sellers.", badge: "Butcher Supply" }
  ],
  features: [
    { title: "Local Availability", icon: "bi-geo-alt", description: "Easy coordination from Amarsingh for buyers around Pokhara." },
    { title: "Fresh and Practical", icon: "bi-check2-circle", description: "Stock is handled for freshness, quality, and daily business needs." },
    { title: "Bulk Friendly", icon: "bi-truck", description: "Support for repeat orders and regular supply for butchers and shops." },
    { title: "Feed Guidance", icon: "bi-chat-square-text", description: "Helpful support for choosing feed by bird type and growth stage." }
  ],
  stats: [
    { value: "6+", label: "Product Categories" },
    { value: "Daily", label: "Fresh Stock" },
    { value: "Local", label: "Pokhara Service" },
    { value: "Bulk", label: "Butcher Orders" }
  ],
  about: {
    title: "Serving poultry needs from Amarsingh",
    copy: "B Bhanja Poultry Supply provides poultry products and farm necessities for customers across Pokhara. Our business supports butchers, farms, shops, and families with practical service, fresh stock, and reliable coordination."
  },
  highlights: [
    { title: "Butcher Supply", description: "Fresh chicken orders can be coordinated for regular meat sellers." },
    { title: "Farm Essentials", description: "Broilers, layers, chicks, eggs, and feed available from one place." }
  ],
  gallery: [
    { title: "Egg Trays", description: "Fresh eggs for household and retail demand.", icon: "bi-egg" },
    { title: "Feed Sacks", description: "Poultry feed for healthy growth stages.", icon: "bi-bag" },
    { title: "Fresh Chicken", description: "Reliable supply for local butchers.", icon: "bi-shop-window" }
  ],
  contact: {
    phone: "+977 9800000000",
    email: "info@bbhanjapoultry.com",
    address: "Amarsingh, Pokhara, Nepal",
    mapUrl: "https://maps.google.com/?q=Amarsingh%20Pokhara%20Nepal",
    copy: "Contact us for daily rates, available stock, feed orders, or regular supply arrangements for butchers."
  }
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function ensureDatabase() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(DB_PATH)) return;

  const temporaryPassword = crypto.randomBytes(9).toString("base64url");
  const db = {
    content: clone(defaultContent),
    users: [
      {
        id: crypto.randomUUID(),
        username: "admin",
        ...hashPassword(temporaryPassword)
      }
    ]
  };

  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
  console.log("");
  console.log("Initial admin login created");
  console.log("Username: admin");
  console.log(`Password: ${temporaryPassword}`);
  console.log("Change this password from Admin > Security after login.");
  console.log("");
}

function readDb() {
  ensureDatabase();
  return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
}

function writeDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const iterations = 210000;
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256").toString("hex");
  return { salt, iterations, hash };
}

function verifyPassword(password, user) {
  const candidate = crypto.pbkdf2Sync(password, user.salt, user.iterations, 32, "sha256");
  const stored = Buffer.from(user.hash, "hex");
  return stored.length === candidate.length && crypto.timingSafeEqual(stored, candidate);
}

function parseCookies(req) {
  return Object.fromEntries((req.headers.cookie || "").split(";").filter(Boolean).map((cookie) => {
    const [key, ...value] = cookie.trim().split("=");
    return [key, decodeURIComponent(value.join("="))];
  }));
}

function getSession(req) {
  const sid = parseCookies(req).bbhanja_session;
  if (!sid) return null;
  const session = sessions.get(sid);
  if (!session || session.expires < Date.now()) {
    sessions.delete(sid);
    return null;
  }
  session.expires = Date.now() + SESSION_MAX_AGE;
  return session;
}

function setSession(res, user) {
  const sid = crypto.randomBytes(32).toString("base64url");
  sessions.set(sid, {
    userId: user.id,
    username: user.username,
    expires: Date.now() + SESSION_MAX_AGE
  });
  res.setHeader("Set-Cookie", `bbhanja_session=${encodeURIComponent(sid)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`);
}

function clearSession(req, res) {
  const sid = parseCookies(req).bbhanja_session;
  if (sid) sessions.delete(sid);
  res.setHeader("Set-Cookie", "bbhanja_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0");
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(body));
}

function redirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("Request too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg"
  }[ext] || "application/octet-stream";
}

function serveFile(res, filePath) {
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(ROOT)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }
  fs.readFile(resolved, (error, data) => {
    if (error) {
      sendJson(res, 404, { error: "Not found" });
      return;
    }
    res.writeHead(200, {
      "Content-Type": contentType(resolved),
      "X-Content-Type-Options": "nosniff"
    });
    res.end(data);
  });
}

async function handleApi(req, res, pathname) {
  const session = getSession(req);

  if (req.method === "GET" && pathname === "/api/content") {
    sendJson(res, 200, { content: readDb().content });
    return;
  }

  if (req.method === "GET" && pathname === "/api/session") {
    if (!session) {
      sendJson(res, 401, { error: "Unauthorized" });
      return;
    }
    sendJson(res, 200, { user: { username: session.username } });
    return;
  }

  if (req.method === "POST" && pathname === "/api/login") {
    const body = await readBody(req);
    const db = readDb();
    const user = db.users.find((entry) => entry.username === body.username);
    if (!user || !verifyPassword(String(body.password || ""), user)) {
      sendJson(res, 401, { error: "Invalid credentials" });
      return;
    }
    setSession(res, user);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "POST" && pathname === "/api/logout") {
    clearSession(req, res);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (!session) {
    sendJson(res, 401, { error: "Unauthorized" });
    return;
  }

  if (req.method === "POST" && pathname === "/api/content") {
    const body = await readBody(req);
    const db = readDb();
    db.content = body.content || clone(defaultContent);
    writeDb(db);
    sendJson(res, 200, { content: db.content });
    return;
  }

  if (req.method === "POST" && pathname === "/api/content/reset") {
    const db = readDb();
    db.content = clone(defaultContent);
    writeDb(db);
    sendJson(res, 200, { content: db.content });
    return;
  }

  if (req.method === "POST" && pathname === "/api/credentials") {
    const body = await readBody(req);
    const username = String(body.username || "").trim();
    const password = String(body.password || "");
    if (!username || password.length < 10) {
      sendJson(res, 400, { error: "Username and 10 character password required" });
      return;
    }
    const db = readDb();
    db.users = [{ id: session.userId, username, ...hashPassword(password) }];
    writeDb(db);
    session.username = username;
    sendJson(res, 200, { user: { username } });
    return;
  }

  sendJson(res, 404, { error: "Not found" });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = decodeURIComponent(url.pathname);

    if (pathname.startsWith("/api/")) {
      await handleApi(req, res, pathname);
      return;
    }

    if (pathname === "/admin" || pathname === "/admin.html") {
      if (!getSession(req)) {
        redirect(res, "/login");
        return;
      }
      serveFile(res, path.join(ROOT, "admin.html"));
      return;
    }

    if (pathname === "/login" || pathname === "/login.html") {
      if (getSession(req)) {
        redirect(res, "/admin");
        return;
      }
      serveFile(res, path.join(ROOT, "login.html"));
      return;
    }

    const filePath = pathname === "/" ? path.join(ROOT, "index.html") : path.join(ROOT, pathname);
    serveFile(res, filePath);
  } catch (error) {
    sendJson(res, 500, { error: "Server error" });
  }
});

ensureDatabase();
server.listen(PORT, () => {
  console.log(`B Bhanja Poultry Supply site running at http://localhost:${PORT}`);
});
