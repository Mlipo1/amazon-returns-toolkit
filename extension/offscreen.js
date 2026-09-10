// MV3 service workers have no DOMParser, so all fetching + parsing happens here.
//
// Two jobs, deliberately different in cost:
//   scrapeReturns - the background check. ONE request. Runs every few hours.
//   scrapeSheet   - the QR sheet. One request per return. Only ever runs when
//                   the user presses the button. Putting this on the schedule
//                   would mean hammering Amazon for images nobody is looking at.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchDoc(url) {
  const r = await fetch(url, { credentials: "include", redirect: "follow", headers: { Accept: "text/html" } });
  if (/\/ap\/signin/.test(r.url)) throw new Error("signed-out");
  if (!r.ok) throw new Error("HTTP " + r.status);
  return new DOMParser().parseFromString(await r.text(), "text/html");
}

// Amazon thumbs carry a size modifier like "._AC_SY90_." -- swap for a bigger one.
const bigImg = (s) => s.replace(/\._[^.\/]*_\.(jpg|jpeg|png|gif|webp|avif)/i, "._SL320_.$1");

function parseCard(c) {
  const txt = (c.innerText || c.textContent || "").replace(/ /g, " ");
  const lines = txt.split("\n").map((s) => s.trim()).filter(Boolean);
  const status = lines[0] || "";
  const anchors = [].slice.call(c.querySelectorAll("a"));
  const itemA = anchors.filter((x) => /\/dp\/|\/gp\/product/.test(x.getAttribute("href") || ""))[0];
  const statusA = anchors.filter((x) => /view return status/i.test(x.textContent || ""))[0];
  const prodImg = [].slice.call(c.querySelectorAll("img"))
    .filter((x) => /media-amazon|images-amazon|ssl-images/.test(x.getAttribute("src") || ""))[0];

  let href = statusA ? statusA.getAttribute("href") || "" : "";
  if (href && href.indexOf("http") !== 0) href = "https://www.amazon.com" + href;

  return {
    item: itemA ? itemA.textContent.trim().replace(/\s+/g, " ") : (lines[2] || "(unnamed item)"),
    status,
    by: ((txt.match(/Return by\s+([A-Z][a-z]{2}\.?\s*\d{1,2})/) || [])[1] || "").replace(/\s+/g, " "),
    price: (txt.match(/Item price:\s*(\$[\d.,]+)/) || [])[1] || "",
    rma: (href.match(/rmaId=([^&]+)/) || [])[1] || "",
    link: href,
    img: prodImg ? bigImg(prodImg.getAttribute("src")) : "",
    done: /refund (credited|issued)|refunded|completed|closed|cancell?ed/i.test(status),
    qr: "", note: ""
  };
}

async function listCards() {
  const doc = await fetchDoc("https://www.amazon.com/your-returns");
  return [].slice.call(doc.querySelectorAll(".item-return-history-card"));
}

async function scrapeReturns() {
  const cards = await listCards();
  if (!cards.length) return { ok: false, reason: "no-cards", rows: [] };
  return { ok: true, rows: cards.map(parseCard) };
}

// The QR image URL must keep its query string: it is an AWS SigV4 presigned S3
// link, and stripping the signature turns it into a 403.
async function scrapeSheet() {
  const cards = await listCards();
  if (!cards.length) return { ok: false, reason: "no-cards", rows: [] };

  const rows = cards.map(parseCard);
  const active = rows.filter((r) => !r.done && r.link);
  let n = 0;

  for (const row of active) {
    chrome.runtime.sendMessage({ type: "sheetProgress", done: n, total: active.length }).catch(() => {});
    try {
      const d = await fetchDoc(row.link);
      const im = [].slice.call(d.querySelectorAll("img"))
        .filter((x) => /qrcode-images/i.test(x.getAttribute("src") || ""))[0];
      if (im) row.qr = im.getAttribute("src");
      else row.note = "No QR on this return — open it on Amazon for a mailing label.";
    } catch (e) {
      row.note = "Could not read this return (" + e.message + ")";
    }
    n++;
    await sleep(400);
  }
  chrome.runtime.sendMessage({ type: "sheetProgress", done: n, total: active.length }).catch(() => {});
  return { ok: true, rows };
}

// Amazon's re-auth page prefills the account's sign-in email. Used only to
// pre-fill the recipient list -- people often want mail somewhere else.
async function accountEmail() {
  try {
    const t = await (await fetch("https://www.amazon.com/a/settings/approval", { credentials: "include" })).text();
    const hits = (t.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [])
      .filter((e) => !/@(sentry|amazon\.com|media-amazon|example|schema|ssl-images)/i.test(e));
    return hits[0] || "";
  } catch (e) {
    return "";
  }
}

chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  if (!msg) return;

  if (msg.type === "scrapeReturns") {
    scrapeReturns()
      .then(respond)
      .catch((e) => respond({
        ok: false,
        reason: e.message === "signed-out" ? "signed-out" : "fetch-failed",
        detail: String(e.message || e), rows: []
      }));
    return true;
  }

  if (msg.type === "scrapeSheet") {
    scrapeSheet()
      .then(respond)
      .catch((e) => respond({
        ok: false,
        reason: e.message === "signed-out" ? "signed-out" : "fetch-failed",
        detail: String(e.message || e), rows: []
      }));
    return true;
  }

  if (msg.type === "accountEmailFetch") {
    accountEmail().then((v) => respond({ email: v }));
    return true;
  }
});
