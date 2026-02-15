async function getTeam(role) {
  const url = role ? `/api/team?role=${encodeURIComponent(role)}` : `/api/team`;
  const res = await fetch(url, { credentials: "include" });
  const data = await res.json().catch(() => []);
  if (!res.ok) throw new Error(data.error || "Failed to load team");
  return data;
}

function esc(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function memberCard(m) {
  return `
    <div class="card">
      <h3>${esc(m.name)}</h3>
      <p class="small">${esc(m.role || "")}</p>
      <p class="small muted">${esc(m.specialization || m.specialties || "")}</p>
      <div class="meta">
        <span>${m.experience_years ? `${Number(m.experience_years)} yrs` : "DOXA"}</span>
        <span class="gold">DOXA</span>
      </div>
    </div>
  `;
}

(async function init() {
  const msg = document.getElementById("pageMsg") || document.getElementById("teamMsg");
  const grid = document.getElementById("listGrid") || document.getElementById("stylistsGrid") || document.getElementById("therapistsGrid");

  try {
    const role = document.body.dataset.role; // Stylist/Therapist
    const list = await getTeam(role);
    grid.innerHTML = list.length ? list.map(memberCard).join("") : `<p class="small">No team members yet.</p>`;
    if (msg) msg.textContent = "";
  } catch (e) {
    if (msg) msg.textContent = "Backend not running or /api/team not reachable.";
    if (grid) grid.innerHTML = "";
  }
})();
