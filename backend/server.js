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
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "doxa_secret";

/* ===================== PATHS ===================== */
const frontendDir = path.join(__dirname, "frontend");
const frontendPath = path.join(__dirname, "frontend");
const uploadDir = path.join(frontendDir, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

/* ===================== COOKIES ===================== */
// Railway runs on HTTPS -> set secure true in production
const isProd = process.env.NODE_ENV === "production";

const cookieOpts = {
  httpOnly: true,
  sameSite: "lax",
  secure: isProd, // true on Railway, false on localhost
  maxAge: 1000 * 60 * 60 * 6, // 6 hours
};

/* ===================== MIDDLEWARE ===================== */
app.use(
  cors({
    origin: true, // allow same origin + postman etc (ok for college project)
    credentials: true,
  })
);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve frontend and uploads
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
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
});

/* ===================== HELPERS ===================== */
function setCookie(res, name, value) {
  res.cookie(name, value, cookieOpts);
}
function clearCookie(res, name) {
  res.clearCookie(name, { ...cookieOpts, maxAge: 0 });
}

function requireUser(req, res, next) {
  try {
    const token = req.cookies.user_token;
    if (!token) return res.status(401).json({ error: "Not logged in" });
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid login" });
  }
}

function requireAdmin(req, res, next) {
  try {
    const token = req.cookies.admin_token;
    if (!token) return res.status(401).json({ error: "Admin not logged in" });
    req.admin = jwt.verify(token, JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid admin login" });
  }
}

/* ===================== BASIC ROUTES ===================== */
app.get("/api/health", (_, res) => res.json({ ok: true }));

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
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const [exists] = await pool.query(
      "SELECT id FROM users WHERE email=? LIMIT 1",
      [email]
    );
    if (exists.length) return res.status(409).json({ error: "Email already exists" });

    const hash = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      "INSERT INTO users (name,email,phone,password_hash,is_active) VALUES (?,?,?,?,1)",
      [name, email, phone || null, hash]
    );

    const token = jwt.sign({ userId: result.insertId }, JWT_SECRET, { expiresIn: "6h" });
    setCookie(res, "user_token", token);

    return res.json({ ok: true, userId: result.insertId });
  } catch (e) {
    console.error("SIGNUP ERROR:", e);
    return res.status(500).json({ error: "Signup failed" });
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

    return res.json({ ok: true });
  } catch (e) {
    console.error("LOGIN ERROR:", e);
    return res.status(500).json({ error: "Login failed" });
  }
});

app.post("/api/users/logout", (_, res) => {
  clearCookie(res, "user_token");
  return res.json({ ok: true });
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

    return res.json({ ok: true });
  } catch (e) {
    console.error("ADMIN LOGIN ERROR:", e);
    return res.status(500).json({ error: "Admin login failed" });
  }
});

app.post("/api/admin/logout", (_, res) => {
  clearCookie(res, "admin_token");
  return res.json({ ok: true });
});

/* ===================== PRODUCTS ===================== */
app.get("/api/products", async (_, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id,name,category,price,description,image_url FROM products WHERE is_active=1 ORDER BY id DESC"
    );
    return res.json(rows);
  } catch (e) {
    console.error("PRODUCTS ERROR:", e);
    return res.status(500).json({ error: "Failed to load products" });
  }
});

/* ===================== SERVICES ===================== */
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
    return res.json(rows);
  } catch (e) {
    console.error("SERVICES ERROR:", e);
    return res.status(500).json({ error: "Failed to load services" });
  }
});

/* ===================== ADMIN: SERVICES CRUD ===================== */
app.get("/api/admin/services", requireAdmin, async (_, res) => {
  const [rows] = await pool.query(
    "SELECT id,name,category,price,duration_min,description,is_active FROM services ORDER BY id DESC"
  );
  return res.json(rows);
});

app.post("/api/admin/services", requireAdmin, async (req, res) => {
  try {
    const { name, category, price, duration_min, description, is_active } = req.body;

    if (!name || !category || price == null) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const [result] = await pool.query(
      "INSERT INTO services (name,category,price,duration_min,description,is_active) VALUES (?,?,?,?,?,?)",
      [name, category, price, duration_min || null, description || null, is_active ? 1 : 1]
    );

    return res.json({ ok: true, id: result.insertId });
  } catch (e) {
    console.error("ADMIN CREATE SERVICE ERROR:", e);
    return res.status(500).json({ error: "Create service failed" });
  }
});

