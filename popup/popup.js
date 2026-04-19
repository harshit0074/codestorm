// popup.js

// ── Elements ──────────────────────────────────────────────────────────────────
const dot         = document.getElementById("dot");
const modeTitle   = document.getElementById("mode-title");
const statusBadge = document.getElementById("status-badge");
const btnPick     = document.getElementById("btn-pick");
const btnConfirm  = document.getElementById("btn-confirm");
const btnApply    = document.getElementById("btn-apply");
const btnReset    = document.getElementById("btn-reset");
const pickHint    = document.getElementById("pick-hint");
const autoTag     = document.getElementById("auto-tag");
const monitorHint = document.getElementById("monitor-hint");

const mScroll  = document.getElementById("m-scroll");
const mCursor  = document.getElementById("m-cursor");
const mTyping  = document.getElementById("m-typing");
const barScroll = document.getElementById("bar-scroll");
const barCursor = document.getElementById("bar-cursor");
const barTyping = document.getElementById("bar-typing");

const chkImg     = document.getElementById("chk-img");
const chkVid     = document.getElementById("chk-vid");
const chkNav     = document.getElementById("chk-nav");
const chkText    = document.getElementById("chk-text");
const chkExtreme = document.getElementById("chk-extreme");

let picking = false;

// ── Thresholds (easy to test) ─────────────────────────────────────────────────
// These are intentionally low so you'll see auto-tick quickly
const THRESHOLDS = {
  scroll:  200,   // px/s  — fast scrolling
  cursor:  800,   // px/s  — fast mouse movement
  typing:  8,     // keys/s — fast typing
};

// ── Messaging ─────────────────────────────────────────────────────────────────
function send(type, extra = {}) {
  return new Promise(resolve =>
    chrome.runtime.sendMessage({ type, ...extra }, r => resolve(r || {}))
  );
}

function getSettings() {
  return {
    img:     chkImg.checked,
    vid:     chkVid.checked,
    nav:     chkNav.checked,
    text:    chkText.checked,
    extreme: chkExtreme.checked,
  };
}

// ── Pick mode (EFM) ───────────────────────────────────────────────────────────
btnPick.addEventListener("click", async () => {
  picking = !picking;
  if (picking) {
    btnPick.textContent = "✕ Cancel";
    btnPick.classList.add("active");
    btnConfirm.classList.remove("hidden");
    pickHint.textContent = "Click elements on the page you want to KEEP.";
    await send("ACTIVATE_PICK");
  } else {
    btnPick.textContent = "☞ Select Elements to Keep";
    btnPick.classList.remove("active");
    btnConfirm.classList.add("hidden");
    pickHint.textContent = "Click areas on the page you want to keep. Everything else gets hidden.";
    await send("DEACTIVATE_PICK");
  }
});

btnConfirm.addEventListener("click", async () => {
  await send("CONFIRM_KEEP", { settings: getSettings() });
  btnPick.textContent = "☞ Select Elements to Keep";
  btnPick.classList.remove("active");
  btnConfirm.classList.add("hidden");
  btnPick.disabled = true;
  picking = false;
  setFocusUI();
});

// ── Apply (Helix) ─────────────────────────────────────────────────────────────
btnApply.addEventListener("click", async () => {
  await send("APPLY_SETTINGS", { settings: getSettings() });
  setFocusUI();
});

// ── Reset ─────────────────────────────────────────────────────────────────────
btnReset.addEventListener("click", async () => {
  await send("RESET");
  resetUI();
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.focusReset?.newValue) {
    resetUI();
    chrome.storage.local.remove("focusReset");
  }
});

function setFocusUI() {
  modeTitle.textContent = "EXTREME FOCUS";
  dot.className = "dot on";
}

function resetUI() {
  modeTitle.textContent = "FOCUS MODE";
  dot.className = "dot";
  statusBadge.className = "badge hidden";
  btnPick.disabled = false;
  btnPick.textContent = "☞ Select Elements to Keep";
  btnPick.classList.remove("active");
  btnConfirm.classList.add("hidden");
  pickHint.textContent = "Click areas on the page you want to keep. Everything else gets hidden.";
  picking = false;
  autoTag.style.display = "none";
  // Unmark auto-ticked rows
  document.querySelectorAll(".check-row.auto-ticked").forEach(el => el.classList.remove("auto-ticked"));
}

// ── Behavior monitor updates from content script ──────────────────────────────
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== "BEHAVIOR_UPDATE") return;
  const { scrollSpeed, cursorSpeed, typingSpeed, triggered } = msg;

  // Update metric displays
  updateMetric(mScroll, barScroll, scrollSpeed, THRESHOLDS.scroll, 600);
  updateMetric(mCursor, barCursor, cursorSpeed, THRESHOLDS.cursor, 2000);
  updateMetric(mTyping, barTyping, typingSpeed,  THRESHOLDS.typing, 20);

  // Auto-tick logic when thresholds are exceeded
  if (triggered) {
    const { scroll, cursor, typing } = triggered;

    if (scroll) autoTick(chkImg, chkVid);   // fast scrolling → remove images/videos (less distraction)
    if (cursor) autoTick(chkNav);            // fast cursor → hide sidebars
    if (typing) autoTick(chkText);           // fast typing → big text

    // If all three hit, enable extreme mode too
    if (scroll && cursor && typing) autoTick(chkExtreme);

    // Show AUTO badge and flash dot
    if (scroll || cursor || typing) {
      autoTag.style.display = "inline";
      dot.className = "dot alert";
      statusBadge.className = "badge alert";
      statusBadge.textContent = "DISTRACTED";
      statusBadge.classList.remove("hidden");
      modeTitle.textContent = "LOW FOCUS";
    }
  } else {
    // All calm
    if (modeTitle.textContent === "LOW FOCUS") {
      dot.className = "dot on";
      statusBadge.className = "badge hidden";
      modeTitle.textContent = "EXTREME FOCUS";
    }
  }
});

function autoTick(... checkboxes) {
  checkboxes.forEach(chk => {
    if (!chk.checked) {
      chk.checked = true;
      chk.closest(".check-row").classList.add("auto-ticked");
    }
  });
}

function updateMetric(valEl, barEl, value, threshold, max) {
  const v = Math.round(value);
  valEl.textContent = v;
  const pct = Math.min(100, (v / max) * 100);
  barEl.style.width = pct + "%";

  // Colour by threshold
  valEl.className = "metric-val";
  if (v >= threshold) {
    valEl.classList.add("alert");
    barEl.style.background = "#c00";
  } else if (v >= threshold * 0.6) {
    valEl.classList.add("warn");
    barEl.style.background = "#b05000";
  } else {
    barEl.style.background = "#111";
  }
}
