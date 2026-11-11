const $ = (id) => document.getElementById(id);

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

function dueLine(r, now) {
  const d = daysLeft(r.by, now);
  if (d === null) return { text: "RETURN BY " + (r.by || "—").toUpperCase(), overdue: false };
  if (d < 0) return { text: "OVERDUE — WAS " + (r.by || "").toUpperCase(), overdue: true };
  if (d === 0) return { text: "RETURN BY TODAY", overdue: true };
  if (d === 1) return { text: "RETURN BY TOMORROW", overdue: false };
  return { text: "RETURN BY " + (r.by || "").toUpperCase(), overdue: false };
}

function labelHtml(r, now) {
  const due = dueLine(r, now);
  return '<div class="label">' +
    '<p class="hdr">AMAZON RETURN</p>' +
    '<p class="due' + (due.overdue ? " od" : "") + '">' + esc(due.text) + "</p>" +
    (r.status ? '<p class="meth">' + esc(r.status) + "</p>" : "") +
    '<div class="qrwrap">' +
      (r.qr
        ? '<img class="qr" src="' + esc(r.qr) + '" alt="Return QR code">'
        // A carrier shipping label cannot be honestly re-rendered here: it must
        // be printed from Amazon at its exact scale or the barcode won't scan.
        : '<div class="noqr">No QR for this return.<br>Print Amazon\'s own label ' +
          "from the link on the sheet.</div>") +
    "</div>" +
    '<p class="item">' + esc(r.item || "") + "</p>" +
    (r.rma ? '<p class="rma">' + esc(r.rma) + '</p><p class="rmaL">RETURN ID</p>' : "") +
    '<div class="foot">Scan this code at the counter. No box or printed postage needed ' +
    "unless Amazon asked for one.</div>" +
    "</div>";
}

$("print").onclick = () => window.print();
$("back").onclick = () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("report.html") });
};

(async () => {
  const s = await chrome.storage.local.get({ sheetRows: [], sheetAt: 0 });
  let rows = (s.sheetRows || []).filter((r) => !r.done);

  if (!rows.length) {
    // Nothing stashed by the sheet yet -- build it now rather than sending the
    // user back to press another button.
    try {
      const res = await chrome.runtime.sendMessage({ type: "buildSheet" });
      if (res && res.ok) {
        rows = (res.rows || []).filter((r) => !r.done);
        chrome.storage.local.set({ sheetRows: rows, sheetAt: Date.now() });
      }
    } catch (e) { /* falls through to the empty state */ }
  }

  if (!rows.length) {
    $("sheet").innerHTML = '<div class="empty"><b>No active returns.</b><br><br>' +
      "Everything has been refunded or completed, so there is nothing to print.</div>";
    return;
  }

  const now = new Date();
  $("sheet").innerHTML = rows.map((r) => labelHtml(r, now)).join("");

  // QR links are presigned and expire after 7 days. A silently broken image
  // would print as a blank box, so say so on screen instead.
  [].slice.call(document.querySelectorAll("img.qr")).forEach((img) => {
    img.onerror = () => {
      const box = document.createElement("div");
      box.className = "noqr";
      box.innerHTML = "QR code expired.<br>Open the return on Amazon to load a fresh one.";
      img.replaceWith(box);
    };
  });
})();
