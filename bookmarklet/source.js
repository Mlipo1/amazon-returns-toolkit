(async () => {
  var TOS = [], acct = "";
  var win = window.open("", "_blank");
  if (!win) { alert("Allow popups for amazon.com, then click the bookmark again."); return; }
  win.document.write('<!doctype html><meta charset="utf-8"><title>Amazon Returns</title><body style="font:16px system-ui;padding:40px;color:#333"><p id=s>Starting...</p>');
  var say = function (m) { var p = win.document.getElementById("s"); if (p) p.innerHTML = m; };

  // Must run on amazon.com: the scrape relies on same-origin fetch carrying your session.
  // Clicked from anywhere else (including the local install.html) fetch is cross-origin
  // and fails with "Failed to fetch".
  if (!/(^|\.)amazon\.com$/i.test(location.hostname)) {
    win.document.body.innerHTML =
      '<div style="font:16px/1.6 system-ui,Segoe UI,sans-serif;padding:40px;max-width:580px;color:#111">' +
      '<h2 style="margin:0 0 10px;font-size:20px">This has to run on Amazon</h2>' +
      "<p>It reads your returns using your logged-in Amazon session, so it only works when " +
      "clicked from an <b>amazon.com</b> page. You clicked it from <b>" +
      (location.hostname || "a local file") + "</b>.</p>" +
      '<p style="margin:22px 0"><button id=go style="font:600 15px system-ui;padding:12px 22px;' +
      'border:0;border-radius:8px;background:#ffd814;cursor:pointer">Open my Amazon returns</button></p>' +
      '<p style="color:#666;font-size:14px">Then click <b>&#128230; My Return Codes</b> in your ' +
      "bookmarks bar again, from that page.</p></div>";
    win.document.getElementById("go").onclick = function () {
      win.location.href = "https://www.amazon.com/your-returns";
    };
    return;
  }

  // Recipients live in this browser only. Seeded from the Amazon account on first run,
  // then fully editable -- including removing the detected one.
  var KEY = "amazonReturnsEmails";
  var OLDKEY = "amazonReturnsEmail";
  var valid = function (v) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v); };
  var saveTOS = function () { try { localStorage.setItem(KEY, JSON.stringify(TOS)); } catch (e) {} };
  // null means "never configured" -- distinct from [] , which means the user removed
  // everything on purpose and should not be re-seeded.
  var loadTOS = function () {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw !== null) { var a = JSON.parse(raw); return Array.isArray(a) ? a : null; }
      var one = localStorage.getItem(OLDKEY);
      if (one) return [one];
      return null;
    } catch (e) { return null; }
  };
  // Amazon's re-auth page prefills the account's sign-in email.
  var sniffTO = async function () {
    try {
      var t = await (await fetch("/a/settings/approval", { credentials: "include" })).text();
      var hits = (t.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [])
        .filter(function (e) { return !/@(sentry|amazon\.com|media-amazon|example|schema|ssl-images)/i.test(e); });
      return hits[0] || "";
    } catch (e) { return ""; }
  };

  say("Finding your account email…");
  acct = await sniffTO();
  var stored = loadTOS();
  if (stored === null) { TOS = acct ? [acct] : []; saveTOS(); } else { TOS = stored; }

  say("Reading your returns…");

  try {
    var parse = function (h) { return new DOMParser().parseFromString(h, "text/html"); };
    var grab = async function (u) {
      var r = await fetch(u, { credentials: "include" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return parse(await r.text());
    };
    // Amazon thumbs carry a size modifier like "._AC_SY90_." -- swap it for a bigger one.
    var big = function (s) {
      return s.replace(/\._[^.\/]*_\.(jpg|jpeg|png|gif|webp|avif)/i, "._SL320_.$1");
    };

    var list = await grab("https://www.amazon.com/your-returns");
    var cards = [].slice.call(list.querySelectorAll(".item-return-history-card"));
    if (!cards.length) {
      say(/ap\/signin/.test(list.body.innerHTML)
        ? "You appear to be signed out of Amazon. Sign in, then click the bookmark again."
        : "No returns found in the last 3 months.");
      return;
    }

    var rows = [], n = 0;
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i];
      var txt = c.innerText.replace(/ /g, " ");
      var lines = txt.split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
      var status = lines[0] || "";
      var done = /refund (credited|issued)|refunded|completed|closed|cancell?ed/i.test(status);

      var anchors = [].slice.call(c.querySelectorAll("a"));
      var itemA = anchors.filter(function (x) {
        return /\/dp\/|\/gp\/product/.test(x.getAttribute("href") || "");
      })[0];
      var statusA = anchors.filter(function (x) {
        return /view return status/i.test(x.textContent);
      })[0];
      var prodImg = [].slice.call(c.querySelectorAll("img")).filter(function (x) {
        return /media-amazon|images-amazon|ssl-images/.test(x.src || "");
      })[0];
      var href = statusA ? statusA.href : "";

      var row = {
        item: itemA ? itemA.textContent.trim().replace(/\s+/g, " ") : (lines[2] || "(unnamed item)"),
        status: status,
        by: ((txt.match(/Return by\s+([A-Z][a-z]{2}\.?\s*\d{1,2})/) || [])[1] || "").replace(/\s+/g, " "),
        price: (txt.match(/Item price:\s*(\$[\d.,]+)/) || [])[1] || "",
        rma: (href.match(/rmaId=([^&]+)/) || [])[1] || "",
        link: href,
        img: prodImg ? big(prodImg.src) : "",
        done: done, qr: "", note: ""
      };

      if (!done && statusA) {
        say("Reading return " + (++n) + " of " + cards.length + "…");
        try {
          var d = await grab(href);
          var img = [].slice.call(d.querySelectorAll("img")).filter(function (x) {
            return /qrcode-images/i.test(x.getAttribute("src") || "");
          })[0];
          // Keep the full URL. The X-Amz-Signature query string is required:
          // stripping it turns the image into a 403.
          if (img) row.qr = img.getAttribute("src");
          else row.note = "No QR on this return — open it on Amazon for a mailing label.";
        } catch (e) {
          row.note = "Could not read this return (" + e.message + ")";
        }
        await new Promise(function (r) { setTimeout(r, 400); });
      }
      rows.push(row);
    }

    var active = rows.filter(function (r) { return !r.done; });
    var today = new Date();
    var stamp = today.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

    var overdue = function (r) {
      if (!r.by) return false;
      var d = new Date(r.by + " " + today.getFullYear());
      if (isNaN(d)) return false;
      if (d - today > 15552000000) d.setFullYear(d.getFullYear() - 1);
      return d < today;
    };
    var esc = function (s) {
      return String(s).replace(/[&<>"]/g, function (m) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m];
      });
    };

    // ---- plain-text fallback (used if rich copy is unavailable) ----
    var text = "Amazon returns — pulled " + stamp + "\n" +
      "Amazon shows no return code as text; the QR image is the scannable item.\n" +
      "QR links stop working 7 days after this was generated.\n\n";
    active.forEach(function (r, k) {
      text += (k + 1) + ". " + r.item + "\n";
      text += "   Return ID:  " + (r.rma || "?") + "\n";
      text += "   Return by:  " + (r.by || "?") + (overdue(r) ? "   *** OVERDUE ***" : "") + "\n";
      text += "   Method:     " + r.status + "\n";
      if (r.qr) text += "   QR image:   " + r.qr + "\n";
      if (r.link) text += "   On Amazon:  " + r.link + "\n";
      if (r.note) text += "   Note:       " + r.note + "\n";
      text += "\n";
    });
    var doneN = rows.length - active.length;
    if (doneN) text += doneN + " other return" + (doneN > 1 ? "s" : "") + " already refunded.\n";

    // ---- rich HTML for the email body: table layout, inline styles only ----
    var mailHtml = '<div style="font:14px/1.5 Arial,sans-serif;color:#111">' +
      '<p style="margin:0 0 4px"><b>Amazon returns — pulled ' + esc(stamp) + "</b></p>" +
      '<p style="margin:0 0 18px;color:#666;font-size:12px">Scan the QR at the counter. ' +
      "Amazon shows no typeable return code. QR images expire 7 days from today &mdash; " +
      "after that use the Amazon link on each row.</p>";
    active.forEach(function (r, k) {
      mailHtml += '<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;' +
        'margin:0 0 18px;border:1px solid #ddd"><tr>' +
        '<td style="padding:10px;vertical-align:top;width:90px">' +
        (r.img ? '<img src="' + esc(r.img) + '" width="80" style="display:block">' : "") +
        "</td>" +
        '<td style="padding:10px;vertical-align:top;width:150px">' +
        (r.qr ? '<img src="' + esc(r.qr) + '" width="140" style="display:block">' : "") +
        "</td>" +
        '<td style="padding:10px 14px;vertical-align:top">' +
        "<b>" + (k + 1) + ". " + esc(r.item) + "</b><br>" +
        '<span style="font-family:Consolas,monospace;font-size:13px">' + esc(r.rma || "?") + "</span>" +
        '<span style="color:#888;font-size:12px"> &nbsp;Return ID</span><br>' +
        '<span style="font-size:13px">' + esc(r.status) +
        (r.by ? " &middot; return by <b" + (overdue(r) ? ' style="color:#b12704"' : "") + ">" +
          esc(r.by) + (overdue(r) ? " (OVERDUE)" : "") + "</b>" : "") +
        (r.price ? " &middot; " + esc(r.price) : "") + "</span><br>" +
        (r.link ? '<a href="' + esc(r.link) + '" style="font-size:12px">Open on Amazon</a>' : "") +
        (r.note ? '<br><span style="color:#b12704;font-size:12px">' + esc(r.note) + "</span>" : "") +
        "</td></tr></table>";
    });
    if (doneN) mailHtml += '<p style="color:#888;font-size:12px">' + doneN +
      " other return" + (doneN > 1 ? "s" : "") + " already refunded.</p>";
    mailHtml += "</div>";

    // ---- report page ----
    var html = '<!doctype html><meta charset="utf-8"><title>Amazon returns — ' + esc(stamp) + "</title><style>" +
      "body{font:15px/1.5 system-ui,Segoe UI,sans-serif;margin:0;padding:32px;background:#f6f6f6;color:#111}" +
      ".w{max-width:940px;margin:0 auto}h1{font-size:22px;margin:0 0 4px}" +
      ".sub{color:#666;margin:0 0 18px}" +
      ".bar{display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap}" +
      "button{font:600 14px system-ui;padding:10px 18px;border:1px solid #d5d9d9;border-radius:8px;cursor:pointer;background:#ffd814}" +
      "button.g{background:#111;color:#fff;border-color:#111}" +
      ".tip{display:none;background:#e7f5ea;border:1px solid #a8d5b5;border-radius:8px;padding:12px 16px;font-size:14px;color:#1c5c30;margin-bottom:14px}" +
      ".rec{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 18px;font-size:13px}" +
      ".rl{color:#666}.none{color:#b12704;font-weight:600}" +
      ".chip{background:#eef3f8;border:1px solid #cfdbe6;border-radius:14px;padding:4px 6px 4px 11px;display:inline-flex;gap:7px;align-items:center}" +
      ".chip i{font-style:normal;color:#8a9bab;font-size:11px}" +
      ".chip b{cursor:pointer;color:#94a3b0;font-weight:700;padding:0 3px}.chip b:hover{color:#b12704}" +
      "button.sm{font:600 12px system-ui;padding:6px 11px;border-radius:6px;background:#fff}" +
      "#addr{font:13px system-ui;padding:6px 9px;border:1px solid #ccc;border-radius:6px}" +
      ".warn{background:#fff4e5;border:1px solid #ffd8a8;border-radius:8px;padding:10px 14px;font-size:13px;color:#7a4b00;margin-bottom:22px}" +
      ".c{background:#fff;border:1px solid #ddd;border-radius:10px;padding:18px;margin-bottom:14px;display:flex;gap:18px;align-items:flex-start}" +
      ".pi{width:80px;flex:0 0 80px}" +
      ".qr{width:140px;height:140px;flex:0 0 140px;border:1px solid #eee;background:#fff}" +
      ".t{font-weight:600;margin-bottom:8px}" +
      ".id{font:700 17px ui-monospace,Consolas,monospace;margin:4px 0}" +
      ".m{color:#555;font-size:13px}.od{color:#b12704;font-weight:700}.dn{opacity:.55}" +
      "a{color:#007185}#stage{position:absolute;left:-9999px;top:0}" +
      "@media print{body{background:#fff;padding:0}.bar,.warn,.tip{display:none}.c{break-inside:avoid}}" +
      "</style><div class=w><h1>Amazon returns</h1>" +
      "<p class=sub>" + active.length + " active return" + (active.length === 1 ? "" : "s") +
      " · pulled " + esc(stamp) + "</p><div class=bar>" +
      '<button class=g id=mail>Email</button>' +
      '<button id=copy>Copy as text</button>' +
      '<button id=prt>Print</button></div>' +
      '<div class=rec id=rec></div>' +
      '<div class=tip id=tip></div>' +
      '<div class=warn><b>Scan the QR, not the ID.</b> Amazon never shows a typeable return code — ' +
      "the QR image is what a store associate scans. These QR links expire 7 days from today; " +
      "after that, use the <i>On Amazon</i> link to load a fresh one.</div>";

    active.forEach(function (r) {
      html += "<div class=c>" +
        (r.img ? '<img class=pi src="' + esc(r.img) + '" alt="">' : "") +
        (r.qr ? '<img class=qr src="' + esc(r.qr) + '" alt="QR code">' : "") +
        "<div><div class=t>" + esc(r.item) + "</div>" +
        (r.rma ? '<div class=id>' + esc(r.rma) + '</div><div class=m>Return ID</div>' : "") +
        '<div class=m style="margin-top:8px">' + esc(r.status) +
        (r.by ? " · return by <b class=\"" + (overdue(r) ? "od" : "") + "\">" + esc(r.by) +
          (overdue(r) ? " (overdue)" : "") + "</b>" : "") +
        (r.price ? " · " + esc(r.price) : "") +
        (r.link ? ' · <a href="' + esc(r.link) + '" target="_blank">On Amazon</a>' : "") +
        "</div>" +
        (r.note ? '<div class="m od">' + esc(r.note) + "</div>" : "") +
        "</div></div>";
    });

    rows.filter(function (r) { return r.done; }).forEach(function (r) {
      html += '<div class="c dn">' + (r.img ? '<img class=pi src="' + esc(r.img) + '" alt="">' : "") +
        "<div><div class=t>" + esc(r.item) + "</div><div class=m>" + esc(r.status) + "</div></div></div>";
    });

    html += '</div><div id=stage></div>';

    win.document.open();
    win.document.write(html);
    win.document.close();

    var w = win;
    var D = w.document;
    D.getElementById("stage").innerHTML = mailHtml;
    var tip = D.getElementById("tip");

    D.getElementById("prt").onclick = function () { w.print(); };

    D.getElementById("copy").onclick = function () {
      var b = this;
      w.navigator.clipboard.writeText(text).then(function () {
        b.textContent = "Copied";
        w.setTimeout(function () { b.textContent = "Copy as text"; }, 2000);
      });
    };

    // Gmail's compose URL only accepts a plain-text body, so images can't ride along in it.
    // Instead copy the rich HTML synchronously (execCommand keeps the user gesture alive,
    // which the async Clipboard API would spend before window.open runs) and paste it in.
    var recEl = D.getElementById("rec"), mailBtn = D.getElementById("mail");

    var addAddr = function (v) {
      v = (v || "").trim();
      if (!v) return "";
      if (!valid(v)) return "That doesn't look like an email address.";
      if (TOS.some(function (e) { return e.toLowerCase() === v.toLowerCase(); })) return "Already on the list.";
      TOS.push(v); saveTOS(); renderRec(); return "";
    };

    var renderRec = function () {
      var h = '<span class=rl>Send to:</span>';
      if (!TOS.length) h += '<span class=none>nobody yet — add an address</span>';
      TOS.forEach(function (e) {
        h += '<span class=chip>' + esc(e) +
          (e.toLowerCase() === (acct || "").toLowerCase() ? " <i>Amazon account</i>" : "") +
          '<b data-e="' + esc(e) + '" title="remove">&times;</b></span>';
      });
      h += '<input id=addr placeholder="add another address" size=20>' +
        '<button id=add class=sm>Add</button>';
      if (acct && !TOS.some(function (e) { return e.toLowerCase() === acct.toLowerCase(); })) {
        h += '<button id=useacct class=sm title="the address on your Amazon account">+ ' + esc(acct) + "</button>";
      }
      recEl.innerHTML = h;
      mailBtn.textContent = TOS.length
        ? "Email to " + (TOS.length === 1 ? TOS[0] : TOS.length + " recipients")
        : "Email";

      D.getElementById("add").onclick = function () {
        var inp = D.getElementById("addr"), msg = addAddr(inp.value);
        if (msg) { tip.style.display = "block"; tip.textContent = msg; }
        else { tip.style.display = "none"; }
      };
      D.getElementById("addr").onkeydown = function (ev) {
        if (ev.key === "Enter") { ev.preventDefault(); D.getElementById("add").click(); }
      };
      var ua = D.getElementById("useacct");
      if (ua) ua.onclick = function () { addAddr(acct); };
      [].slice.call(recEl.querySelectorAll(".chip b")).forEach(function (x) {
        x.onclick = function () {
          var v = this.getAttribute("data-e");
          TOS = TOS.filter(function (e) { return e !== v; });
          saveTOS(); renderRec();
        };
      });
    };

    renderRec();

    mailBtn.onclick = function () {
      if (!TOS.length) {
        tip.style.display = "block";
        tip.innerHTML = "<b>No recipients.</b> Add an address below first.";
        var a = D.getElementById("addr"); if (a) a.focus();
        return;
      }
      var ok = false;
      try {
        var sel = w.getSelection(), rng = D.createRange();
        rng.selectNodeContents(D.getElementById("stage"));
        sel.removeAllRanges(); sel.addRange(rng);
        ok = D.execCommand("copy");
        sel.removeAllRanges();
      } catch (e) { ok = false; }

      var url = "https://mail.google.com/mail/?view=cm&fs=1&to=" + encodeURIComponent(TOS.join(",")) +
        "&su=" + encodeURIComponent("Amazon returns — " + stamp) +
        (ok ? "" : "&body=" + encodeURIComponent(text));

      tip.style.display = "block";
      tip.innerHTML = ok
        ? "<b>Copied with images.</b> In the Gmail tab that just opened, click in the message " +
          "body and press <b>Ctrl+V</b>, then Send."
        : "<b>Rich copy wasn't available</b>, so Gmail opened with the text version " +
          "(links instead of pictures).";
      w.open(url, "_blank");
    };
  } catch (e) {
    say("Something went wrong: " + e.message +
      "<br><br>Open amazon.com/your-returns, confirm you are signed in, and click the bookmark again.");
  }
})();
