const $ = (id) => document.getElementById(id);
const KEY = "amazonReturnsEmails";

let ROWS = [];
let TOS = [];
let ACCT = "";
let TEXT = "";

const esc = (s) => String(s).replace(/[&<>"]/g, (m) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));

const midnight = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

function daysLeft(by, now) {
  if (!by) return null;
  const d = new Date(by + " " + now.getFullYear());
  if (isNaN(d)) return null;
  if (d - now > 15552000000) d.setFullYear(d.getFullYear() - 1);
  return Math.round((midnight(d) - midnight(now)) / 86400000);
}

// ---------- recipients ----------
const valid = (v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);

async function loadTOS() {
  const s = await chrome.storage.local.get({ [KEY]: null });
  return s[KEY];   // null = never configured, [] = deliberately emptied
}
const saveTOS = () => chrome.storage.local.set({ [KEY]: TOS });

function addAddr(v) {
  v = (v || "").trim();
  if (!v) return "";
  if (!valid(v)) return "That doesn't look like an email address.";
  if (TOS.some((e) => e.toLowerCase() === v.toLowerCase())) return "Already on the list.";
  TOS.push(v); saveTOS(); renderRec();
  return "";
}

function renderRec() {
  let h = '<span class="rl">Send to:</span>';
  if (!TOS.length) h += '<span class="none">nobody yet — add an address</span>';
  // Remove by value, never by index: a re-render reorders and a stale index
  // deletes the wrong recipient.
  TOS.forEach((e) => {
    h += '<span class="chip">' + esc(e) +
      (e.toLowerCase() === (ACCT || "").toLowerCase() ? ' <i>Amazon account</i>' : "") +
      '<b data-e="' + esc(e) + '" title="remove">&times;</b></span>';
  });
  h += '<input id="addr" placeholder="add another address" size="20">' +
       '<button id="add" class="sm">Add</button>';
  if (ACCT && !TOS.some((e) => e.toLowerCase() === ACCT.toLowerCase())) {
    h += '<button id="useacct" class="sm" title="the address on your Amazon account">+ ' + esc(ACCT) + "</button>";
  }
  $("rec").innerHTML = h;

  $("mail").textContent = TOS.length
    ? "Email to " + (TOS.length === 1 ? TOS[0] : TOS.length + " recipients")
    : "Email";

  $("add").onclick = () => {
    const msg = addAddr($("addr").value);
    if (msg) { $("tip").style.display = "block"; $("tip").textContent = msg; }
    else { $("tip").style.display = "none"; }
  };
  $("addr").onkeydown = (ev) => {
    if (ev.key === "Enter") { ev.preventDefault(); $("add").click(); }
  };
  const ua = $("useacct");
  if (ua) ua.onclick = () => addAddr(ACCT);
  [].slice.call(document.querySelectorAll(".chip b")).forEach((x) => {
    x.onclick = function () {
      const v = this.getAttribute("data-e");
      TOS = TOS.filter((e) => e !== v);
      saveTOS(); renderRec();
    };
  });
}

// ---------- render ----------
function render() {
  const now = new Date();
  const stamp = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const rows = ROWS.map((r) => Object.assign({}, r, { days: daysLeft(r.by, now) }));
  const active = rows.filter((r) => !r.done);
  const doneN = rows.length - active.length;
  const over = (r) => r.days !== null && r.days < 0;

  $("sub").textContent = active.length + " active return" + (active.length === 1 ? "" : "s") +
    " · pulled " + stamp;

  // plain-text fallback, also what "Copy as text" puts on the clipboard
  TEXT = "Amazon returns — pulled " + stamp + "\n" +
    "Amazon shows no return code as text; the QR image is the scannable item.\n" +
    "QR links stop working 7 days after this was generated.\n\n";
  active.forEach((r, k) => {
    TEXT += (k + 1) + ". " + r.item + "\n";
    TEXT += "   Return ID:  " + (r.rma || "?") + "\n";
    TEXT += "   Return by:  " + (r.by || "?") + (over(r) ? "   *** OVERDUE ***" : "") + "\n";
    TEXT += "   Method:     " + r.status + "\n";
    if (r.qr) TEXT += "   QR image:   " + r.qr + "\n";
    if (r.link) TEXT += "   On Amazon:  " + r.link + "\n";
    if (r.note) TEXT += "   Note:       " + r.note + "\n";
    TEXT += "\n";
  });
  if (doneN) TEXT += doneN + " other return" + (doneN > 1 ? "s" : "") + " already refunded.\n";

  // on-screen cards
  let html = "";
  active.forEach((r) => {
    html += '<div class="c">' +
      (r.img ? '<img class="pi" src="' + esc(r.img) + '" alt="">' : "") +
      (r.qr ? '<img class="qr" src="' + esc(r.qr) + '" alt="QR code">' : "") +
      "<div><div class=\"t\">" + esc(r.item) + "</div>" +
      (r.rma ? '<div class="id">' + esc(r.rma) + '</div><div class="m">Return ID</div>' : "") +
      '<div class="m" style="margin-top:8px">' + esc(r.status) +
      (r.by ? ' · return by <b class="' + (over(r) ? "od" : "") + '">' + esc(r.by) +
        (over(r) ? " (overdue)" : "") + "</b>" : "") +
      (r.price ? " · " + esc(r.price) : "") +
      (r.link ? ' · <a href="' + esc(r.link) + '" target="_blank">On Amazon</a>' : "") +
      "</div>" +
      (r.note ? '<div class="m od">' + esc(r.note) + "</div>" : "") +
      "</div></div>";
  });
  rows.filter((r) => r.done).forEach((r) => {
    html += '<div class="c dn">' + (r.img ? '<img class="pi" src="' + esc(r.img) + '" alt="">' : "") +
      '<div><div class="t">' + esc(r.item) + '</div><div class="m">' + esc(r.status) + "</div></div></div>";
  });
  $("list").innerHTML = html;

  // rich HTML for the email body -- tables + inline styles so mail clients keep it
  let mail = '<div style="font:14px/1.5 Arial,sans-serif;color:#111">' +
    '<p style="margin:0 0 4px"><b>Amazon returns — pulled ' + esc(stamp) + "</b></p>" +
    '<p style="margin:0 0 18px;color:#666;font-size:12px">Scan the QR at the counter. ' +
    "Amazon shows no typeable return code. QR images expire 7 days from today &mdash; " +
    "after that use the Amazon link on each row.</p>";
  active.forEach((r, k) => {
    mail += '<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 18px;border:1px solid #ddd"><tr>' +
      '<td style="padding:10px;vertical-align:top;width:90px">' +
      (r.img ? '<img src="' + esc(r.img) + '" width="80" style="display:block">' : "") + "</td>" +
      '<td style="padding:10px;vertical-align:top;width:150px">' +
      (r.qr ? '<img src="' + esc(r.qr) + '" width="140" style="display:block">' : "") + "</td>" +
      '<td style="padding:10px 14px;vertical-align:top"><b>' + (k + 1) + ". " + esc(r.item) + "</b><br>" +
      '<span style="font-family:Consolas,monospace;font-size:13px">' + esc(r.rma || "?") + "</span>" +
      '<span style="color:#888;font-size:12px"> &nbsp;Return ID</span><br>' +
      '<span style="font-size:13px">' + esc(r.status) +
      (r.by ? " &middot; return by <b" + (over(r) ? ' style="color:#b12704"' : "") + ">" +
        esc(r.by) + (over(r) ? " (OVERDUE)" : "") + "</b>" : "") +
      (r.price ? " &middot; " + esc(r.price) : "") + "</span><br>" +
      (r.link ? '<a href="' + esc(r.link) + '" style="font-size:12px">Open on Amazon</a>' : "") +
      (r.note ? '<br><span style="color:#b12704;font-size:12px">' + esc(r.note) + "</span>" : "") +
      "</td></tr></table>";
  });
  if (doneN) mail += '<p style="color:#888;font-size:12px">' + doneN +
    " other return" + (doneN > 1 ? "s" : "") + " already refunded.</p>";
  mail += "</div>";
  $("stage").innerHTML = mail;

  window.__stamp = stamp;
}

// ---------- actions ----------
$("prt").onclick = () => window.print();

$("copy").onclick = function () {
  const b = this;
  navigator.clipboard.writeText(TEXT).then(() => {
    b.textContent = "Copied";
    setTimeout(() => (b.textContent = "Copy as text"), 2000);
  });
};

// Gmail's compose URL carries plain text only, so images cannot ride along in it.
// The rich HTML is copied synchronously -- execCommand keeps the user gesture
// alive, which an awaited Clipboard API call would spend before the tab opens.
$("mail").onclick = () => {
  if (!TOS.length) {
    $("tip").style.display = "block";
    $("tip").innerHTML = "<b>No recipients.</b> Add an address below first.";
    const a = $("addr"); if (a) a.focus();
    return;
  }
  let ok = false;
  try {
    const sel = window.getSelection(), rng = document.createRange();
    rng.selectNodeContents($("stage"));
    sel.removeAllRanges(); sel.addRange(rng);
    ok = document.execCommand("copy");
    sel.removeAllRanges();
  } catch (e) { ok = false; }

  const url = "https://mail.google.com/mail/?view=cm&fs=1&to=" + encodeURIComponent(TOS.join(",")) +
    "&su=" + encodeURIComponent("Amazon returns — " + (window.__stamp || "")) +
    (ok ? "" : "&body=" + encodeURIComponent(TEXT));

  $("tip").style.display = "block";
  $("tip").innerHTML = ok
    ? "<b>Copied with images.</b> In the Gmail tab that just opened, click in the message body and press <b>Ctrl+V</b>, then Send."
    : "<b>Rich copy wasn't available</b>, so Gmail opened with the text version (links instead of pictures).";
  window.open(url, "_blank");
};

$("refresh").onclick = () => location.reload();

chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "sheetProgress") {
    $("prog").textContent = msg.total
      ? "Reading return " + Math.min(msg.done + 1, msg.total) + " of " + msg.total + "…"
      : "Reading your returns…";
  }
});

// ---------- boot ----------
(async () => {
  const [stored, acct] = await Promise.all([
    loadTOS(),
    chrome.runtime.sendMessage({ type: "accountEmail" }).catch(() => ({ email: "" }))
  ]);
  ACCT = (acct && acct.email) || "";
  TOS = stored === null ? (ACCT ? [ACCT] : []) : stored;
  if (stored === null) saveTOS();

  let res;
  try {
    res = await chrome.runtime.sendMessage({ type: "buildSheet" });
  } catch (e) {
    res = { ok: false, reason: "fetch-failed", detail: String((e && e.message) || e) };
  }

  $("loading").hidden = true;

  if (!res || !res.ok) {
    const why = res && res.reason === "signed-out"
      ? "You're signed out of Amazon. Sign in, then press Refresh."
      : res && res.reason === "no-cards"
        ? "No returns found in the last 3 months."
        : "Couldn't read your returns" + (res && res.detail ? " (" + res.detail + ")" : "") + ".";
    $("sub").textContent = "";
    $("err").hidden = false;
    $("err").textContent = why;
    return;
  }

  ROWS = res.rows || [];
  $("main").hidden = false;
  render();
  renderRec();
})();
