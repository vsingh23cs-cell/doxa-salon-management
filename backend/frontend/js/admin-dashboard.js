function esc(s) {
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;");
}

async function api(url, opts = {}) {
  const res = await fetch(url, {
    credentials: "include",
    ...opts,
    headers: { ...(opts.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

const apptGrid = document.getElementById("apptGrid");
const orderGrid = document.getElementById("orderGrid");
const serviceGrid = document.getElementById("serviceGrid");

document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  try { await api("/api/admin/logout", { method: "POST" }); } catch {}
  window.location.href = "admin_login.html";
});

/* ================= ORDERS ================= */

async function loadOrders() {
  if (!orderGrid) return;

  const list = await api("/api/admin/orders");

  if (!list.length) {
    orderGrid.innerHTML = `<p class="small">No orders yet.</p>`;
    return;
  }

  orderGrid.innerHTML = list.map(o => `
    <div class="card">
      <h3>Order #${o.id} • ${esc(o.customer_name)}</h3>
      <p>${esc(o.phone)} • ₹${o.total_amount}</p>
      <p class="small">Status: ${esc(o.status)}</p>
      ${
        o.payment_screenshot
          ? `<p class="small">Screenshot: <a href="${esc(o.payment_screenshot)}" target="_blank">View</a></p>`
          : ""
      }
      <div class="meta">
        <select class="input" data-order="${o.id}">
          ${["Processing","Approved","Rejected"].map(s =>
            `<option ${o.status===s?"selected":""}>${s}</option>`
          ).join("")}
        </select>
      </div>
    </div>
  `).join("");

  orderGrid.querySelectorAll("[data-order]").forEach(sel => {
    sel.addEventListener("change", async () => {
      const id = sel.getAttribute("data-order");
      await api(`/api/admin/orders/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: sel.value }),
      });
      loadOrders();
    });
  });
}

/* ================= SERVICES ================= */

function serviceRow(s) {
  return `
    <div class="card">
      <h3>${esc(s.name)}</h3>
      <p class="small">${esc(s.category)} • ₹${Number(s.price)}</p>
      <p class="small">${esc(s.description || "")}</p>
      <div class="meta">
        <a class="btn btn-soft" href="admin-edit-service.html?id=${s.id}">Edit</a>
        <button class="btn btn-danger" data-del="${s.id}">Delete</button>
      </div>
    </div>
  `;
}

async function loadServices() {
  if (!serviceGrid) return;

  const list = await api("/api/admin/services");

  if (!list.length) {
    serviceGrid.innerHTML = `<p class="small">No services yet.</p>`;
    return;
  }

  serviceGrid.innerHTML = list.map(serviceRow).join("");

  serviceGrid.querySelectorAll("[data-del]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-del");
      if (!confirm("Delete this service?")) return;
      await api(`/api/admin/services/${id}`, { method: "DELETE" });
      loadServices();
    });
  });
}

/* ================= INIT ================= */

(async function init() {
  try {
    await loadOrders();
    await loadServices();
  } catch (e) {
    if (orderGrid) orderGrid.innerHTML = `<p class="small">${esc(e.message)}</p>`;
    if (serviceGrid) serviceGrid.innerHTML = `<p class="small">${esc(e.message)}</p>`;
  }
})();
