function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

async function getServices() {
  const res = await fetch("/api/services", { credentials: "include" });
  const data = await res.json().catch(() => []);
  if (!res.ok) throw new Error(data.error || "Failed to load services");
  return data;
}

async function bookAppointment(payload) {
  const res = await fetch("/api/appointments", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Booking failed");
  return data;
}

(async function init() {
  const sel = document.getElementById("serviceSelect");
  const msg = document.getElementById("msg");
  const form = document.getElementById("form");

  try {
    const services = await getServices();
    sel.innerHTML = `<option value="">Select a service</option>` + services
      .map(s => `<option value="${s.id}">${esc(s.category)} • ${esc(s.name)} (₹${Number(s.price)})</option>`)
      .join("");

    // preselect from ?service_id=
    const params = new URLSearchParams(location.search);
    const pre = params.get("service_id");
    if (pre) sel.value = String(pre);
  } catch (e) {
    sel.innerHTML = `<option value="">❌ Start backend to load services</option>`;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.textContent = "Booking...";

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
      const r = await bookAppointment(payload);
      msg.textContent = `✅ Booked! ID: ${r.id} • Status: ${r.status || "Pending"}`;
      form.reset();
    } catch (err) {
      msg.textContent = `❌ ${err.message}`;
    }
  });
})();
