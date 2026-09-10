# Home Assistant integration

The extension can POST every check to a Home Assistant webhook, so HA holds your return
deadlines and can nag you on its own — including when Chrome has been closed for days and
the extension has gone quiet.

## What the extension sends

Every check, as JSON:

```json
{
  "source": "amazon-return-reminder",
  "checked_at": "2026-09-10T03:27:11.612Z",
  "total_active": 6,
  "overdue": 1,
  "due_soon": 0,
  "next_item": "AC Manifold Gauge Set, 3-Way",
  "next_due": "2026-09-11",
  "next_days_left": 1,
  "overdue_item": "Inline Duct Fan, 6 Inch, with Variable Speed Controller",
  "overdue_due": "2026-08-28",
  "overdue_days": -12,
  "returns": [
    {
      "item": "Inline Duct Fan, 6 Inch, with Variable Speed Controller",
      "rma": "D7kQm2xVRRMA",
      "return_by": "Aug 28",
      "due_date": "2026-08-28",
      "days_left": -12,
      "status": "Drop off at any Kohl's",
      "link": "https://www.amazon.com/spr/returns/prep?..."
    }
  ]
}
```

**Overdue and upcoming are two separate tracks, and that matters.** The first version sent
a single "soonest" return. Because the list sorts ascending by days-left, the most *overdue*
item sorts first — so one long-expired return pinned the countdown to itself forever and hid
every genuine upcoming deadline behind it. With a 50-day-overdue item in the list, a return
actually due tomorrow was never mentioned. They are now reported independently, and the
notification names both.

Counts arrive pre-computed and `due_date` is a real ISO date, so HA never has to parse
`"Sep 28"` or guess a year. That guessing is genuinely awkward — Amazon omits the year, so a
December deadline read in January looks eleven months in the future. The extension resolves
it and HA just consumes the answer.

## Setup

### 1. Create the helpers

Six, all fed by the webhook:

| Entity | Holds |
|---|---|
| `input_number.amazon_returns_active` | count of active returns |
| `input_number.amazon_returns_overdue` | count past the drop-off window |
| `input_number.amazon_returns_due_soon` | count inside the warning window |
| `input_text.amazon_returns_next_item` | soonest **upcoming** return |
| `input_datetime.amazon_returns_next_due` | its deadline |
| `input_text.amazon_returns_overdue_item` | most **overdue** return |
| `input_datetime.amazon_returns_overdue_due` | its expired deadline |
| `input_datetime.amazon_returns_last_check` | when the extension last reported |
| `input_boolean.amazon_returns_stale_alerted` | latch, so an outage warns once not daily |

### 2. Create three automations

**Ingest** — webhook trigger (`local_only: true`, POST only), writes the six helpers.
Templates appear only in `data:` fields, which is where they belong.

**Daily reminder** — 10:00, native `or` of two `numeric_state` conditions
(`overdue > 0` or `due_soon > 0`). Two tiers:

| Days until deadline | Tier |
|---|---|
| 1 or fewer (due tomorrow, today, or already overdue) | **Critical** — `priority: high`, `ttl: 0`, `sticky`, own Android channel |
| 2 or more, within the warning window | Normal |

Escalating *overdue* as well as *due tomorrow* is deliberate: something already past its
window is more urgent than something with a day left, so it would be strange for it to
arrive quieter.

Both notifications go to `notify.mobile_app_<your_phone>` — confirmed as the iPhone 16 via
`device_tracker.<your_phone>`, whose friendly name matches your phone. Worth verifying on any install:
a household with several phones will have several `mobile_app_*` targets, and picking the
wrong one quietly sends your reminders to somebody else.

**Data went stale** — 11:00, deliberately an hour after the reminder so the two can never
arrive together. Notifies if `last_check` is more than 48h old. This one matters most:
without it, an extension that has silently stopped reporting looks exactly like "no returns
due." Silence is not an all-clear.

## Not spamming you

Four independent guards:

1. Time triggers, not state triggers — one run per day each regardless of how often the
   extension posts.
2. `mode: single` — a concurrent run is dropped.
3. The stale alert is latched by `input_boolean.amazon_returns_stale_alerted`, cleared
   automatically by the next successful ingest. A two-week outage produces one alert.
4. Silent when never configured. The first version fired whenever the timestamp was 0,
   which would have nagged daily forever anyone who never connected Home Assistant.

## Critical notifications are platform-specific

The two mobile platforms share nothing here, and sending the wrong keys fails silently —
the notification still arrives, just without the urgency you asked for.

**iOS** (what this setup uses):

```yaml
data:
  push:
    interruption-level: critical   # or time-sensitive
    thread-id: amazon-returns      # collapses into one thread
    sound: { name: default, critical: 1, volume: 1 }
```

`interruption-level: critical` breaks through silent mode and Focus, but **only after you
enable Critical Alerts** in the companion app (app settings → Notifications → Critical
Alerts). Without that permission it degrades to a normal notification rather than failing.
`time-sensitive` breaks through Focus without any special permission and is the softer
option.

**Android** would instead want `ttl: 0`, `priority: high`, `channel:` and `sticky:`. None of
those do anything on iOS. On Android, Do Not Disturb bypass is a per-channel setting the
user enables in system settings — no payload can grant it to itself.

### 3. Point the extension at it

Extension popup → **Settings** → paste the webhook URL:

```
http://homeassistant.local:8123/api/webhook/<your-webhook-id>
```

Chrome will ask for permission to talk to that host — the extension ships holding only
`amazon.com`, and requests anything else at the moment you configure it.

## Notes

**`local_only: true`** means the webhook only accepts requests from your LAN. Correct here:
the browser POSTing is on the same network. If you want checks to land while away from home,
you'd need to drop that — and then anyone who learns the URL can write to your helpers, so
use a long random webhook id.

**Why helpers and not one template sensor.** A trigger-based template sensor could hold the
entire `returns` array in attributes, which is tidier. It needs a `template:` YAML entry —
the UI Template helper has no trigger field. Helpers work through the config API, are
UI-editable, and survive without a config reload. The tradeoff: the full per-return list
lives only in the extension, and HA holds the summary plus the most urgent item.

**Notification `actions` use `action: "URI"`.** Home Assistant's config validator flags
this as an unknown service. It is a false positive: `URI` is a companion-app keyword for
opening a link, not an HA service call.

**Two template conditions are deliberate.** One checks the shape of an incoming JSON field;
the other does datetime-age math on a helper. Neither has a native equivalent — native
conditions operate on entity states, not webhook payloads, and HA has no
"this datetime is older than N hours" condition. Everything else uses native constructs.
