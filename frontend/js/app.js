// frontend/js/app.js
// One file to power DOXA frontend pages (services, team, appointments, products, cart, checkout, order status)

function esc(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function apiGet(url) {
  const res = await fetch(url, { credentials: "include" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function apiJSON(url, body, method = "POST") {
  const res = await fetch(url, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

/* ===================== SERVICES ===================== */
function serviceCardHTML(s) {
  return `
    <div class="card card-link">
      <h3>${esc(s.name)}</h3>
      <p>${esc(s.description || "Premium service at DOXA.")}</p>
      <div class="meta">
        <span>${esc(s.category || "Service")}</span>
        <span class="gold">₹${Number(s.price || 0)}</span>
      </div>
      <div style="margin-top:12px;">
        <a class="btn ghost" href="appointment.html?service_id=${encodeURIComponent(
          s.id
        )}">Book this service</a>
      </div>
    </div>
  `;
}

async function initCategoryServices() {
  const grid = document.getElementById("servicesGrid");
  if (!grid) return;

  const category = document.body.dataset.category; // Hair/Skin/Body/Nails
  try {
    const q = category ? `?category=${encodeURIComponent(category)}` : "";
    const services = await apiGet(`/api/services${q}`);

    if (!services.length) {
      grid.innerHTML = `<p class="small muted">No services found.</p>`;
      return;
    }
    grid.innerHTML = services.map(serviceCardHTML).join("");
  } catch (e) {
    grid.innerHTML = `<p class="small">❌ ${esc(e.message)}</p>`;
  }
}

async function initExploreServices() {
  const wrap = document.getElementById("servicesWrap") || document.getElementById("exploreWrap");
  if (!wrap) return;

  try {
    const all = await apiGet("/api/services");
    if (!all.length) {
      wrap.innerHTML = `<p class="small muted">No services found.</p>`;
      return;
    }

    const groups = all.reduce((acc, s) => {
      const cat = (s.category || "Other").trim();
      (acc[cat] ||= []).push(s);
      return acc;
    }, {});

    const cats = Object.keys(groups).sort((a, b) => a.localeCompare(b));

    wrap.innerHTML = cats
      .map(
        (cat) => `
        <div style="margin:22px 0 8px;">
          <div class="section-title">
            <h2>${esc(cat)} Services</h2>
            <p>${groups[cat].length} options</p>
          </div>
          <hr class="sep"/>
          <div class="grid">
            ${groups[cat].map(serviceCardHTML).join("")}
          </div>
        </div>
      `
      )
      .join("");
  } catch (e) {
    wrap.innerHTML = `<p class="small">❌ ${esc(e.message)}</p>`;
  }
}

/* ===================== TEAM ===================== */
function memberCardHTML(m) {
  const spec = m.specialization || m.specialties || "";
  return `
    <div class="card">
      <h3>${esc(m.name)}</h3>
      <p>${esc(m.role || "")}</p>
      ${spec ? `<p class="small muted">${esc(spec)}</p>` : ""}
      <div class="meta">
        <span>${m.experience_years ? `${Number(m.experience_years)} yrs` : "DOXA"}</span>
        <span class="gold">DOXA</span>
      </div>
    </div>
  `;
}

async function initTeamPage() {
  // supports pages that have listGrid OR stylistsGrid/therapistsGrid
  const grid =
    document.getElementById("listGrid") ||
    document.getElementById("stylistsGrid") ||
    document.getElementById("therapistsGrid");

  if (!grid) return;

  const msg = document.getElementById("pageMsg") || document.getElementById("teamMsg");
  const role = document.body.dataset.role; // Stylist/Therapist (if present)

  try {
    const url = role ? `/api/team?role=${encodeURIComponent(role)}` : "/api/team";
    const list = await apiGet(url);

    grid.innerHTML = list.length
      ? list.map(memberCardHTML).join("")
      : `<p class="small muted">No team members yet.</p>`;

    if (msg) msg.textContent = "";
  } catch (e) {
    if (msg) msg.textContent = "❌ " + e.message;
    grid.innerHTML = "";
  }
}

/* ===================== APPOINTMENT ===================== */
async function initAppointmentPage() {
  const form = document.getElementById("form");
  const sel = document.getElementById("serviceSelect");
  const msg = document.getElementById("msg");
  if (!form || !sel) return;

  // load services dropdown
  try {
    const services = await apiGet("/api/services");
    sel.innerHTML = `<option value="">Select a service</option>`;
    services.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = `${s.category} • ${s.name} (₹${s.price})`;
      sel.appendChild(opt);
    });

    // preselect ?service_id
    const preId = new URLSearchParams(location.search).get("service_id");
    if (preId) sel.value = String(preId);
  } catch {
    sel.innerHTML = `<option value="">❌ Start backend to load services</option>`;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (msg) msg.textContent = "Booking...";

    const payload = {
      client_name: form.client_name.value.trim(),
      phone: form.phone.value.trim(),
      email: form.email.value.trim(),
      service_id: Number(form.service_id.value),
      appt_date: form.appt_date.value,
      appt_time: form.appt_time.value,
      notes: form.notes.value.trim(),
    };

    try {
      const data = await apiJSON("/api/appointments", payload, "POST");
      if (msg) msg.textContent = `✅ Booked! ID: ${data.id} • Status: ${data.status}`;
      form.reset();
    } catch (err) {
      if (msg) msg.textContent = `❌ ${err.message}`;
    }
  });
}

/* ===================== PRODUCTS (DB cart API based) ===================== */
function productCardHTML(p) {
  return `
    <div class="card">
      <h3>${esc(p.name)}</h3>
      <p class="small muted">${esc(p.description || "Salon-grade product.")}</p>
      <div class="meta">
        <span>${esc(p.category || "General")}</span>
        <span class="gold">₹${Number(p.price || 0)}</span>
      </div>
      <div style="margin-top:12px;">
        <button class="btn" data-add="${Number(p.id)}">Add to cart</button>
      </div>
    </div>
  `;
}

async function refreshCartCount() {
  const el = document.getElementById("cartCount");
  if (!el) return;
  try {
    const cart = await apiGet("/api/cart");
    const count = cart.reduce((sum, i) => sum + Number(i.qty || 0), 0);
    el.textContent = String(count);
  } catch {
    // not logged in -> keep 0
    el.textContent = "0";
  }
}

async function initProductsPage() {
  const grid = document.getElementById("productsGrid");
  if (!grid) return;

  const msg = document.getElementById("productsMsg");
  if (msg) msg.textContent = "Loading products...";

  try {
    const products = await apiGet("/api/products");
    if (!products.length) {
      grid.innerHTML = `<p class="small muted">No products yet.</p>`;
      if (msg) msg.textContent = "";
      return;
    }

    grid.innerHTML = products.map(productCardHTML).join("");
    if (msg) msg.textContent = "";

    grid.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-add]");
      if (!btn) return;

      const id = Number(btn.dataset.add);
      try {
        await apiJSON("/api/cart/add", { product_id: id, qty: 1 }, "POST");
        await refreshCartCount();
        if (msg) msg.textContent = "✅ Added to cart";
        setTimeout(() => msg && (msg.textContent = ""), 700);
      } catch (err) {
        if (msg) msg.textContent = "❌ " + err.message;
      }
    });

    await refreshCartCount();
  } catch (e) {
    if (msg) msg.textContent = "❌ " + e.message;
    grid.innerHTML = "";
  }
}

