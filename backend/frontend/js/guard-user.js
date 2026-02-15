// frontend/js/guard-user.js
(async function () {
  try {
    const res = await fetch("/api/me", { credentials: "include" });
    const data = await res.json().catch(() => ({ loggedIn: false }));
    if (!data.loggedIn) {
      sessionStorage.setItem("after_login_redirect", window.location.pathname);
      window.location.href = "/login.html";
    }
  } catch {
    window.location.href = "/login.html";
  }
})();
