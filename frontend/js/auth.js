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

/* ================= USER LOGIN ================= */
document.getElementById("userLoginBtn")?.addEventListener("click", async () => {
  const email = loginEmail.value.trim();
  const password = loginPassword.value.trim();
  const msg = loginMsg;

  msg.textContent = "";
  try {
    await api("/api/users/login", { email, password });
    msg.textContent = "✅ Login successful";
    setTimeout(() => (window.location.href = "products.html"), 500);
  } catch (e) {
    msg.textContent = e.message;
  }
});

/* ================= USER SIGNUP ================= */
document.getElementById("userSignupBtn")?.addEventListener("click", async () => {
  const name = signupName.value.trim();
  const email = signupEmail.value.trim();
  const phone = signupPhone.value.trim();
  const password = signupPassword.value.trim();
  const msg = signupMsg;

  msg.textContent = "";
  try {
    await api("/api/users/signup", { name, email, phone, password });
    msg.textContent = "✅ Account created";
    setTimeout(() => (window.location.href = "products.html"), 500);
  } catch (e) {
    msg.textContent = e.message;
  }
});

/* ================= ADMIN LOGIN ================= */
document.getElementById("adminLoginBtn")?.addEventListener("click", async () => {
  const username = adminUsername.value.trim();
  const password = adminPassword.value.trim();
  const msg = adminLoginMsg;

  msg.textContent = "";
  try {
    await api("/api/admin/login", { username, password });
    window.location.href = "admin-dashboard.html";
  } catch (e) {
    msg.textContent = e.message;
  }
});
