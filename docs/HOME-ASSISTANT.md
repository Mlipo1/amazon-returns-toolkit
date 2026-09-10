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
  "next_item": "Inline Duct Fan, 6 Inch, with Variable Speed Controller",
  "next_due": "2026-08-28",
  "next_days_left": -12,
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
| `input_text.amazon_returns_next_item` | name of the most urgent one |
| `input_datetime.amazon_returns_next_due` | its deadline |
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

## Android and Do Not Disturb

The critical tier sets `priority: high`, `ttl: 0` and its own channel (`Amazon Returns
Urgent`), which gets it past Doze and keeps it on screen until dismissed. It does **not**
bypass Do Not Disturb on its own — Android only allows that if you mark the channel as an
override in system settings, and no payload can grant itself that. The channel appears in
Android's notification settings after the first critical notification arrives.

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
