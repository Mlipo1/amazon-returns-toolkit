const $ = (id) => document.getElementById(id);
const DEFAULTS = { warnDays: 3, haWebhook: "" };

function ago(iso) {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - new Date(iso)) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return mins + "m ago";
  const h = Math.round(mins / 60);
  if (h < 24) return h + "h ago";
  return Math.round(h / 24) + "d ago";
}

function label(d) {
  if (d === null || d === undefined) return { t: "—", c: "ok" };
  if (d < 0) return { t: Math.abs(d) + "d over", c: "od" };
  if (d === 0) return { t: "today", c: "od" };
  if (d <= 3) return { t: d + "d left", c: "soon" };
  return { t: d + "d left", c: "ok" };
}

async function render() {
  const s = await chrome.storage.local.get(
    Object.assign({ lastRunAt: null, lastOk: null, lastReason: "", lastRows: [] }, DEFAULTS));

  $("meta").textContent = "Checked " + ago(s.lastRunAt) +
    (s.lastOk === false ? " · check failed" : "");

  const fail = $("fail");
  if (s.lastOk === false) {
    fail.hidden = false;
    fail.textContent = s.lastReason === "signed-out"
      ? "You're signed out of Amazon, so this can't read your returns. Sign in — it resumes on its own."
      : "Last check failed (" + (s.lastReason || "unknown") + "). Treat this as unknown, not as “nothing due”.";
  } else {
    fail.hidden = true;
  }

  const list = $("list");
  list.innerHTML = "";
  if (!s.lastRows || !s.lastRows.length) {
    list.innerHTML = '<div class="empty">' +
      (s.lastOk ? "No active returns." : "Nothing recorded yet.") + "</div>";
  } else {
    for (const r of s.lastRows) {
      const l = label(r.days);
      const div = document.createElement("div");
      div.className = "row";
      const d = document.createElement("div");
      d.className = "d " + l.c; d.textContent = l.t;
      const it = document.createElement("div");
      it.className = "it";
      it.textContent = r.item;
      if (r.by || r.rma) {
        const sm = document.createElement("div");
        sm.className = "rma";
        sm.textContent = [r.by ? "by " + r.by : "", r.rma].filter(Boolean).join("  ·  ");
        it.appendChild(sm);
      }
      div.append(d, it);
      list.appendChild(div);
    }
  }

  $("warnDays").value = s.warnDays;
  $("haWebhook").value = s.haWebhook;
}

$("check").onclick = async () => {
  $("check").textContent = "Checking…";
  $("check").disabled = true;
  try { await chrome.runtime.sendMessage({ type: "checkNow" }); } catch (e) {}
  await render();
  $("check").textContent = "Check now";
  $("check").disabled = false;
};

$("open").onclick = () => chrome.tabs.create({ url: "https://www.amazon.com/your-returns" });
$("cfg").onclick = () => { $("settings").hidden = !$("settings").hidden; };

$("save").onclick = async () => {
  const hook = $("haWebhook").value.trim();

  // The extension only holds amazon.com by default. Posting anywhere else needs
  // permission for that origin, asked for here rather than up front.
  if (hook) {
    let origin;
    try { origin = new URL(hook).origin + "/*"; }
    catch (e) {
      $("save").textContent = "Bad URL";
      setTimeout(() => ($("save").textContent = "Save"), 2000);
      return;
    }
    const has = await chrome.permissions.contains({ origins: [origin] });
    if (!has) {
      const granted = await chrome.permissions.request({ origins: [origin] });
      if (!granted) {
        $("save").textContent = "Permission denied";
        setTimeout(() => ($("save").textContent = "Save"), 2500);
        return;
      }
    }
  }

  await chrome.storage.local.set({
    warnDays: Math.max(0, Math.min(30, parseInt($("warnDays").value, 10) || 0)),
    haWebhook: hook
  });
  $("save").textContent = "Saved";
  setTimeout(() => ($("save").textContent = "Save"), 1500);
};

render();
