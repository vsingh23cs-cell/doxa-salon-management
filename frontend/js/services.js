// frontend/js/service.js
async function getServices() {
  const res = await fetch("/api/services", { credentials: "include" });
  const data = await res.json().catch(() => []);
  if (!res.ok) throw new Error(data.error || "Failed to load services");
  return data;
}

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function serviceCard(s) {
  return `
    <div class="card card-link">
      <h3>${esc(s.name)}</h3>
      <p>${esc(s.description || "Premium service at DOXA.")}</p>
      <div class="meta">
        <span>${esc(s.category)}</span>
        <span class="gold">₹${Number(s.price)}</span>
      </div>
      ${s.duration_min ? `<p class="small muted">Duration: ${Number(s.duration_min)} min</p>` : ""}
      <div style="margin-top:12px;">
        <button class="btn ghost" data-book="${s.id}">Book this service</button>
      </div>
    </div>
  `;
}

(async function init() {
  const wrap = document.getElementById("servicesWrap");
  if (!wrap) return;

  try {
    const services = await getServices();

    if (!services.length) {
      wrap.innerHTML = `<p class="small muted">No services available right now.</p>`;
      return;
    }

    // group by category
    const groups = services.reduce((acc, s) => {
      const cat = String(s.category || "Other").trim() || "Other";
      (acc[cat] ||= []).push(s);
      return acc;
    }, {});

    // sort categories + services
    const categories = Object.keys(groups).sort((a, b) => a.localeCompare(b));
    categories.forEach((cat) => {
      groups[cat].sort((x, y) => String(x.name).localeCompare(String(y.name)));
    });

    wrap.innerHTML = categories
      .map(
        (cat) => `
        <h2 style="margin-top:26px;">${esc(cat)} Services</h2>
        <div class="grid">
          ${groups[cat].map(serviceCard).join("")}
        </div>
      `
      )
      .join("");

    wrap.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-book]");
      if (!btn) return;
      const id = btn.getAttribute("data-book");
      window.location.href = `appointment.html?service_id=${encodeURIComponent(id)}`;
    });
  } catch (e) {
    wrap.innerHTML = `<p class="small">❌ ${esc(e.message)}</p>`;
  }
})();
