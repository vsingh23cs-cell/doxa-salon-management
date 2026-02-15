function esc(s){ 
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;");
}

async function apiGet(url) {
  const res = await fetch(url, { credentials: "include" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function apiPost(url, body) {
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function refreshCartCount() {
  try {
    const cart = await apiGet("/api/cart");
    const count = cart.reduce((sum, i) => sum + Number(i.qty || 0), 0);
    const el = document.getElementById("cartCount");
    if (el) el.textContent = String(count);
  } catch {
    const el = document.getElementById("cartCount");
    if (el) el.textContent = "0";
  }
}

function productCardHTML(p) {
  return `
    <div class="card">
      <h3>${esc(p.name)}</h3>
      <p>${esc(p.description || "Salon-grade product.")}</p>
      <div class="meta">
        <span>${esc(p.category || "General")}</span>
        <span class="gold">₹${Number(p.price)}</span>
      </div>
      <div style="margin-top:12px;">
        <button class="btn" data-add="${p.id}">Add to Cart</button>
      </div>
    </div>
  `;
}

(async function init() {
  const grid = document.getElementById("productsGrid");
  const msg = document.getElementById("productsMsg");

  try {
    const products = await apiGet("/api/products");
    if (!products.length) {
      msg.textContent = "No products available yet.";
      grid.innerHTML = "";
      return;
    }

    msg.textContent = "";
    grid.innerHTML = products.map(productCardHTML).join("");

    grid.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-add]");
      if (!btn) return;

      const product_id = Number(btn.dataset.add);
      try {
        await apiPost("/api/cart/add", { product_id, qty: 1 });
        await refreshCartCount();
        msg.textContent = "✅ Added to cart";
        setTimeout(() => (msg.textContent = ""), 800);
      } catch (err) {
        msg.textContent = "❌ " + err.message + " (Login required)";
      }
    });

    await refreshCartCount();
  } catch (e) {
    msg.textContent = "❌ " + e.message;
    grid.innerHTML = "";
  }
})();
