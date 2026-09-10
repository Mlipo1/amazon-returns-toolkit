# Amazon Return Codes — share sheet

Pulls every active Amazon return into one page — item photo, scannable QR, return
deadline — and emails it to yourself.

## Send them one file

`install.html`. That's it. The whole tool is baked into it — no install, no Python,
no account, nothing to run.

## What they need

- Desktop Chrome, Edge, or Firefox (not mobile — bookmarklets don't work there)
- Signed in to `amazon.com` in that browser
- Popups allowed for `amazon.com`
- Gmail, for the last step. Any webmail that accepts a paste works too.

## What they do

1. Open `install.html`. **Drag** the yellow button to the bookmarks bar — don't click it there.
   (`Ctrl+Shift+B` if the bar is hidden.)
2. Go to `amazon.com`, click **📦 My Return Codes** in the bookmarks bar.
3. It detects the email on their Amazon account and uses it automatically. On the report
   there's a **Send to:** row — add more addresses, or remove any (including the detected
   one). Saved for next time.
4. Click **Email to…**, then in the Gmail tab press `Ctrl+V` and Send.

The `Ctrl+V` isn't optional — Gmail's compose link can't carry pictures, so the button
copies the whole thing to the clipboard and you paste it in.

## Worth telling them

- **It only reads.** Nothing gets cancelled, edited, or submitted, and no mail sends until
  they press Send.
- **QR images expire in 7 days.** Every row has an *Open on Amazon* link that loads a fresh one.
- **Recipients stay in their own browser** (`localStorage`), never sent anywhere. The
  detected address is only a starting point — removing it sticks, and it won't come back
  on its own.
- **It only runs on `amazon.com`.** Clicked anywhere else it explains itself and offers a link.

## If it breaks

Amazon reshuffles their HTML now and then. See `README.md` — the two fragile selectors are
named there.
