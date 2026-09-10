// Amazon Return Reminder -- background orchestrator.
// Runs inside your own Chrome with your own session: no stored password, no headless
// browser, nothing for Amazon to flag. One GET per check.

const ALARM = "checkReturns";
const CHECK_EVERY_MIN = 180;          // every 3h, so a closed laptop can't skip the day
const DEFAULTS = { warnDays: 3, haWebhook: "" };

// ---------- settings ----------
async function settings() {
  const s = await chrome.storage.local.get(DEFAULTS);
  return Object.assign({}, DEFAULTS, s);
}

// ---------- dates ----------
function midnight(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

// "Sep 25" has no year. Assume the nearest sensible one: anything landing far in the
// future is really last year's deadline (a Dec date seen in January, or an overdue one).
function dueDate(by, now) {
  if (!by) return null;
  const d = new Date(by + " " + now.getFullYear());
  if (isNaN(d)) return null;
  if (d - now > 180 * 86400000) d.setFullYear(d.getFullYear() - 1);
  return midnight(d);
}

function daysUntil(by, now) {
  const d = dueDate(by, now);
  if (!d) return null;
  return Math.round((d - midnight(now)) / 86400000);
}

// ---------- offscreen document (service workers have no DOMParser) ----------
async function ensureOffscreen() {
  const existing = await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"] });
  if (existing.length) return;
  try {
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: ["DOM_PARSER"],
      justification: "Parse the Amazon returns page HTML."
    });
  } catch (e) {
    if (!/already/i.test(String(e && e.message))) throw e;
  }
}

async function scrape() {
  await ensureOffscreen();
  return await chrome.runtime.sendMessage({ type: "scrapeReturns" });
}

// ---------- notifications ----------
function notify(id, title, message, buttons) {
  return chrome.notifications.create(id, {
    type: "basic",
    iconUrl: "icon128.png",
    title: title,
    message: message,
    priority: 2,
    requireInteraction: true,
    buttons: buttons || []
  });
}

chrome.notifications.onClicked.addListener((id) => {
  chrome.tabs.create({ url: "https://www.amazon.com/your-returns" });
  chrome.notifications.clear(id);
});
chrome.notifications.onButtonClicked.addListener((id) => {
  chrome.tabs.create({ url: "https://www.amazon.com/your-returns" });
  chrome.notifications.clear(id);
});

// ---------- badge ----------
function setBadge(count, overdue) {
  chrome.action.setBadgeText({ text: count ? String(count) : "" });
  chrome.action.setBadgeBackgroundColor({ color: overdue ? "#b12704" : "#e77600" });
}

// ---------- the check ----------
async function runCheck(force) {
  const cfg = await settings();
  const now = new Date();
  const today = midnight(now).toDateString();
  let res;

  try {
    res = await scrape();
  } catch (e) {
    res = { ok: false, reason: "fetch-failed", detail: String(e && e.message), rows: [] };
  }

  const store = await chrome.storage.local.get(["lastNotifyDay", "lastFailDay"]);

  // Failure must be loud. "Couldn't check" and "nothing due" must never look alike.
  if (!res || !res.ok) {
    await chrome.storage.local.set({
      lastRunAt: now.toISOString(), lastOk: false,
      lastReason: (res && res.reason) || "unknown", lastRows: []
    });
    setBadge("!", true);
    const sameDay = store.lastFailDay === today;
    if (force || !sameDay) {
      await chrome.storage.local.set({ lastFailDay: today });
      const signedOut = res && res.reason === "signed-out";
      notify("ret-fail-" + Date.now(),
        signedOut ? "Amazon: signed out" : "Amazon returns check failed",
        signedOut
          ? "Can't read your returns because you're signed out of Amazon. Sign in and it will resume on its own."
          : "Couldn't read your returns page (" + ((res && res.reason) || "unknown") + "). This is a warning, not an all-clear.",
        [{ title: "Open Amazon returns" }]);
    }
    return res;
  }

  const active = res.rows
    .filter((r) => !r.done)
    .map((r) => Object.assign({}, r, { days: daysUntil(r.by, now) }))
    .sort((a, b) => (a.days === null) - (b.days === null) || a.days - b.days);

  await chrome.storage.local.set({
    lastRunAt: now.toISOString(), lastOk: true, lastReason: "", lastRows: active
  });

  const overdue = active.filter((r) => r.days !== null && r.days < 0);
  const soon = active.filter((r) => r.days !== null && r.days >= 0 && r.days <= cfg.warnDays);
  setBadge(overdue.length + soon.length, overdue.length > 0);

  if (cfg.haWebhook) postToHA(cfg.haWebhook, active, overdue, soon).catch(() => {});

  if (!overdue.length && !soon.length) return res;
  if (!force && store.lastNotifyDay === today) return res;
  await chrome.storage.local.set({ lastNotifyDay: today });

  const short = (s) => (s.length > 46 ? s.slice(0, 45) + "…" : s);
  const line = (r) =>
    r.days < 0 ? "• " + short(r.item) + " — OVERDUE by " + Math.abs(r.days) + "d"
      : r.days === 0 ? "• " + short(r.item) + " — due TODAY"
        : "• " + short(r.item) + " — " + r.days + "d left";

  const picked = overdue.concat(soon).slice(0, 4);
  const extra = overdue.length + soon.length - picked.length;
  const title = overdue.length
    ? overdue.length + " Amazon return" + (overdue.length > 1 ? "s" : "") + " overdue"
    : soon.length + " Amazon return" + (soon.length > 1 ? "s" : "") + " due soon";

  notify("ret-" + today,
    title,
    picked.map(line).join("\n") + (extra > 0 ? "\n+ " + extra + " more" : ""),
    [{ title: "Open Amazon returns" }]);

  return res;
}

// ---------- optional Home Assistant push ----------
async function postToHA(url, active, overdue, soon) {
  const now = new Date();
  const iso = (by) => {
    const d = dueDate(by, now);
    if (!d) return null;
    // Local calendar date, not toISOString() -- that shifts across UTC.
    return d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0");
  };
  const soonest = active.filter((r) => r.days !== null)[0] || active[0] || null;

  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source: "amazon-return-reminder",
      checked_at: now.toISOString(),
      total_active: active.length,
      overdue: overdue.length,
      due_soon: soon.length,
      // Pre-flattened so Home Assistant doesn't have to template it out.
      next_item: soonest ? soonest.item.slice(0, 120) : "",
      next_due: soonest ? iso(soonest.by) : null,
      next_days_left: soonest && soonest.days !== null ? soonest.days : null,
      returns: active.map((r) => ({
        item: r.item, rma: r.rma, return_by: r.by, due_date: iso(r.by),
        days_left: r.days, status: r.status, link: r.link
      }))
    })
  });
}

// ---------- wiring ----------
async function ensureAlarm() {
  const a = await chrome.alarms.get(ALARM);
  if (!a) chrome.alarms.create(ALARM, { periodInMinutes: CHECK_EVERY_MIN, delayInMinutes: 1 });
}

chrome.runtime.onInstalled.addListener(() => { ensureAlarm(); runCheck(true); });
chrome.runtime.onStartup.addListener(() => { ensureAlarm(); runCheck(false); });
chrome.alarms.onAlarm.addListener((a) => { if (a.name === ALARM) runCheck(false); });

chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  if (msg && msg.type === "checkNow") {
    runCheck(true).then((r) => respond(r || { ok: false }));
    return true;
  }
});
