// fb_video_isolated.js - ISOLATED world v7
// Đặt nút download NGOÀI video container, fixed position theo vị trí video
// để tránh bị Facebook bắt click event.

(function () {
  "use strict";

  let found = { sd: null, hd: null };
  let btnContainer = null; // container fixed trên màn hình
  let updateTimer = null;
  let styleInjected = false;

  // ── Nhận URLs ─────────────────────────────────────────────────────────────
  window.addEventListener("__FBDL_FOUND__", (e) => {
    const { sd, hd } = e.detail || {};
    if (hd && !found.hd) found.hd = hd;
    if (sd && !found.sd) found.sd = sd;
    if (!found.sd && !found.hd) return;
    showButtons();
  });

  // ── Reset on navigate ─────────────────────────────────────────────────────
  let lastHref = location.href;
  setInterval(() => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      found = { sd: null, hd: null };
      hideButtons();
    }
  }, 1000);

  // ── Tạo container fixed position ──────────────────────────────────────────
  function getContainer() {
    if (btnContainer) return btnContainer;
    injectStyles();

    btnContainer = document.createElement("div");
    btnContainer.id = "__fbdl_container__";
    document.body.appendChild(btnContainer);
    return btnContainer;
  }

  function showButtons() {
    injectStyles();
    const container = getContainer();
    container.innerHTML = "";

    if (found.hd) container.appendChild(makeBtn("⬇ HD", "hd", found.hd));
    if (found.sd) container.appendChild(makeBtn("⬇ SD", "sd", found.sd));

    container.style.display = "flex";

    // Cập nhật vị trí theo video đang active
    positionNearVideo();
    startPositionTracking();
  }

  function hideButtons() {
    if (btnContainer) btnContainer.style.display = "none";
    stopPositionTracking();
  }

  // ── Tìm video đang play và đặt nút cạnh nó ───────────────────────────────
  function getActiveVideo() {
    const videos = Array.from(document.querySelectorAll("video"));
    // Ưu tiên video đang play
    const playing = videos.find(v => !v.paused && v.readyState > 1);
    if (playing) return playing;
    // Fallback: video lớn nhất trên màn hình
    return videos.sort((a, b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      return (rb.width * rb.height) - (ra.width * ra.height);
    })[0] || null;
  }

  function positionNearVideo() {
    if (!btnContainer) return;
    const video = getActiveVideo();
    if (!video) {
      // Không tìm thấy video → đặt góc trên phải màn hình
      Object.assign(btnContainer.style, {
        top: "70px",
        left: "16px",
        right: "auto",
      });
      return;
    }

    const rect = video.getBoundingClientRect();
    const scrollY = window.scrollY || 0;
    const scrollX = window.scrollX || 0;

    // Đặt nút ở góc trên trái của video, offset một chút ra ngoài
    Object.assign(btnContainer.style, {
      top: `${Math.max(8, rect.top + scrollY + 10)}px`,
      left: `${Math.max(8, rect.left + scrollX + 10)}px`,
      right: "auto",
    });
  }

  // Track vị trí liên tục (video có thể scroll)
  let positionInterval = null;
  function startPositionTracking() {
    stopPositionTracking();
    positionInterval = setInterval(positionNearVideo, 500);
  }
  function stopPositionTracking() {
    if (positionInterval) { clearInterval(positionInterval); positionInterval = null; }
  }

  // ── Tạo nút ──────────────────────────────────────────────────────────────
  function makeBtn(label, quality, url) {
    const btn = document.createElement("button");
    btn.className = `__fbdl_btn__ ${quality}`;
    btn.textContent = label;
    btn.title = `Tải video ${quality.toUpperCase()}`;

    // Dùng mousedown thay vì click để bắt trước FB
    btn.addEventListener("mousedown", (e) => {
      e.stopImmediatePropagation();
      e.stopPropagation();
      e.preventDefault();
    }, true);

    btn.addEventListener("click", (e) => {
      e.stopImmediatePropagation();
      e.stopPropagation();
      e.preventDefault();
      doDownload(url, quality);
    }, true);

    return btn;
  }

  function doDownload(url, quality) {
    try {
      if (!chrome.runtime?.id) throw new Error("context invalid");
      chrome.runtime.sendMessage(
        { action: "downloadVideo", url, filename: `fb_video_${quality}.mp4` },
        (resp) => {
          if (chrome.runtime.lastError || !resp?.success) {
            window.open(url, "_blank");
          }
        }
      );
    } catch (_) {
      window.open(url, "_blank");
    }
  }

  // ── Styles ────────────────────────────────────────────────────────────────
  function injectStyles() {
    if (styleInjected) return;
    styleInjected = true;
    const s = document.createElement("style");
    s.id = "__fbdl_style__";
    s.textContent = `
      #__fbdl_container__ {
        position: absolute !important;
        z-index: 2147483647 !important;
        display: none;
        gap: 6px !important;
        pointer-events: none !important;
        /* Đặt ngoài shadow DOM của FB, không bị overflow hidden */
      }
      .__fbdl_btn__ {
        pointer-events: all !important;
        display: inline-flex !important;
        align-items: center !important;
        padding: 7px 14px !important;
        border-radius: 20px !important;
        border: none !important;
        cursor: pointer !important;
        font-size: 12px !important;
        font-weight: 700 !important;
        font-family: system-ui, sans-serif !important;
        letter-spacing: 0.03em !important;
        box-shadow: 0 2px 12px rgba(0,0,0,0.6) !important;
        transition: transform 0.12s, opacity 0.12s !important;
        white-space: nowrap !important;
        user-select: none !important;
        -webkit-user-select: none !important;
        position: relative !important;
        /* Tạo stacking context riêng để nằm trên FB elements */
        isolation: isolate !important;
      }
      .__fbdl_btn__:hover {
        transform: scale(1.07) !important;
        opacity: 0.9 !important;
      }
      .__fbdl_btn__.hd {
        background: linear-gradient(135deg,#6c63ff,#3ecfff) !important;
        color: #fff !important;
      }
      .__fbdl_btn__.sd {
        background: linear-gradient(135deg,#f7971e,#ffd200) !important;
        color: #111 !important;
      }
    `;
    (document.head || document.documentElement).appendChild(s);
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    injectStyles();
    getContainer(); // pre-create
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  // Retry show nếu URLs đã có sẵn sau navigate
  [1500, 3000].forEach(ms => setTimeout(() => {
    if (found.sd || found.hd) showButtons();
  }, ms));

})();
