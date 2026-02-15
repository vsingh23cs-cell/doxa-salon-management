// frontend/js/admin-login.js
function redirectAfterLogin(defaultPage = "products.html") {
  const next = sessionStorage.getItem("after_login_redirect");
  sessionStorage.removeItem("after_login_redirect");
  window.location.href = next || defaultPage;
}

async function api(path, body) {
  const res = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function onLogin() {
  const username = document.getElementById("u")?.value.trim();
  const password = document.getElementById("p")?.value.trim();
  const msg = document.getElementById("msg");
  if (msg) msg.textContent = "";

  try {
    await api("/api/admin/login", { username, password });
    if (msg) msg.textContent = "✅ Logged in";

    // ✅ your requested line
    setTimeout(() => redirectAfterLogin("products.html"), 300);

  } catch (e) {
    if (msg) msg.textContent = e.message;
  }
}

document.getElementById("loginBtn")?.addEventListener("click", onLogin);

document.getElementById("adminLoginForm")?.addEventListener("submit", (e) => {
  e.preventDefault();
  onLogin();
});
