// content.js - Chỉ hiển thị toast notification từ background

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "showToast") showToast(message.message, message.type);
});

let toastEl = null, toastTimer = null;
function showToast(msg, type = "info") {
  if (!toastEl) {
    toastEl = document.createElement("div");
    Object.assign(toastEl.style, {
      position:"fixed", bottom:"24px", right:"24px", zIndex:"2147483647",
      padding:"11px 18px", borderRadius:"8px", fontSize:"13px",
      fontFamily:"system-ui,sans-serif", fontWeight:"500",
      boxShadow:"0 4px 16px rgba(0,0,0,0.25)",
      transition:"opacity 0.3s,transform 0.3s",
      opacity:"0", transform:"translateY(8px)",
      pointerEvents:"none", maxWidth:"320px", lineHeight:"1.4",
    });
    document.body.appendChild(toastEl);
  }
  const c = { info:["#1a1a2e","#e0e0ff","#4a4aff"], success:["#0d2818","#a0ffb8","#00c853"], error:["#2e0d0d","#ffb0b0","#ff3d3d"] }[type] || ["#1a1a2e","#e0e0ff","#4a4aff"];
  Object.assign(toastEl.style, { background:c[0], color:c[1], border:`1px solid ${c[2]}` });
  toastEl.textContent = msg;
  requestAnimationFrame(() => { toastEl.style.opacity="1"; toastEl.style.transform="translateY(0)"; });
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.style.opacity="0"; toastEl.style.transform="translateY(8px)"; }, 4000);
}
