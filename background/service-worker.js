// background/service-worker.js

chrome.runtime.onInstalled.addListener(() => console.log("[EFM] installed v4"));

const FORWARD = ["ACTIVATE_PICK","DEACTIVATE_PICK","CONFIRM_KEEP","APPLY_SETTINGS","RESET"];

async function activeTab() {
  const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
  return t || null;
}

chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  // Content → popup relay
  if (msg.type === "BEHAVIOR_UPDATE") {
    chrome.runtime.sendMessage(msg).catch(() => {});
    respond({ ok: true });
    return false;
  }

  // Popup → content
  if (FORWARD.includes(msg.type)) {
    activeTab().then(tab => {
      if (!tab) return respond({ ok: false });
      chrome.tabs.sendMessage(tab.id, msg, r => respond(r || { ok: true }));
    });
    return true;
  }

  respond({ ok: false });
});
