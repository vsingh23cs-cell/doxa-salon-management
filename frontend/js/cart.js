// frontend/js/cart.js
function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

async function getCart() {
  const res = await fetch("/api/cart", { credentials: "include" });
  const data = await res.json().catch(() => []);
  if (!res.ok) throw new Error(data.error || "Failed to load cart");
  return data;
}

async function postJSON(url, body) {
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
  const el = document.getElementById("cartCount");
  if (!el) return;
  try {
    const items = await getCart();
    el.textContent = String(items.reduce((s, i) => s + Number(i.qty || 0), 0));
  } catch {
    el.textContent = "0";
  }
}

function row(item) {
  const total = Number(item.price) * Number(item.qty);
  return `
    <div class="card" style="display:flex; justify-content:space-between; gap:12px; align-items:center;">
      <div>
        <h3 style="margin:0;">${esc(item.name)}</h3>
        <p class="small muted" style="margin:4px 0;">₹${item.price} × ${item.qty} = ₹${total}</p>
      </div>

      <div style="display:flex; gap:8px; align-items:center;">
        <button class="btn ghost" data-dec="${item.product_id}">-</button>
        <span class="small">${item.qty}</span>
        <button class="btn ghost" data-inc="${item.product_id}">+</button>
        <button class="btn btn-danger" data-remove="${item.product_id}">Remove</button>
      </div>
    </div>
  `;
}

async function render() {
  const wrap = document.getElementById("cartWrap");
  if (!wrap) return;

  try {
    const items = await getCart();
    await refreshCartCount();

    if (!items.length) {
      wrap.innerHTML = `
        <p class="small muted">Your cart is empty.</p>
        <a class="btn" href="products.html">Go to Products</a>
      `;
      return;
    }

    const grandTotal = items.reduce((sum, i) => sum + (i.price * i.qty), 0);

    wrap.innerHTML = `
      <div class="grid">
        ${items.map(row).join("")}
      </div>
      <hr class="sep" style="margin:18px 0;"/>
      <div class="row" style="justify-content:space-between;">
        <b>Grand Total</b>
        <b>₹${grandTotal}</b>
      </div>
      <div style="margin-top:14px;">
        <a class="btn" href="checkout.html">Proceed to Checkout</a>
      </div>
    `;

    wrap.onclick = async (e) => {
      const inc = e.target.closest("[data-inc]");
      const dec = e.target.closest("[data-dec]");
      const rem = e.target.closest("[data-remove]");

      if (rem) {
        const product_id = Number(rem.getAttribute("data-remove"));
        await postJSON("/api/cart/remove", { product_id });
        return render();
      }

      if (inc || dec) {
        const product_id = Number(
          (inc || dec).getAttribute(inc ? "data-inc" : "data-dec")
        );
        const item = items.find((i) => Number(i.product_id) === product_id);
        if (!item) return;

        const newQty = inc ? item.qty + 1 : item.qty - 1;
        await postJSON("/api/cart/update", { product_id, qty: newQty });
        return render();
      }
    };
  } catch (e) {
    wrap.innerHTML = `<p class="small">${esc(e.message)}</p>`;
  }
}

render();
