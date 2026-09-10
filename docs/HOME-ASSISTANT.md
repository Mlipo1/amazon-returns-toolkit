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

### 2. Create three automations

**Ingest** — webhook trigger (`local_only: true`, POST only), writes the six helpers.
Templates appear only in `data:` fields, which is where they belong.

**Daily reminder** — fires at 09:00, native `or` of two `numeric_state` conditions
(`overdue > 0` or `due_soon > 0`), notifies your phone.

**Data went stale** — fires at 10:00, notifies if `last_check` is more than 48h old.
This one matters most: without it, an extension that has silently stopped reporting looks
exactly like "no returns due." Silence is not an all-clear.

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

**Two template conditions are deliberate.** One checks the shape of an incoming JSON field;
the other does datetime-age math on a helper. Neither has a native equivalent — native
conditions operate on entity states, not webhook payloads, and HA has no
"this datetime is older than N hours" condition. Everything else uses native constructs.
