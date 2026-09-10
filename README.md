# Amazon Returns Toolkit

Amazon buries your return deadlines. The drop-off date sits three clicks deep, one return at
a time, nothing reminds you before it passes — and there is no return code you can write
down, because the QR image is the only scannable artifact.

This fixes both halves. It runs entirely in your own browser using the Amazon session you
already have: no account, no server, no API key, no password stored anywhere.

---

## The extension

**Install once, then nothing.**

1. Download or clone this repo
2. Open `chrome://extensions` and turn on **Developer mode** (top right)
3. **Load unpacked** → pick the `extension/` folder

Works in Chrome, Edge, Brave, and other Chromium browsers.

### What it does on its own

Checks your returns every 3 hours in the background and notifies you — at most once a day —
when something is overdue or its deadline is close. The toolbar badge shows how many need
attention, red if anything is overdue.

If it *can't* check — signed out, blocked, Amazon changed their page — it says so, with a
**check failed** notification and a `!` badge. A reminder tool that has silently stopped
reminding you is worse than none, so "couldn't check" and "nothing due" never look the same.

### What it does in one click

**📦 Get my QR codes** opens a page with every active return: product photo, scannable QR,
Return ID, deadline. From there:

- **Email** — copies the whole sheet as rich HTML and opens a Gmail draft. Click in the body,
  press `Ctrl+V`, Send. The paste is required — Gmail's compose link can't carry images.
- **Send to:** — manage recipients. Your Amazon account address is detected and added on
  first run; remove it or add others, and it's remembered.
- **Copy as text** / **Print**

### Settings

- **Warn me this many days ahead** — default 3
- **Home Assistant webhook** — optional; see below

---

## Home Assistant (optional)

Paste a webhook URL into settings and every check POSTs the full list as JSON — counts,
per-return deadlines as real ISO dates, RMA, and link. **Test connection** walks the whole
path and names the step that failed, so a webhook that never worked can't masquerade as one
that's fine.

Home Assistant then holds your deadlines, reminds you on its own schedule, escalates anything
due within a day, and — most importantly — warns you when the extension has *stopped*
reporting.

[docs/HOME-ASSISTANT.md](docs/HOME-ASSISTANT.md) has the payload, the helpers, and the three
automations.

---

## What this does and doesn't do

**Read-only.** It fetches your returns pages and parses them. Nothing is cancelled, edited,
or submitted, and no email sends until you press Send yourself.

**Nothing leaves your browser.** Settings and recipients live in `chrome.storage.local`.
The only outbound request is the Home Assistant webhook you configure yourself.

**QR links expire after 7 days.** They're presigned S3 URLs. Every row carries an *On Amazon*
link that loads a fresh one.

**US Amazon only.** Selectors target `amazon.com`; other locales will need adjusting.

---

## Why not a server or a cron job

The obvious design — something that logs into Amazon on a schedule — fails badly. It needs
your credentials parked in a headless browser, gets re-challenged for an OTP the moment the
device fingerprint shifts, and trips bot detection that returns *200 with a CAPTCHA body*,
which a naive scraper reads as "no returns due."

Running inside your own browser sidesteps all of it: real session, real fingerprint, no
credentials anywhere, one request per check. [docs/AUTOMATION.md](docs/AUTOMATION.md) has the
full argument.

---

## When it breaks

Amazon reshuffles their markup periodically. Two selectors carry almost everything:

- `.item-return-history-card` — one card per return on the list page
- `qrcode-images` — matched against `img[src]` on the return status page

[docs/NOTES.md](docs/NOTES.md) documents everything non-obvious — presigned
QR URLs, the CORS asymmetry between product and QR images, why the clipboard copy must be
synchronous, why message names can't overlap, and the sorting trap that let an overdue return
hide an upcoming one.

## Repo layout

```
extension/           Chrome extension (MV3)
  background.js        alarm, notifications, badge, Home Assistant push
  offscreen.js         all fetching + parsing (service workers have no DOMParser)
  popup.html/js        toolbar popup
  report.html/js       the QR sheet
dist/                packaged .zip, store screenshot, store icon
docs/                NOTES, HOME-ASSISTANT, CHROME-WEB-STORE, PRIVACY,
                     AUTOMATION, SHARING
package.py           builds the Chrome Web Store zip
make_screenshot.py   renders the 1280x800 store screenshot
```

Rebuild the Chrome Web Store zip after any change:

```bash
python package.py
```

## License

MIT — see [LICENSE](LICENSE).

Not affiliated with, endorsed by, or connected to Amazon.
