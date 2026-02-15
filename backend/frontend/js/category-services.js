function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

async function getServices(category) {
  const q = category ? `?category=${encodeURIComponent(category)}` : "";
  const res = await fetch(`/api/services${q}`, { credentials: "include" });
  const data = await res.json().catch(() => []);
  if (!res.ok) throw new Error(data.error || "Failed to load services");
  return data;
}

function serviceCard(s) {
  return `
    <div class="card">
      <h3>${esc(s.name)}</h3>
      <p>${esc(s.description || "Premium service at DOXA.")}</p>
      <div class="meta">
        <span>${esc(s.category || "")}</span>
        <span class="gold">₹${Number(s.price)}</span>
      </div>
      <div style="margin-top:12px;">
        <a class="btn ghost" href="appointment.html?service_id=${encodeURIComponent(s.id)}">Book this service</a>
      </div>
    </div>
  `;
}

(async function init() {
  const category = document.body.dataset.category || "";
  const grid = document.getElementById("servicesGrid");
  const msg = document.getElementById("pageMsg");
  const title = document.getElementById("servicesTitle");

  if (title && category) title.textContent = `${category} Services`;

  try {
    const list = await getServices(category);

    grid.innerHTML = list.length
      ? list.map(serviceCard).join("")
      : `<p class="small">No services found for ${esc(category)}.</p>`;

    if (msg) msg.textContent = "";
  } catch (e) {
    if (msg) msg.textContent = `❌ ${e.message}`;
    grid.innerHTML = "";
  }
})();
