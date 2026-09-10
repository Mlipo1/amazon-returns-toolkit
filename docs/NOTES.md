# Amazon Return Codes bookmarklet

One click on any `amazon.com` page → reads every active return → opens a page with each
item's QR code → one more click emails the list to yourself as a Gmail draft.

## Install

Open `install.html` and drag the yellow **📦 My Return Codes** button to your bookmarks bar.
(`Ctrl+Shift+B` shows the bar if it's hidden.)

## Files

| File | What it is |
|---|---|
| `source.js` | The readable source. Edit this. |
| `build.py` | URL-encodes `source.js` into a `javascript:` URI and regenerates `install.html`. |
| `install.html` | The drag-to-install page. Generated — don't hand-edit. |

After editing `source.js`:

```bash
python build.py
```

Then re-drag the button (the old bookmark still holds the old code).

## What it does and doesn't do

Read-only. It fetches `amazon.com/your-returns` and each return's status page using your
existing browser session, and never clicks, cancels, edits, or submits anything.
The email opens as a Gmail **draft** — nothing sends until you press Send.

## Things learned the hard way

**It only runs on `amazon.com`.** The whole thing depends on same-origin `fetch` carrying
the session cookie. Clicked from any other origin — including `install.html` itself on
`file://` — every fetch dies with `Failed to fetch`. `source.js` now guards on
`location.hostname` and offers to open the returns page instead; `install.html` intercepts
clicks on the button so it can only be dragged.

**Amazon shows no return code as text.** Not on the returns list, not on the status page.
The QR image is the only scannable artifact. The stable identifier is the RMA
(e.g. `D0aa0a0aRRMA`), which lives in the `rmaId` query param of the status link and is
what Amazon support asks for. The 12-digit number in the QR filename is just an image ID —
do not present it as a return code.

**The QR URL must keep its query string.** It's an AWS SigV4 presigned S3 URL
(`X-Amz-Signature` etc.). Strip the `?...` and S3 returns 403 and the image silently breaks.
`X-Amz-Expires` is 604800 — **the links die 7 days after generation.** Past that, use the
*On Amazon* link on each card to load a fresh QR.

**Gmail's compose URL takes plain text only.** `?body=` cannot carry HTML or attachments,
so a URL-driven draft can only ever contain image *links*. To get real pictures in the mail,
the report copies rich HTML to the clipboard and you paste it into the draft. Gmail keeps
the `<img>` tags and table layout on paste.

**The copy must use `document.execCommand("copy")`, not the async Clipboard API.**
`navigator.clipboard.write()` needs an `await`, and awaiting spends the user gesture, so the
`window.open()` to Gmail that follows gets popup-blocked. `execCommand` is synchronous, so
copy-then-open both run inside the one click. Verified: real click + real Ctrl+V pastes
12 images and 6 tables intact.

**Product images can be inlined; QR images cannot.** Amazon's product CDN serves
`Access-Control-Allow-Origin`, so those load with `crossOrigin="anonymous"` and can be
canvas-converted to data URIs. The QR bucket sends no CORS header at all — it fails to load
under `crossOrigin`, so its bytes are unreachable and it has to stay a remote `<img src>`.
The printable label page is no help; it pulls from the same S3 host.

**Thumbnails upscale via the filename.** Swap the size modifier —
`61P6aUJk2PL._AC_SY90_.jpg` &rarr; `._SL320_.jpg` — to get ~320px instead of 160px.

**The account email is readable, but it isn't necessarily the right inbox.**
`GET /a/settings/approval` redirects to Amazon's re-auth page, which prefills the account's
sign-in address — scrapeable same-origin with a plain email regex. It seeds the recipient
list on first run. Don't treat it as authoritative — plenty of people sign in with one
address and want their mail somewhere else, which is why every recipient is editable.

Recipients live in `localStorage` under `amazonReturnsEmails` (a JSON array; the older
single-value `amazonReturnsEmail` key is migrated on read). `null` means never configured
and triggers seeding; `[]` means the user cleared it deliberately and must not be re-seeded.
Chips remove **by value, not index** — index-based removal breaks the moment a re-render
reorders the list.

**The returns list reorders itself** between page loads, and new returns appear at the top.
Never key anything off card position — use the RMA.

## If it breaks

Amazon reshuffles their markup periodically. Two selectors carry the whole thing, both in
`source.js`:

- `.item-return-history-card` — one per return on the list page
- `qrcode-images` — matched against `img[src]` on the status page

Verified working 2026-09-09 against 7 returns (6 active, 6 QR codes resolved).
