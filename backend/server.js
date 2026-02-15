require("dotenv").config();

const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const multer = require("multer");

const pool = require("./db");

const app = express();
app.set("trust proxy", 1); // IMPORTANT for Railway/HTTPS cookies

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "doxa_secret";
const isProd = process.env.NODE_ENV === "production";

/* ===================== PATHS ===================== */
const frontendDir = path.join(__dirname, "frontend");
const uploadDir = path.join(frontendDir, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

/* ===================== COOKIES ===================== */
const cookieOpts = {
  httpOnly: true,
  sameSite: "lax",
  secure: isProd, // true on Railway, false locally
  maxAge: 1000 * 60 * 60 * 6, // 6 hours
};

function setCookie(res, name, value) {
  res.cookie(name, value, cookieOpts);
}
function clearCookie(res, name) {
  res.clearCookie(name, { ...cookieOpts, maxAge: 0 });
}

/* ===================== MIDDLEWARE ===================== */
// If frontend + backend are SAME DOMAIN (your case), CORS is not even needed.
// Keeping safe config:
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve frontend + uploads
app.use(express.static(frontendDir));
app.use("/uploads", express.static(uploadDir));

/* ===================== UPLOAD CONFIG ===================== */
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (_, file, cb) => {
      cb(null, Date.now() + "-" + file.originalname.replace(/\s+/g, "_"));
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
});

/* ===================== AUTH MIDDLEWARE ===================== */
function requireUser(req, res, next) {
  try {
    const token = req.cookies.user_token;
    if (!token) return res.status(401).json({ error: "Not logged in" });
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid login" });
  }
}

function requireAdmin(req, res, next) {
  try {
    const token = req.cookies.admin_token;
    if (!token) return res.status(401).json({ error: "Admin not logged in" });
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid admin login" });
  }
}

/* ===================== BASIC ROUTES ===================== */
app.get("/api/health", (_, res) => res.json({ ok: true }));

app.get("/api/db-test", async (_, res) => {
  try {
    const [rows] = await pool.query("SELECT 1 AS test");
    res.json({ connected: true, result: rows });
  } catch (err) {
    console.error("DB TEST ERROR:", err);
    res.status(500).json({ connected: false, error: err.message });
  }
});

// Debug: confirms frontend index exists on Railway
app.get("/api/debug-files", (_, res) => {
  const indexPath = path.join(frontendDir, "index.html");
  res.json({
    frontendDir,
    indexPath,
    indexExists: fs.existsSync(indexPath),
  });
});

app.get("/api/me", (req, res) => {
  try {
    const token = req.cookies.user_token;
    if (!token) return res.json({ loggedIn: false });
    const user = jwt.verify(token, JWT_SECRET);
    return res.json({ loggedIn: true, userId: user.userId });
  } catch {
    return res.json({ loggedIn: false });
  }
});

app.get("/api/admin/me", (req, res) => {
  try {
    const token = req.cookies.admin_token;
    if (!token) return res.json({ loggedIn: false });
    const admin = jwt.verify(token, JWT_SECRET);
    return res.json({ loggedIn: true, adminId: admin.adminId });
  } catch {
    return res.json({ loggedIn: false });
  }
});

/* ===================== USER AUTH ===================== */
app.post("/api/users/signup", async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: "Missing fields" });

    const [exists] = await pool.query("SELECT id FROM users WHERE email=? LIMIT 1", [email]);
    if (exists.length) return res.status(409).json({ error: "Email already exists" });

    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      "INSERT INTO users (name,email,phone,password_hash,is_active) VALUES (?,?,?,?,1)",
      [name, email, phone || null, hash]
    );

    const token = jwt.sign({ userId: result.insertId }, JWT_SECRET, { expiresIn: "6h" });
    setCookie(res, "user_token", token);
    res.json({ ok: true, userId: result.insertId });
  } catch (e) {
    console.error("SIGNUP ERROR:", e);
    res.status(500).json({ error: "Signup failed" });
  }
});

app.post("/api/users/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const [rows] = await pool.query(
      "SELECT id,password_hash FROM users WHERE email=? AND is_active=1 LIMIT 1",
      [email]
    );
    if (!rows.length) return res.status(401).json({ error: "Invalid login" });

    const ok = await bcrypt.compare(password, rows[0].password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid login" });

    const token = jwt.sign({ userId: rows[0].id }, JWT_SECRET, { expiresIn: "6h" });
    setCookie(res, "user_token", token);

    res.json({ ok: true });
  } catch (e) {
    console.error("LOGIN ERROR:", e);
    res.status(500).json({ error: "Login failed" });
  }
});

app.post("/api/users/logout", (_, res) => {
  clearCookie(res, "user_token");
  res.json({ ok: true });
});

/* ===================== ADMIN AUTH ===================== */
app.post("/api/admin/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const [rows] = await pool.query(
      "SELECT id,password_hash FROM admin_users WHERE username=? LIMIT 1",
      [username]
    );
    if (!rows.length) return res.status(401).json({ error: "Invalid admin" });

    const ok = await bcrypt.compare(password, rows[0].password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid admin" });

    const token = jwt.sign({ adminId: rows[0].id }, JWT_SECRET, { expiresIn: "6h" });
    setCookie(res, "admin_token", token);

    res.json({ ok: true });
  } catch (e) {
    console.error("ADMIN LOGIN ERROR:", e);
    res.status(500).json({ error: "Admin login failed" });
  }
});

app.post("/api/admin/logout", (_, res) => {
  clearCookie(res, "admin_token");
  res.json({ ok: true });
});

/* ===================== PRODUCTS & SERVICES ===================== */
app.get("/api/products", async (_, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id,name,category,price,description,image_url FROM products WHERE is_active=1 ORDER BY id DESC"
    );
    res.json(rows);
  } catch (e) {
    console.error("PRODUCTS ERROR:", e);
    res.status(500).json({ error: "Failed to load products" });
  }
});

app.get("/api/services", async (req, res) => {
  try {
    const { category } = req.query;
    if (category) {
      const [rows] = await pool.query(
        "SELECT id,name,category,price,description,image_url FROM services WHERE is_active=1 AND category=? ORDER BY id DESC",
        [category]
      );
      return res.json(rows);
    }

    const [rows] = await pool.query(
      "SELECT id,name,category,price,description,image_url FROM services WHERE is_active=1 ORDER BY category,name"
    );
    res.json(rows);
  } catch (e) {
    console.error("SERVICES ERROR:", e);
    res.status(500).json({ error: "Failed to load services" });
  }
});

/* ===================== FRONTEND FALLBACK ===================== */
app.use((req, res) => {
  if (req.path.startsWith("/api")) return res.status(404).json({ error: "Not found" });
  res.sendFile(path.join(frontendDir, "index.html"));
});

/* ===================== START ===================== */
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
