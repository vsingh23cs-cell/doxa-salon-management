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

async function init() {
  const itemsEl = document.getElementById("orderItems");
  const totalEl = document.getElementById("orderTotal");
  const checkoutMsg = document.getElementById("checkoutMsg");
  const form = document.getElementById("checkoutForm");

  // load cart
  let cart = [];
  try {
    cart = await apiGet("/api/cart");
  } catch (e) {
    checkoutMsg.textContent = "❌ " + e.message + " (Login required)";
    return;
  }

  if (!cart.length) {
    itemsEl.innerHTML = `<p class="small">Cart is empty.</p>`;
    totalEl.textContent = "₹0";
    return;
  }

  let total = 0;
  itemsEl.innerHTML = cart.map(i => {
    const line = Number(i.price) * Number(i.qty);
    total += line;
    return `
      <div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid rgba(255,255,255,.08);">
        <div>
          <b>${esc(i.name)}</b><br/>
          <span class="small">₹${Number(i.price)} × ${Number(i.qty)}</span>
        </div>
        <div><b>₹${line}</b></div>
      </div>
    `;
  }).join("");

  totalEl.textContent = `₹${total}`;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    checkoutMsg.textContent = "Placing order...";

    const customer_name = document.getElementById("customerName").value.trim();
    const phone = document.getElementById("customerPhone").value.trim();
    const email = document.getElementById("customerEmail").value.trim();
    const address = document.getElementById("customerAddress").value.trim();
    const file = document.getElementById("paymentScreenshot").files[0] || null;

    if (!customer_name || !phone || !address) {
      checkoutMsg.textContent = "❌ Name, phone and address are required";
      return;
    }

    const fd = new FormData();
    fd.append("customer_name", customer_name);
    fd.append("phone", phone);
    fd.append("email", email);
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

      checkoutMsg.textContent = `✅ Order placed! Order ID: ${data.orderId}`;
      setTimeout(() => {
        window.location.href = `order_status.html?id=${encodeURIComponent(data.orderId)}`;
      }, 600);
    } catch (err) {
      checkoutMsg.textContent = "❌ " + err.message;
    }
  });
}

init();
