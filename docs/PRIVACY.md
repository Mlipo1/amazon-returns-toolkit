# Privacy Policy — Amazon Return Reminder

_Last updated: 2026-09-09_

## The short version

This extension collects nothing, transmits nothing, and has no server. Everything it reads
stays on your computer.

## What it reads

When it runs a check, it requests `amazon.com/your-returns` using the Amazon session already
in your browser, and reads from that page:

- the product name of each active return
- the drop-off deadline
- the return status and Return ID (RMA)
- the link to that return on Amazon

That's the same page you can open yourself. The extension does not have, ask for, or store
your Amazon password, and it never cancels, edits, or submits anything on your account.

## Where it goes

Nowhere. Results are stored in `chrome.storage.local` on your own machine so the popup can
show them and so it knows whether it already notified you today. There is no analytics, no
telemetry, no crash reporting, no remote server, and no third party of any kind.

Nothing is sold, shared, or transferred to anyone.

## The one exception, which you control

If you enter a Home Assistant webhook URL in the extension's settings, each check POSTs your
return list to that address. That address is one you own and type in yourself — typically a
machine on your own network. Chrome asks your permission before the extension can send to it,
and the extension only requests access to that one origin.

Leave the field blank and no outbound request is ever made.

## Permissions

| Permission | Why |
|---|---|
| `alarms` | Run the check on a schedule |
| `notifications` | Show the deadline warning |
| `storage` | Remember your settings and the last result, locally |
| `offscreen` | Parse the returns page HTML (MV3 service workers can't) |
| `*://*.amazon.com/*` | Read your returns page |
| `*://*/*` (optional) | Only if you configure a Home Assistant webhook, and only for that address |

## Removing your data

Uninstalling the extension deletes everything it stored. There's nothing held anywhere else,
so there is nothing to request or delete from us.

## Contact

Issues and questions: https://github.com/Mlipo1/amazon-returns-toolkit/issues
