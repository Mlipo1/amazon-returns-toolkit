# Implementation notes

Non-obvious behaviour behind both tools. Most of these cost real time to discover, and
several are the kind of thing that fails *silently* — which is why they're written down.

---

## Amazon's returns pages

**There is no return code as text.** Not on the returns list, not on the status page, not on
the printable label. The QR image is the only scannable artifact. The stable identifier is
the RMA (`rmaId` in the status link's query string) — that's what Amazon support asks for.
The 12-digit number in the QR filename is just an image ID; presenting it as a return code
misleads people into thinking they can type it in.

**The QR URL must keep its query string.** It's an AWS SigV4 presigned S3 link. Strip the
`?X-Amz-Signature=…` and S3 returns 403 — and an `<img>` fails silently, so it looks like a
layout bug rather than a URL bug. `X-Amz-Expires` is 604800, so **links die after 7 days**.
Always include a link back to the return so a fresh one can be minted.

**The returns list reorders itself** between loads, and new returns appear at the top. Never
key anything off card position — use the RMA.

**Sorting ascending by days-left puts the most overdue item first.** Reporting a single
"soonest" return therefore pins everything to the most expired one and hides genuine upcoming
deadlines behind it. A 50-day-overdue item meant a return due *tomorrow* was never mentioned.
Overdue and upcoming are separate questions and need separate fields.

**Thumbnails upscale via the filename.** Swap the size modifier:
`61P6aUJk2PL._AC_SY90_.jpg` → `._SL320_.jpg` gives ~320px instead of 160px.

**Product images send CORS headers; QR images do not.** Product images load under
`crossOrigin="anonymous"` and can be canvas-converted to data URIs. The QR bucket sends no
`Access-Control-Allow-Origin` at all, so its bytes are unreachable from a page and it must
stay a remote `<img src>`. The printable label page is no help — same S3 host.

**The account email is readable but is not necessarily the right inbox.**
`GET /a/settings/approval` redirects to the re-auth page, which prefills the sign-in address.
Fine for seeding a recipient list; wrong as an assumption. Plenty of people sign in with one
address and want mail at another.

**Two selectors carry almost everything.** When Amazon reshuffles markup, check these first:

- `.item-return-history-card` — one per return on the list page
- `qrcode-images` — matched against `img[src]` on the status page

---

## Extension (MV3)

**Service workers have no DOMParser.** All fetching and parsing happens in an offscreen
document (`reasons: ["DOM_PARSER"]`). The service worker only orchestrates.

**A forwarded message name must never match a listened-for name.** `chrome.runtime.sendMessage`
broadcasts to *every* extension context, including the sender's own listener. The background
listened for `accountEmail` and forwarded `accountEmail` — catching its own message and
recursing. The offscreen side is now `accountEmailFetch`. Worth auditing the routing whenever
a message type is added.

**The background check is exactly one request; the QR sheet is one per return.** The sheet
therefore runs only on demand, never from the alarm. Pulling QR images every three hours for
nobody to look at is the traffic pattern that reads as scraping.

**Silent failure is the worst outcome.** A reminder tool that has quietly stopped reminding
you is worse than none, because you've stopped checking manually. Every failure path —
signed out, blocked, markup drift, webhook unreachable — produces a visible state. "Couldn't
check" and "nothing due" must never render the same.

**Optional host permissions are requested at runtime.** The extension ships holding only
`*://*.amazon.com/*`. The Home Assistant webhook needs an origin that can't be known in
advance (self-hosted HA has no fixed hostname), so `optional_host_permissions` is requested
for that one origin at the moment the user saves a URL. It also cannot be granted
programmatically — `chrome.permissions.request()` opens native browser UI, by design.

**An unpacked extension's ID derives from its folder path** (SHA-256 of the path, first 16
bytes, nibbles mapped to `a`–`p`). Loading the same code from a different folder produces a
different ID and therefore empty storage. Removing an extension also wipes
`chrome.storage.local` — re-entering settings afterwards is expected, not a fault.

---

## Email

**Gmail's compose URL carries plain text only.** `?body=` cannot hold HTML or attachments, so
a URL-driven draft can only ever contain image *links*. To get real images into the mail, the
sheet is copied to the clipboard as `text/html` and pasted into the draft. Gmail preserves the
`<img>` tags and table layout on paste.

**The copy must be synchronous `document.execCommand("copy")`.** `navigator.clipboard.write()`
needs an `await`, and awaiting spends the user gesture — so the `window.open()` to Gmail that
follows gets popup-blocked. `execCommand` keeps copy and open inside one gesture. Verified
with a real click and a real `Ctrl+V`: 12 images and 6 tables survive intact.

**Recipients are removed by value, never by index.** A re-render reorders the list, and a
stale index deletes the wrong person.

---

## Bookmarklet specifics

**It only runs on `amazon.com`.** Everything depends on same-origin `fetch` carrying the
session cookie. Clicked from any other origin — including `install.html` itself on `file://`
— every fetch dies with `Failed to fetch`. It guards on `location.hostname` and offers to
open the returns page; `install.html` intercepts clicks on the button so it can only be
dragged.

Verified working against a live account: 7 returns, 6 active, all QR codes resolved.
