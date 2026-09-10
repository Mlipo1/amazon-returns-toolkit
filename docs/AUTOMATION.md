# Why this isn't a cron job

Notes from 2026-09-09, kept so the question doesn't get re-litigated from scratch.

The scrape works because it runs inside an already-authenticated browser. Moving it to a
schedule means owning an Amazon session headlessly, and that's where it falls apart.

## What full automation needs

Playwright + a persisted storage state (`at-main`, `sess-at-main`, `ubid-main`, `x-main`),
captured from one manual login and reloaded each run. Scrape, then POST to an HA webhook.
~150 lines. The code is not the hard part.

## How it breaks

**Re-authentication.** Amazon re-challenges on fingerprint change. A container differs from
the desktop in UA, TLS fingerprint, screen metrics and usually egress IP, so re-challenge is
routine — and it asks for an OTP, which nothing unattended can answer.

**Bot detection.** `/your-returns` is authenticated and gets more scrutiny than a product
page. Headless Chrome is detectable well past `navigator.webdriver`. The failure is a 200
with a CAPTCHA body, not an exception.

**Selector drift.** `.item-return-history-card` and `qrcode-images` will move. Run by hand,
that's visible immediately. Run at 06:00, it isn't.

**Silent failure — the one that matters.** All three above produce output identical to an
empty return list. A reminder system that has quietly stopped reminding you is worse than
none, because you've stopped checking manually by then. The whole point was not forgetting.

## If built anyway, two non-negotiables

1. Run it on this machine against the real Chrome profile (`--user-data-dir`), not in a
   container. Same IP, same fingerprint, far fewer re-challenges.
2. Make failure loud. Zero cards **or** a sign-in page in the response fires a "returns check
   failed" notification. Never let "0 returns" and "broken" render the same.

## Preferred alternative

Daily HA automation nudging you to click the bookmarklet, plus a webhook push when you do,
so HA holds the real due dates and reminds on those. No stored session, nothing to detect,
nothing to rot silently. Keeps the one click that already happens.

## Middle option

HA's IMAP integration parsing Amazon's return-initiated emails. Fully automatic, no Amazon
session involved. Weaker data — the drop-off deadline often isn't in the email — so it's
good for "a return is open," poor for "it's due Thursday."