app.put("/api/admin/services/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, price, duration_min, description, is_active } = req.body;

    await pool.query(
      `UPDATE services
       SET name=?, category=?, price=?, duration_min=?, description=?, is_active=?
       WHERE id=?`,
      [name, category, price, duration_min || null, description || null, is_active ? 1 : 0, id]
    );

    return res.json({ ok: true });
  } catch (e) {
    console.error("ADMIN UPDATE SERVICE ERROR:", e);
    return res.status(500).json({ error: "Update service failed" });
  }
});

app.delete("/api/admin/services/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM services WHERE id=?", [id]);
    return res.json({ ok: true });
  } catch (e) {
    console.error("ADMIN DELETE SERVICE ERROR:", e);
    return res.status(500).json({ error: "Delete service failed" });
  }
});

/* ===================== TEAM MEMBERS ===================== */
app.get("/api/team", async (_, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id,name,role,specialization,experience_years,rating,photo_url FROM team_members WHERE is_active=1 ORDER BY role,name"
    );
    return res.json(rows);
  } catch {
    return res.json([]);
  }
});

/* ===================== CART ===================== */
app.post("/api/cart/add", requireUser, async (req, res) => {
  try {
    const { product_id, qty = 1 } = req.body;
    if (!product_id) return res.status(400).json({ error: "product_id required" });

    await pool.query(
      `INSERT INTO cart_items (user_id,product_id,qty)
       VALUES (?,?,?)
       ON DUPLICATE KEY UPDATE qty=qty+?`,
      [req.user.userId, product_id, qty, qty]
    );

    return res.json({ ok: true });
  } catch (e) {
    console.error("CART ADD ERROR:", e);
    return res.status(500).json({ error: "Add to cart failed" });
  }
});

