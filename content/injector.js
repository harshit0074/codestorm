// content/injector.js — Extreme Focus Mode v4

(function () {
  "use strict";
  if (window.__EFM_LOADED__) return;
  window.__EFM_LOADED__ = true;

  // ── Thresholds (intentionally easy to trigger for testing) ──────────────────
  const THRESHOLDS = {
    scroll:  200,   // px/s
    cursor:  800,   // px/s
    typing:  8,     // keys/s
  };

  // ── State ────────────────────────────────────────────────────────────────────
  let pickMode   = false;
  let keptEls    = new Set();
  let savedStyles = [];   // [{el, style}] for full reset

  // ── Behavioral signals ───────────────────────────────────────────────────────
  let scrollSpeeds = [], lastScrollY = window.scrollY, lastScrollT = Date.now();
  let cursorSpeeds = [], lastMX = null, lastMY = null, lastMT = null;
  let keyTimes = [], lastKeyT = null;

  // ── Boot ─────────────────────────────────────────────────────────────────────
  injectResetBtn();
  startMonitor();

  // ── Message handler ──────────────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg, _, respond) => {
    switch (msg.type) {
      case "ACTIVATE_PICK":
        activatePick(); respond({ ok: true }); break;
      case "DEACTIVATE_PICK":
        deactivatePick(); respond({ ok: true }); break;
      case "CONFIRM_KEEP":
        confirmKeep(msg.settings || {}); respond({ ok: true }); break;
      case "APPLY_SETTINGS":
        applySettings(msg.settings || {}); respond({ ok: true }); break;
      case "RESET":
        resetAll(); respond({ ok: true }); break;
    }
  });

  // ────────────────────────────────────────────────────────────────────────────
  // PICK MODE (EFM)
  // ────────────────────────────────────────────────────────────────────────────
  function activatePick() {
    pickMode = true;
    document.body.style.cursor = "crosshair";
    document.addEventListener("mouseover", pickHover, true);
    document.addEventListener("mouseout",  pickOut,   true);
    document.addEventListener("click",     pickClick, true);
  }

  function deactivatePick() {
    pickMode = false;
    document.body.style.cursor = "";
    document.removeEventListener("mouseover", pickHover, true);
    document.removeEventListener("mouseout",  pickOut,   true);
    document.removeEventListener("click",     pickClick, true);
    document.querySelectorAll(".efm-hover").forEach(el => el.classList.remove("efm-hover"));
  }

  function pickHover(e) { if (!isEFM(e.target)) e.target.classList.add("efm-hover"); }
  function pickOut(e)   { e.target.classList.remove("efm-hover"); }
  function pickClick(e) {
    if (isEFM(e.target)) return;
    e.preventDefault(); e.stopPropagation();
    if (keptEls.has(e.target)) {
      keptEls.delete(e.target);
      e.target.classList.remove("efm-kept");
    } else {
      keptEls.add(e.target);
      e.target.classList.add("efm-kept");
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // CONFIRM KEEP (EFM) — hide everything not selected
  // ────────────────────────────────────────────────────────────────────────────
  function confirmKeep(settings) {
    deactivatePick();
    saveStyles();

    // Build full keep set: selected + their ancestors + their descendants
    const keep = new Set();
    keptEls.forEach(el => {
      keep.add(el);
      el.querySelectorAll("*").forEach(d => keep.add(d));
      let p = el.parentElement;
      while (p && p !== document.documentElement) { keep.add(p); p = p.parentElement; }
    });

    document.querySelectorAll("body *").forEach(el => {
      if (isEFM(el) || keep.has(el)) return;
      el.style.setProperty("display", "none", "important");
    });

    keptEls.forEach(el => el.classList.remove("efm-kept"));
    applySettings(settings);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // APPLY SETTINGS (Helix logic, adapted)
  // ────────────────────────────────────────────────────────────────────────────
  function applySettings(s) {
    saveStyles();

    if (s.img) document.querySelectorAll("img").forEach(el => el.remove());
    if (s.vid) document.querySelectorAll("video").forEach(el => el.remove());
    if (s.nav) {
      document.querySelectorAll("nav, aside, footer, header").forEach(el => {
        el.style.setProperty("display", "none", "important");
      });
    }
    if (s.text) {
      document.body.style.fontSize   = "24px";
      document.body.style.lineHeight = "2.2";
    }
    if (s.extreme) {
      document.body.style.maxWidth        = "700px";
      document.body.style.margin          = "auto";
      document.body.style.backgroundColor = "#f5f5f5";
    }

    // Helix: reading highlight on scroll
    startReadingHighlight();

    // Helix: focus lock on click (dim all, highlight clicked)
    startFocusLock();
  }

  // ── Helix: reading highlight ─────────────────────────────────────────────────
  let readingHighlightActive = false;
  function startReadingHighlight() {
    if (readingHighlightActive) return;
    readingHighlightActive = true;
    window.addEventListener("scroll", () => {
      const mid = window.innerHeight / 2;
      document.querySelectorAll("p, div, article").forEach(el => {
        if (!el.innerText || el.innerText.length < 80) return;
        if (el.classList.contains("efm-locked")) return;
        const rect = el.getBoundingClientRect();
        el.style.background = (rect.top < mid && rect.bottom > mid) ? "#ffffcc" : "";
      });
    }, { passive: true });
  }

  // ── Helix: focus lock on click ────────────────────────────────────────────────
  let focusLockActive = false;
  function startFocusLock() {
    if (focusLockActive) return;
    focusLockActive = true;
    document.addEventListener("click", (e) => {
      if (isEFM(e.target) || pickMode) return;
      document.querySelectorAll(".efm-locked").forEach(el => {
        el.classList.remove("efm-locked");
        el.style.background = "";
        el.style.opacity = "";
      });
      document.querySelectorAll("p, div, article, section").forEach(el => {
        if (!isEFM(el)) el.style.opacity = "0.25";
      });
      e.target.classList.add("efm-locked");
      e.target.style.opacity = "1";
      e.target.style.background = "#ffeb3b";
      e.target.style.padding = "4px";
      e.target.style.borderRadius = "4px";
    });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // RESET
  // ────────────────────────────────────────────────────────────────────────────
  function resetAll() {
    savedStyles.forEach(({ el, style }) => {
      if (style === null) el.removeAttribute("style");
      else el.setAttribute("style", style);
    });
    savedStyles = [];

    document.querySelectorAll(".efm-kept,.efm-hover,.efm-locked").forEach(el => {
      el.classList.remove("efm-kept","efm-hover","efm-locked");
    });

    document.body.style.cursor = "";
    pickMode = false;
    keptEls.clear();
    readingHighlightActive = false;
    focusLockActive = false;

    document.getElementById("efm-hud")?.remove();
    document.getElementById("efm-reset-btn")?.remove();

    injectResetBtn();
    chrome.storage.local.set({ focusReset: true });
  }

  function saveStyles() {
    if (savedStyles.length > 0) return;
    document.querySelectorAll("*").forEach(el => {
      savedStyles.push({ el, style: el.getAttribute("style") });
    });
  }

  function isEFM(el) {
    return !el || el.id?.startsWith?.("efm-") || !!el.closest?.("#efm-reset-btn") || !!el.closest?.("#efm-hud");
  }

  // ── Reset button (EFM, always bottom-left) ────────────────────────────────────
  function injectResetBtn() {
    if (document.getElementById("efm-reset-btn")) return;
    const btn = document.createElement("button");
    btn.id = "efm-reset-btn";
    btn.textContent = "↺ Reset";
    btn.onclick = (e) => { e.stopPropagation(); resetAll(); };
    document.body.appendChild(btn);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // BEHAVIOR MONITOR — measures scroll/cursor/typing, sends to popup
  // ────────────────────────────────────────────────────────────────────────────
  function startMonitor() {
    // Scroll speed
    window.addEventListener("scroll", () => {
      const now = Date.now(), dt = (now - lastScrollT) / 1000;
      const dy = Math.abs(window.scrollY - lastScrollY);
      if (dt > 0 && dy > 0) { scrollSpeeds.push(dy / dt); if (scrollSpeeds.length > 40) scrollSpeeds.shift(); }
      lastScrollY = window.scrollY; lastScrollT = now;
    }, { passive: true });

    // Cursor speed
    document.addEventListener("mousemove", (e) => {
      const now = Date.now();
      if (lastMX !== null) {
        const dist = Math.hypot(e.clientX - lastMX, e.clientY - lastMY);
        const dt = (now - lastMT) / 1000;
        if (dt > 0 && dt < 0.5) { cursorSpeeds.push(dist / dt); if (cursorSpeeds.length > 80) cursorSpeeds.shift(); }
      }
      lastMX = e.clientX; lastMY = e.clientY; lastMT = now;
    }, { passive: true });

    // Typing speed
    document.addEventListener("keydown", () => {
      const now = Date.now();
      if (lastKeyT !== null) { keyTimes.push(now - lastKeyT); if (keyTimes.length > 60) keyTimes.shift(); }
      lastKeyT = now;
    }, true);

    // Broadcast to popup every 3 seconds
    setInterval(broadcastMetrics, 3000);
  }

  function avg(arr) { return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0; }

  function broadcastMetrics() {
    const scrollSpeed  = avg(scrollSpeeds);
    const cursorSpeed  = avg(cursorSpeeds);
    const typingSpeed  = keyTimes.length > 1 ? 1000 / avg(keyTimes) : 0;

    const triggered = {
      scroll: scrollSpeed  > THRESHOLDS.scroll,
      cursor: cursorSpeed  > THRESHOLDS.cursor,
      typing: typingSpeed  > THRESHOLDS.typing,
    };

    const anyTriggered = triggered.scroll || triggered.cursor || triggered.typing;

    chrome.runtime.sendMessage({
      type: "BEHAVIOR_UPDATE",
      scrollSpeed,
      cursorSpeed,
      typingSpeed,
      triggered: anyTriggered ? triggered : null,
    });

    // Update on-page HUD too
    updateHUD(scrollSpeed, cursorSpeed, typingSpeed, anyTriggered, triggered);

    // Reset buffers
    scrollSpeeds = []; cursorSpeeds = []; keyTimes = [];
  }

  // ── On-page HUD (Helix-style indicator, bottom-right) ─────────────────────────
  function updateHUD(scroll, cursor, typing, alert, triggered) {
    let hud = document.getElementById("efm-hud");
    if (!hud) {
      hud = document.createElement("div");
      hud.id = "efm-hud";
      document.body.appendChild(hud);
    }

    const level = alert ? "DISTRACTED" : "FOCUSED";
    const bg    = alert ? (triggered?.scroll && triggered?.cursor ? "#c00" : "#b05000") : "green";

    hud.style.cssText = `
      position:fixed!important;bottom:20px!important;right:20px!important;
      z-index:2147483647!important;background:${bg}!important;color:#fff!important;
      padding:8px 12px!important;border-radius:6px!important;
      font-family:-apple-system,sans-serif!important;font-size:11px!important;
      font-weight:700!important;line-height:1.6!important;pointer-events:none!important;
      box-shadow:0 2px 10px rgba(0,0,0,0.3)!important;
    `;
    hud.innerHTML = `
      ${level}<br>
      <span style="font-weight:400;opacity:0.85;font-size:10px">
        scroll: ${Math.round(scroll)}px/s &nbsp;
        cursor: ${Math.round(cursor)}px/s &nbsp;
        type: ${typing.toFixed(1)}k/s
      </span>
    `;
  }

})();