/* ===================== CHECKOUT ===================== */
function checkoutItemRow(i) {
  const lineTotal = Number(i.price) * Number(i.qty);
  return `
    <div class="card" style="display:flex; justify-content:space-between; gap:12px; align-items:center; margin-bottom:10px;">
      <div>
        <div style="font-weight:700;">${esc(i.name)}</div>
        <div class="small muted">₹${i.price} × ${i.qty} = ₹${lineTotal}</div>
      </div>
      <div style="display:flex; gap:8px; align-items:center;">
        <button class="btn ghost" data-dec="${i.product_id}">-</button>
        <span class="small">${i.qty}</span>
        <button class="btn ghost" data-inc="${i.product_id}">+</button>
        <button class="btn btn-danger" data-remove="${i.product_id}">Remove</button>
      </div>
    </div>
  `;
}

async function initCheckoutPage() {
  const listEl = document.getElementById("orderItems");
  const totalEl = document.getElementById("orderTotal");
  const msgEl = document.getElementById("checkoutMsg");
  const placeBtn = document.getElementById("placeOrderBtn");
  if (!listEl || !totalEl || !placeBtn) return;

  async function render() {
    try {
      const items = await apiGet("/api/cart");

      if (!items.length) {
        listEl.innerHTML = `<p class="small muted">Your cart is empty.</p>`;
        totalEl.textContent = "₹0";
        if (msgEl) msgEl.textContent = "";
        return;
      }

      const total = items.reduce((sum, i) => sum + Number(i.price) * Number(i.qty), 0);
      listEl.innerHTML = items.map(checkoutItemRow).join("");
      totalEl.textContent = `₹${total}`;
      if (msgEl) msgEl.textContent = "";

      // actions
      listEl.onclick = async (e) => {
        const inc = e.target.closest("[data-inc]");
        const dec = e.target.closest("[data-dec]");
        const rem = e.target.closest("[data-remove]");

        try {
          if (rem) {
            const product_id = Number(rem.getAttribute("data-remove"));
            await apiJSON("/api/cart/remove", { product_id }, "POST");
            return render();
          }

          if (inc || dec) {
            const product_id = Number((inc || dec).getAttribute(inc ? "data-inc" : "data-dec"));
            const item = items.find((x) => Number(x.product_id) === product_id);
            if (!item) return;

            const newQty = inc ? Number(item.qty) + 1 : Number(item.qty) - 1;
            await apiJSON("/api/cart/update", { product_id, qty: newQty }, "POST");
            return render();
          }
        } catch (err) {
          if (msgEl) msgEl.textContent = "❌ " + err.message;
        }
      };
    } catch (e) {
      if (msgEl) msgEl.textContent = "❌ " + e.message;
    }
  }

  await render();
  await refreshCartCount();

  // Place order (multipart for multer)
  placeBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    const outMsg = document.getElementById("orderMsg") || msgEl;
    if (outMsg) outMsg.textContent = "";

    // IMPORTANT: your checkout.html ids are: name/phone/email/address/payment_screenshot
    const customer_name = document.getElementById("name")?.value.trim();
    const phone = document.getElementById("phone")?.value.trim();
    const email = document.getElementById("email")?.value.trim();
    const address = document.getElementById("address")?.value.trim();
    const file = document.getElementById("payment_screenshot")?.files?.[0];

    if (!customer_name || !phone || !address) {
      if (outMsg) outMsg.textContent = "❌ Please fill Name, Phone, Address";
      return;
    }

    const fd = new FormData();
    fd.append("customer_name", customer_name);
    fd.append("phone", phone);
    if (email) fd.append("email", email);
    fd.append("address", address);
    if (file) fd.append("payment_screenshot", file);

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Order failed");

      if (outMsg) outMsg.textContent = `✅ Order placed! Order ID: ${data.orderId}`;
      await refreshCartCount();
      setTimeout(() => {
        window.location.href = `order_status.html?id=${encodeURIComponent(data.orderId)}`;
      }, 600);
    } catch (err) {
      if (outMsg) outMsg.textContent = "❌ " + err.message;
    }
  });
}