app.get("/api/cart", requireUser, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.product_id, c.qty, p.name, p.price
       FROM cart_items c
       JOIN products p ON p.id = c.product_id
       WHERE c.user_id = ?`,
      [req.user.userId]
    );
    return res.json(rows);
  } catch (e) {
    console.error("GET CART ERROR:", e);
    return res.status(500).json({ error: "Failed to load cart" });
  }
});

app.post("/api/cart/remove", requireUser, async (req, res) => {
  try {
    const { product_id } = req.body;
    if (!product_id) return res.status(400).json({ error: "product_id required" });

    await pool.query("DELETE FROM cart_items WHERE user_id=? AND product_id=?", [
      req.user.userId,
      product_id,
    ]);

    return res.json({ ok: true });
  } catch (e) {
    console.error("CART REMOVE ERROR:", e);
    return res.status(500).json({ error: "Remove failed" });
  }
});

app.post("/api/cart/update", requireUser, async (req, res) => {
  try {
    const { product_id, qty } = req.body;
    if (!product_id || qty == null) {
      return res.status(400).json({ error: "product_id and qty required" });
    }

    const q = Number(qty);
    if (Number.isNaN(q)) return res.status(400).json({ error: "qty must be number" });

    if (q <= 0) {
      await pool.query("DELETE FROM cart_items WHERE user_id=? AND product_id=?", [
        req.user.userId,
        product_id,
      ]);
      return res.json({ ok: true, removed: true });
    }

    await pool.query(
      "UPDATE cart_items SET qty=? WHERE user_id=? AND product_id=?",
      [q, req.user.userId, product_id]
    );

    return res.json({ ok: true });
  } catch (e) {
    console.error("CART UPDATE ERROR:", e);
    return res.status(500).json({ error: "Update failed" });
  }
});

/* ===================== ORDERS ===================== */
app.post("/api/orders", requireUser, upload.single("payment_screenshot"), async (req, res) => {
  const { customer_name, phone, email, address } = req.body;

  if (!customer_name || !phone || !address) {
    return res.status(400).json({ error: "Name, phone and address required" });
  }

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [cart] = await conn.query(
      `SELECT c.product_id,c.qty,p.price
       FROM cart_items c
       JOIN products p ON p.id=c.product_id
       WHERE c.user_id=?`,
      [req.user.userId]
    );

    if (!cart.length) {
      await conn.rollback();
      return res.status(400).json({ error: "Cart empty" });
    }

    const total = cart.reduce((sum, i) => sum + i.qty * i.price, 0);

    const [orderResult] = await conn.query(
      `INSERT INTO orders
        (user_id,customer_name,phone,email,address,total_amount,status,payment_screenshot)
       VALUES (?,?,?,?,?,?,'Processing',?)`,
      [
        req.user.userId,
        customer_name,
        phone,
        email || null,
        address,
        total,
        req.file ? "uploads/" + req.file.filename : null,
      ]
    );

    for (const i of cart) {
      await conn.query(
        "INSERT INTO order_items (order_id,product_id,qty,price_each) VALUES (?,?,?,?)",
        [orderResult.insertId, i.product_id, i.qty, i.price]
      );
    }

    await conn.query("DELETE FROM cart_items WHERE user_id=?", [req.user.userId]);

    await conn.commit();
    return res.json({ ok: true, orderId: orderResult.insertId });
  } catch (e) {
    await conn.rollback();
    console.error("ORDER ERROR:", e);
    return res.status(500).json({ error: "Order failed" });
  } finally {
    conn.release();
  }
});

/* ===================== APPOINTMENTS ===================== */
app.post("/api/appointments", async (req, res) => {
  try {
    const { client_name, phone, email, service_id, appt_date, appt_time, notes } = req.body;

    if (!client_name || !phone || !service_id || !appt_date || !appt_time) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const [srows] = await pool.query(
      "SELECT name, category FROM services WHERE id=? LIMIT 1",
      [service_id]
    );
    if (!srows.length) return res.status(400).json({ error: "Invalid service" });

    const [result] = await pool.query(
      `INSERT INTO appointments
       (client_name, phone, email, service_id, service_name, category, appt_date, appt_time, notes, status)
       VALUES (?,?,?,?,?,?,?,?,?, 'Pending')`,
      [
        client_name,
        phone,
        email || null,
        service_id,
        srows[0].name,
        srows[0].category,
        appt_date,
        appt_time,
        notes || null,
      ]
    );

    return res.json({ ok: true, id: result.insertId, status: "Pending" });
  } catch (e) {
    console.error("APPOINTMENT ERROR:", e);
    return res.status(500).json({ error: "Appointment failed" });
  }
});

app.get("/api/admin/appointments", requireAdmin, async (_, res) => {
  const [rows] = await pool.query(
    "SELECT * FROM appointments ORDER BY appt_date DESC, appt_time DESC"
  );
  return res.json(rows);
});

app.patch("/api/admin/appointments/:id/status", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const allowed = ["Pending", "Confirmed", "Rejected", "Completed"];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  await pool.query("UPDATE appointments SET status=? WHERE id=?", [status, id]);
  return res.json({ ok: true });
});

/* ===================== ADMIN ORDERS ===================== */
app.get("/api/admin/orders", requireAdmin, async (_, res) => {
  const [rows] = await pool.query("SELECT * FROM orders ORDER BY created_at DESC");
  return res.json(rows);
});

app.patch("/api/admin/orders/:id/status", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const allowed = ["Processing", "Approved", "Rejected"];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  await pool.query("UPDATE orders SET status=? WHERE id=?", [status, id]);
  return res.json({ ok: true });
});

app.get("/api/orders/:id", requireUser, async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query(
      "SELECT id,status,updated_at FROM orders WHERE id=? AND user_id=? LIMIT 1",
      [id, req.user.userId]
    );

    if (!rows.length) return res.status(404).json({ error: "Order not found" });

    res.json(rows[0]);
  } catch (e) {
    console.error("GET ORDER STATUS ERROR:", e);
    res.status(500).json({ error: "Failed to load order status" });
  }
});

/* ===================== FRONTEND FALLBACK ===================== */
app.use((req, res) => {
  if (req.path.startsWith("/api")) return res.status(404).json({ error: "Not found" });
  res.sendFile(path.join(frontendDir, "index.html"));
});

/* ===================== START ===================== */
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
