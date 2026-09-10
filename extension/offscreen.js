// MV3 service workers have no DOMParser, so the fetch + parse happens here.
// One request per check: everything the reminder needs is on the returns list page.

function parseReturns(html) {
  var doc = new DOMParser().parseFromString(html, "text/html");
  var cards = [].slice.call(doc.querySelectorAll(".item-return-history-card"));

  if (!cards.length) {
    var signedOut = /ap\/signin/.test(html) || !!doc.querySelector("form[name=signIn]");
    return { ok: false, reason: signedOut ? "signed-out" : "no-cards", rows: [] };
  }

  var rows = cards.map(function (c) {
    var txt = (c.innerText || c.textContent || "").replace(/ /g, " ");
    var lines = txt.split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
    var status = lines[0] || "";
    var anchors = [].slice.call(c.querySelectorAll("a"));
    var itemA = anchors.filter(function (x) {
      return /\/dp\/|\/gp\/product/.test(x.getAttribute("href") || "");
    })[0];
    var statusA = anchors.filter(function (x) {
      return /view return status/i.test(x.textContent || "");
    })[0];
    var href = statusA ? statusA.getAttribute("href") || "" : "";
    if (href && href.indexOf("http") !== 0) href = "https://www.amazon.com" + href;

    return {
      item: itemA ? itemA.textContent.trim().replace(/\s+/g, " ") : (lines[2] || "(unnamed item)"),
      status: status,
      by: ((txt.match(/Return by\s+([A-Z][a-z]{2}\.?\s*\d{1,2})/) || [])[1] || "").replace(/\s+/g, " "),
      rma: (href.match(/rmaId=([^&]+)/) || [])[1] || "",
      link: href,
      done: /refund (credited|issued)|refunded|completed|closed|cancell?ed/i.test(status)
    };
  });

  return { ok: true, rows: rows };
}

chrome.runtime.onMessage.addListener(function (msg, sender, respond) {
  if (msg && msg.type === "scrapeReturns") {
    fetch("https://www.amazon.com/your-returns", {
      credentials: "include",
      redirect: "follow",
      headers: { "Accept": "text/html" }
    })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        // A redirect to the sign-in host is the other way "signed out" shows up.
        if (/\/ap\/signin/.test(r.url)) return Promise.reject(new Error("signed-out"));
        return r.text();
      })
      .then(function (t) { respond(parseReturns(t)); })
      .catch(function (e) {
        respond({ ok: false, reason: e.message === "signed-out" ? "signed-out" : "fetch-failed", detail: String(e.message || e), rows: [] });
      });
    return true; // async response
  }
});
