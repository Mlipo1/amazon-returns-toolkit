# Amazon Returns Toolkit

Amazon buries your return deadlines and never shows a return code you can write down —
the QR image is the only scannable artifact, and it lives three clicks deep, one return
at a time.

Two small tools fix that. Both run entirely in your own browser using the Amazon session
you already have. No account, no server, no API key, no password stored anywhere.

| | What it does |
|---|---|
| **Extension** | Checks your returns in the background and warns you before a drop-off deadline passes — *and* collects every return's QR code onto one page in a single click. Install once, then nothing. |
| **Bookmarklet** | The same QR sheet, with nothing installed. A bookmark you drag to the bar. Useful if you don't want an extension at all. |

**The extension now does everything the bookmarklet does.** The bookmarklet remains for
people who'd rather not install anything — it needs no permissions and no install, but only
works while you're on an `amazon.com` tab.

---

## Extension — never miss a deadline

Checks every 3 hours in the background, notifies at most once a day, and tells you loudly
when it *couldn't* check rather than staying silent.

### Install

1. Download or clone this repo.
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and pick the `extension/` folder.

That's the whole setup. Works in Chrome, Edge, Brave, and other Chromium browsers.

### Using it

Nothing to do — it runs on its own. Click the toolbar icon to see the current list, force a
check, or change settings:

- **📦 Get my QR codes** — opens a page with every active return: product photo, scannable
  QR, Return ID, deadline. Email it, copy it, or print it.
- **Warn me this many days ahead** — default 3.
- **Home Assistant webhook** — optional. Every check POSTs the full list as JSON, so you can
  build your own automations on top. Leave blank to skip.

The badge shows how many returns are due soon or overdue, red if anything is overdue.

### Home Assistant

Optional. Put a webhook URL in the extension's settings and every check POSTs the full list
as JSON — counts, per-return deadlines as real ISO dates, RMA, and link. HA can then hold
your deadlines, remind you on its own schedule, and — importantly — warn you when the
extension has *stopped* reporting.

[docs/HOME-ASSISTANT.md](docs/HOME-ASSISTANT.md) has the payload shape, the helpers, and the
three automations, including why the staleness watchdog matters more than the reminder
itself.

### Why it's built this way

The obvious design — a server or cron job that logs into Amazon on a schedule — fails badly.
It needs your credentials parked in a headless browser, gets re-challenged for an OTP the
moment the device fingerprint shifts, and trips bot detection that returns a *200 with a
CAPTCHA body*, which a naive scraper reads as "no returns due."

Running as an extension in your own browser sidesteps all of it. Your real session, your real
fingerprint, no credentials anywhere, one GET per check. See
[docs/AUTOMATION.md](docs/AUTOMATION.md) for the full argument.

Failure is never silent: signed out, blocked, or markup drift all produce a **check failed**
notification and a `!` badge. "Couldn't check" and "nothing due" never look the same.

---

## Bookmarklet — every QR in one place

Builds a single page with all your active returns, then emails it to yourself.

### Install

1. Open `bookmarklet/install.html` in your browser.
2. **Drag** the yellow button to your bookmarks bar. Don't click it there — it only works
   from `amazon.com`. (`Ctrl+Shift+B` shows the bookmarks bar.)

### Using it

On any `amazon.com` page, click **📦 My Return Codes**. You get a page with each return's
photo, QR, Return ID and deadline, plus:

- **Email to…** — copies everything as rich HTML and opens a Gmail draft. Click in the body,
  press `Ctrl+V`, then Send. The paste is required: Gmail's compose link can't carry images.
- **Send to:** — manage recipients. Your Amazon account address is detected and added on
  first run; remove it or add others, and it's remembered.
- **Copy as text** / **Print**.

---

## What these do and don't do

**Read-only.** They fetch your returns pages and parse them. Nothing is cancelled, edited,
or submitted, and no email sends until you press Send yourself.

**Nothing leaves your browser.** Recipients and settings live in `localStorage` /
`chrome.storage.local`. The only outbound request is the optional Home Assistant webhook you
configure yourself.

**QR links expire after 7 days.** They're presigned S3 URLs. Every row carries an
*Open on Amazon* link that loads a fresh one.

**US Amazon only.** Selectors are matched against `amazon.com`. Other locales will likely
need adjusting.

## When it breaks

Amazon reshuffles their markup periodically. Two selectors carry almost everything:

- `.item-return-history-card` — one card per return on the list page
- `qrcode-images` — matched against `img[src]` on the return status page

[docs/NOTES.md](docs/NOTES.md) documents the non-obvious behaviour behind both tools —
presigned QR URLs, the CORS asymmetry between product and QR images, why the clipboard copy
must be synchronous, and other things that cost real time to discover.

## Repo layout

```
extension/           Chrome extension (MV3)
bookmarklet/         source.js -> build.py -> install.html
dist/                packaged .zip + store screenshot
docs/                NOTES.md, HOME-ASSISTANT.md, CHROME-WEB-STORE.md,
                     PRIVACY.md, AUTOMATION.md, SHARING.md
package.py           builds the Chrome Web Store zip
make_screenshot.py   renders the 1280x800 store screenshot
```

Editing the bookmarklet means editing `bookmarklet/source.js`, then:

```bash
python bookmarklet/build.py
```

which re-encodes it into `install.html`. Re-drag the button afterwards.

## License

MIT — see [LICENSE](LICENSE).

Not affiliated with, endorsed by, or connected to Amazon.