/* ===================== ORDER STATUS ===================== */
async function initOrderStatusPage() {
  const orderIdEl = document.getElementById("orderId");
  const statusEl = document.getElementById("statusMsg");
  const hintEl = document.getElementById("statusHint");
  const refreshBtn = document.getElementById("refreshBtn");

  // if those elements exist, treat it as order status page
  if (!orderIdEl || !statusEl) return;

  const id = new URLSearchParams(location.search).get("id");
  orderIdEl.textContent = id || "—";

  async function load() {
    if (!id) {
      statusEl.textContent = "❌ Missing Order ID in URL";
      if (hintEl) hintEl.textContent = "Open like: order_status.html?id=123";
      return;
    }

    statusEl.textContent = "Loading...";
    if (hintEl) hintEl.textContent = "";

    try {
      const data = await apiGet(`/api/orders/${encodeURIComponent(id)}`);
      const st = data.status || "Processing";

      if (st === "Approved") statusEl.textContent = "✅ Approved (Payment verified)";
      else if (st === "Rejected") statusEl.textContent = "❌ Rejected (Payment not verified)";
      else statusEl.textContent = "⏳ Processing (Waiting for approval)";

      if (hintEl) hintEl.textContent = `Last update: ${data.updated_at || "—"}`;
    } catch (e) {
      statusEl.textContent = "❌ " + e.message;
    }
  }

  refreshBtn?.addEventListener("click", load);
  load();
}

/* ===================== ADMIN DASHBOARD NOTE ===================== */
/*
Your admin pages already use:
- js/admin-dashboard.js
- js/admin-add-service.js
- js/admin-edit-service.js
So we don't touch those here.
*/

/* ===================== BOOT ===================== */
document.addEventListener("DOMContentLoaded", async () => {
  // services pages
  await initCategoryServices();
  await initExploreServices();

  // team pages
  await initTeamPage();

  // appointment
  await initAppointmentPage();

  // products + cart count
  await initProductsPage();
  await refreshCartCount();

  // checkout
  await initCheckoutPage();

  // order status
  await initOrderStatusPage();
});
