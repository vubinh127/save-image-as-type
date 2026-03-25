// background.js - Service Worker
// Toàn bộ convert ảnh xảy ra ở đây, không cần qua content script.

const IMAGE_TYPES = [
  { id: "save_as_jpeg", label: "Save Image as JPEG", format: "image/jpeg", ext: "jpg",  quality: 0.92 },
  { id: "save_as_png",  label: "Save Image as PNG",  format: "image/png",  ext: "png",  quality: 1.0  },
  { id: "save_as_webp", label: "Save Image as WebP", format: "image/webp", ext: "webp", quality: 0.92 },
  { id: "save_as_avif", label: "Save Image as AVIF", format: "image/avif", ext: "avif", quality: 0.80 },
];

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "save_image_as_type",
    title: "Save Image As Type",
    contexts: ["image"],
  });
  IMAGE_TYPES.forEach(({ id, label }) => {
    chrome.contextMenus.create({
      id,
      parentId: "save_image_as_type",
      title: label,
      contexts: ["image"],
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const cfg = IMAGE_TYPES.find(t => t.id === info.menuItemId);
  if (!cfg || !info.srcUrl) return;
  notify(tab.id, `🔄 Đang chuyển sang ${cfg.ext.toUpperCase()}...`, "info");
  convertAndDownload(info.srcUrl, cfg, tab.id);
});

async function convertAndDownload(srcUrl, { format, ext, quality }, tabId) {
  try {
    // Fetch ảnh — service worker không bị CORS
    const resp = await fetch(srcUrl, { credentials: "omit", headers: { Accept: "image/*,*/*" } });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const blob = await resp.blob();

    // Decode → OffscreenCanvas → convert
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d");
    if (format === "image/jpeg") { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, bitmap.width, bitmap.height); }
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();

    let outBlob;
    try {
      outBlob = await canvas.convertToBlob({ type: format, quality });
    } catch {
      // AVIF không support → fallback WebP
      outBlob = await canvas.convertToBlob({ type: "image/webp", quality });
      ext = "webp";
    }

    // Convert sang dataUrl để dùng với chrome.downloads
    const dataUrl = await new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = () => res(reader.result);
      reader.onerror = rej;
      reader.readAsDataURL(outBlob);
    });

    const base = stripExt(nameFromUrl(srcUrl)) || "image";
    chrome.downloads.download({ url: dataUrl, filename: `${base}.${ext}`, saveAs: false }, id => {
      if (chrome.runtime.lastError) notify(tabId, `✗ ${chrome.runtime.lastError.message}`, "error");
      else notify(tabId, `✓ Đã lưu: ${base}.${ext}`, "success");
    });

  } catch (err) {
    notify(tabId, `✗ ${err.message}`, "error");
  }
}

function nameFromUrl(url) {
  try { return decodeURIComponent(new URL(url).pathname.split("/").pop().split("?")[0]); }
  catch { return "image"; }
}
function stripExt(name) { return name.replace(/\.[^/.]+$/, ""); }
function notify(tabId, message, type) {
  chrome.tabs.sendMessage(tabId, { action: "showToast", message, type }).catch(() => {});
}
