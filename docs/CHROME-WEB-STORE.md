# Publishing to the Chrome Web Store

Everything needed is prepared. What's left needs a human: the fee, the account, and the
submit button.

## Cost

**$5, one time.** A Chrome Web Store developer registration fee, paid once per account —
not per extension, not annual. There is no other cost.

## Steps

1. Go to the [Developer Dashboard](https://chrome.google.com/webstore/devconsole) and sign in.
2. Pay the $5 registration fee.
3. **Add new item** → upload `dist/amazon-return-reminder-v1.1.0.zip`.
4. Fill the listing from the copy below.
5. Add at least one screenshot (1280×800 or 640×400) — `dist/screenshot-popup.png`.
6. Set the privacy fields (below), then **Submit for review**.

Review typically takes a few days. Extensions requesting host permissions get more scrutiny,
which is why the justifications below matter.

---

## Listing copy

**Name**

```
Amazon Return Reminder
```

**Short description** (132 char max)

```
Warns you before an Amazon return drop-off deadline passes. Checks in the background, notifies once a day. No account needed.
```

**Category:** Productivity — **Language:** English

**Detailed description**

```
Amazon buries your return deadlines. The drop-off date sits three clicks deep, one return at
a time, and nothing reminds you before it passes.

This checks your returns page in the background and tells you before you run out of time.

WHAT IT DOES
- Checks your Amazon returns every few hours, quietly
- Desktop notification when a return is overdue or its deadline is close
- Badge on the toolbar icon showing how many need attention
- A popup listing every active return, its deadline, and its Return ID
- Adjustable warning window (default: 3 days)
- Optional: POST each check to a Home Assistant webhook for your own automations

HOW IT WORKS
It reads the same returns page you'd read yourself, using the Amazon session already in your
browser. No account, no password, no server. One request per check.

IT NEVER GOES QUIET ON YOU
If it can't check — signed out, blocked, or Amazon changed their page — it says so, with a
"check failed" notification and a warning badge. A reminder tool that has silently stopped
reminding you is worse than none, so "couldn't check" and "nothing due" never look the same.

PRIVACY
Nothing is collected, transmitted, or sold. Your return data stays in your browser. The only
outbound request is to a Home Assistant webhook you configure yourself, if you choose to.

Open source: https://github.com/Mlipo1/amazon-returns-toolkit
Not affiliated with or endorsed by Amazon.
```

---

## Privacy practices

**Single purpose**

```
Notifies the user before an Amazon return drop-off deadline passes by reading their Amazon
returns page in the background.
```

**Permission justifications**

| Permission | Justification |
|---|---|
| `alarms` | Schedules the periodic background check. The extension's entire purpose is checking on a schedule without the user acting. |
| `notifications` | Delivers the deadline warning. This is the extension's only output. |
| `storage` | Stores the user's warning-window setting, optional webhook URL, and the last check result shown in the popup. Local only. |
| `offscreen` | MV3 service workers have no DOMParser. An offscreen document parses the returns page HTML. Nothing is rendered or shown to the user. |
| `host_permissions: *://*.amazon.com/*` | Reads `amazon.com/your-returns` to find active returns and their deadlines. This is the data the extension exists to report on. |
| `optional_host_permissions: *://*/*` | Only requested if the user enters a Home Assistant webhook URL, and only for that origin. Self-hosted HA has no fixed hostname, so the origin can't be declared in advance. Not requested otherwise. |

**Data usage** — tick these and nothing else:

- Does NOT collect or use user data for any purpose beyond the single purpose above
- Not sold to third parties
- Not used or transferred for creditworthiness or lending

**Data types collected:** none. All data stays in `chrome.storage.local` on the user's
machine. The optional webhook sends to a user-controlled address on their own network.

**Privacy policy URL**

```
https://github.com/Mlipo1/amazon-returns-toolkit/blob/main/docs/PRIVACY.md
```

---

## Likely review friction

**`optional_host_permissions: *://*/*` is broad.** It's the honest way to support a
self-hosted service with no fixed hostname, and it's optional and origin-scoped at request
time. If a reviewer pushes back, the fallback is dropping the Home Assistant feature from
the store build and keeping it in the GitHub version.

**Scraping.** The extension reads a page the signed-in user can already see, using their own
session, and shows it back to them. It does not bypass authentication or automate any action
on the account. Say exactly that if asked.

**Rebuilding the zip** after any change:

```bash
python package.py
```
