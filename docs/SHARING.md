# Share sheet

Send them the repo, or just a copy of the `extension/` folder.

## What they need

Desktop Chrome, Edge, or Brave. Signed in to `amazon.com`. Nothing else — no account, no
Python, no server.

## What they do

1. `chrome://extensions` → turn on **Developer mode** (top right)
2. **Load unpacked** → pick the `extension/` folder
3. Done. It checks in the background from then on.

For the QR sheet: click the toolbar icon → **📦 Get my QR codes**.

## Worth telling them

- **It only reads.** Nothing is cancelled, edited, or submitted, and no email sends until
  they press Send themselves.
- **The email step needs a `Ctrl+V`.** Gmail's compose link can't carry images, so the sheet
  is copied to the clipboard and pasted into the draft.
- **QR links expire after 7 days.** Every row has an *On Amazon* link that loads a fresh one.
- **Their email stays in their own browser.** The detected Amazon account address is only a
  starting point — removing it sticks.
- **Removing the extension wipes its settings.** That's Chrome, not a bug. So does loading
  the same code from a different folder, since an unpacked extension's identity comes from
  its path.
- **US Amazon only** for now.

## If it breaks

Amazon reshuffles their HTML now and then. The two fragile selectors are named in
[NOTES.md](NOTES.md).
