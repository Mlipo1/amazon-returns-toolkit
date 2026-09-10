# Share sheet

Two ways to give this to someone. The extension is the better one.

---

## Option A — the extension (recommended)

Send them the repo, or a copy of the `extension/` folder.

**They need:** desktop Chrome, Edge, or Brave. Signed in to `amazon.com`.

**They do:**

1. `chrome://extensions` → turn on **Developer mode** (top right)
2. **Load unpacked** → pick the `extension/` folder
3. Done. It checks in the background from then on.
4. For the QR sheet: click the toolbar icon → **📦 Get my QR codes**

**Worth telling them:**

- It only reads. Nothing is cancelled, edited, or submitted, and no email sends until they
  press Send.
- The email step needs a `Ctrl+V` — Gmail's compose link can't carry images, so the sheet is
  copied to the clipboard and pasted in.
- QR links expire after 7 days. Every row has an *On Amazon* link that loads a fresh one.
- Their email stays in their own browser. The detected Amazon address is only a starting
  point — removing it sticks.
- Removing the extension wipes its settings. That's Chrome, not a bug.

---

## Option B — the bookmarklet (nothing installed)

Send them one file: `bookmarklet/install.html`. Everything is baked into it — no install,
no Python, no account.

**They need:** desktop Chrome, Edge, or Firefox (not mobile — bookmarklets don't work there).
Signed in to `amazon.com`. Popups allowed for `amazon.com`.

**They do:**

1. Open `install.html`. **Drag** the yellow button to the bookmarks bar — don't click it
   there. (`Ctrl+Shift+B` if the bar is hidden.)
2. Go to `amazon.com`, click **📦 My Return Codes**
3. First run: it suggests their Amazon sign-in email — accept or replace it
4. **Email to…**, then `Ctrl+V` in the Gmail tab, then Send

**The catch:** it only runs while they're on an `amazon.com` tab. Clicked anywhere else it
explains itself and offers a link.

---

## If it breaks

Amazon reshuffles their HTML now and then. The two fragile selectors are named in
[NOTES.md](NOTES.md).
