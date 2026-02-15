function esc(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;");
}

async function api(url, opts={}){
  const res = await fetch(url,{
    credentials:"include",
    ...opts,
    headers:{ ...(opts.headers||{}) }
  });
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

document.getElementById("logoutBtn")?.addEventListener("click", async()=>{
  try{ await api("/api/admin/logout",{method:"POST"});}catch{}
  window.location.href="admin_login.html";
});

document.getElementById("createBtn")?.addEventListener("click", async()=>{
  const msg=document.getElementById("msg");
  msg.textContent="";

  const name=document.getElementById("name").value.trim();
  const category=document.getElementById("category").value.trim();
  const price=Number(document.getElementById("price").value);
  const duration_min=Number(document.getElementById("duration_min")?.value||0);
  const description=document.getElementById("description").value.trim();
  const is_active=document.getElementById("is_active")?.checked?1:1;

  if(!name || !category || Number.isNaN(price)){
    msg.textContent="❌ Name, category, valid price required";
    return;
  }

  try{
    await api("/api/admin/services",{
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body:JSON.stringify({name,category,price,duration_min,description,is_active})
    });

    msg.textContent="✅ Service created";
    setTimeout(()=>location.href="admin-dashboard.html",500);
  }catch(e){
    msg.textContent=esc(e.message);
  }
});
