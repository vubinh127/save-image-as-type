// fb_video_main.js - MAIN world v7
// Facebook video URLs có pattern: fbcdn.net/v/t15.* hoặc t42.*
// PerformanceObserver bắt được các URL này (khác với chunk mp4 qua Service Worker)

(function () {
  "use strict";

  let dispatched = { sd: null, hd: null };
  let lastHref = location.href;
  // Lưu tất cả video URLs bắt được để phân loại HD/SD
  const videoUrls = [];

  function emit(sd, hd) {
    let changed = false;
    if (hd && !dispatched.hd) { dispatched.hd = hd; changed = true; }
    if (sd && !dispatched.sd) { dispatched.sd = sd; changed = true; }
    if (!changed) return;
    window.dispatchEvent(new CustomEvent("__FBDL_FOUND__", {
      detail: { sd: dispatched.sd, hd: dispatched.hd }
    }));
  }

  function reset() {
    dispatched = { sd: null, hd: null };
    videoUrls.length = 0;
  }

  // Kiểm tra URL có phải video FB không
  function isFbVideoUrl(url) {
    if (!url || !url.includes("fbcdn.net")) return false;
    // Video paths: t15.*, t42.*, t66.*
    // Ảnh paths: t39.*, t45.*, t1.* — bỏ qua
    return /\/v\/t(15|42|66)\./.test(url) || 
           (url.includes(".mp4") && url.includes("fbcdn"));
  }

  function classifyAndEmit() {
    if (videoUrls.length === 0) return;

    // Deduplicate theo base path
    const seen = new Set();
    const unique = videoUrls.filter(url => {
      try {
        const u = new URL(url);
        const base = u.origin + u.pathname;
        if (seen.has(base)) return false;
        seen.add(base);
        return true;
      } catch { return false; }
    });

    if (unique.length === 0) return;
    if (unique.length === 1) {
      // Chỉ có 1 quality
      emit(unique[0], null);
      return;
    }

    // Nếu có nhiều URLs, phân loại HD/SD
    // Facebook thường trả HD trước rồi SD, hoặc ngược lại
    // HD thường có file size lớn hơn — dùng transferSize để so sánh
    const entries = unique.map(url => {
      const entry = performance.getEntriesByName(url)[0];
      return { url, size: entry?.transferSize || entry?.encodedBodySize || 0 };
    }).sort((a, b) => b.size - a.size); // lớn nhất trước = HD

    emit(entries[entries.length - 1]?.url, entries[0]?.url);
  }

  // ── PerformanceObserver ───────────────────────────────────────────────────
  let classifyTimer = null;

  const po = new PerformanceObserver((list) => {
    list.getEntries().forEach(entry => {
      const url = entry.name;
      if (!isFbVideoUrl(url)) return;
      if (!videoUrls.includes(url)) {
        videoUrls.push(url);
      }
    });

    // Debounce: đợi 800ms sau lần bắt cuối để classify
    clearTimeout(classifyTimer);
    classifyTimer = setTimeout(classifyAndEmit, 800);
  });

  try {
    po.observe({ entryTypes: ["resource"] });
  } catch (_) {}

  // Cũng check các entries đã có sẵn (video đã load trước khi script chạy)
  setTimeout(() => {
    performance.getEntriesByType("resource").forEach(entry => {
      if (isFbVideoUrl(entry.name) && !videoUrls.includes(entry.name)) {
        videoUrls.push(entry.name);
      }
    });
    if (videoUrls.length > 0) classifyAndEmit();
  }, 500);

  // ── JSON.parse hook (fallback cho một số trường hợp) ─────────────────────
  const origParse = JSON.parse;
  JSON.parse = function(text, ...args) {
    const result = origParse.call(this, text, ...args);
    try {
      if (typeof text === "string" && text.length > 100 &&
          (text.includes("playable_url") || text.includes("hd_src") || text.includes("sd_src"))) {
        extractFromText(text);
      }
    } catch (_) {}
    return result;
  };

  function extractFromText(text) {
    const patterns = [
      { re: /"hd_src(?:_no_ratelimit)?"\s*:\s*"([^"]{20,})"/, key: "hd" },
      { re: /"browser_native_hd_url"\s*:\s*"([^"]{20,})"/,    key: "hd" },
      { re: /"playable_url_quality_hd"\s*:\s*"([^"]{20,})"/,  key: "hd" },
      { re: /"sd_src(?:_no_ratelimit)?"\s*:\s*"([^"]{20,})"/,  key: "sd" },
      { re: /"browser_native_sd_url"\s*:\s*"([^"]{20,})"/,     key: "sd" },
      { re: /"playable_url"\s*:\s*"([^"]{20,})"/,              key: "sd" },
    ];
    let sd = null, hd = null;
    for (const { re, key } of patterns) {
      const m = text.match(re);
      if (m) {
        const url = decode(m[1]);
        if (url.startsWith("http")) {
          if (key === "hd") hd = hd || url;
          else sd = sd || url;
        }
      }
    }
    if (sd || hd) emit(sd, hd);
  }

  function decode(raw) {
    return raw
      .replace(/\\u002F/gi, "/")
      .replace(/\\\//g, "/")
      .replace(/\\u0026/gi, "&")
      .replace(/\\u003D/gi, "=")
      .replace(/\\u0025/gi, "%");
  }

  // ── Reset on SPA navigate ─────────────────────────────────────────────────
  setInterval(() => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      reset();
    }
  }, 1000);

})();
