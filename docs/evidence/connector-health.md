# Connector health report

- Generated: **2026-11-14T09:50:37.256653+00:00**
- Sources checked: **11**
- Healthy: **7** · Degraded: **2** · Down: **2**
- Method: one HTTPS `GET` per source endpoint, 10 s timeout (`BaseConnector.health`).
- Note: a `healthy` HTTP status only proves reachability; it does not guarantee a usable JSON API.

| # | Source | Kind | Status | Latency | Detail | License | Checked at |
|---|---|---|---|---|---|---|---|
| 1 | `athens` | govtech | **healthy** | 4501 ms | HTTP 200 | Διάφορες — ελέγχεται ανά dataset | 2026-11-14T09:50:37.257157+00:00 |
| 2 | `ckan` | open_data | **healthy** | 3746 ms | HTTP 200 | Διάφορες — ελέγχεται ανά dataset | 2026-11-14T09:50:37.987295+00:00 |
| 3 | `data_europa` | open_data | **healthy** | 2895 ms | HTTP 200 | Διάφορες — ελέγχεται ανά dataset | 2026-11-14T09:50:38.258932+00:00 |
| 4 | `diavgeia` | govtech | **healthy** | 3288 ms | HTTP 200 | Ελεύθερη χρήση δημοσίων αποφάσεων | 2026-11-14T09:50:38.531092+00:00 |
| 5 | `elstat` | statistics | **healthy** | 2539 ms | HTTP 200 | Ελεύθερη χρήση με αναφορά πηγής | 2026-11-14T09:50:38.797653+00:00 |
| 6 | `eurostat` | statistics | **degraded** | 2221 ms | HTTP 404 | CC BY 4.0 (EU) | 2026-11-14T09:50:39.059131+00:00 |
| 7 | `kimdis` | govtech | **down** | — | [Errno 11001] getaddrinfo failed | Δημόσια πληροφορία | 2026-11-14T09:50:39.322348+00:00 |
| 8 | `openmeteo` | weather | **healthy** | 1467 ms | HTTP 200 | CC BY 4.0 | 2026-11-14T09:50:39.637073+00:00 |
| 9 | `overpass` | geospatial | **down** | — | ReadTimeout:  | ODbL 1.0 | 2026-11-14T09:50:39.919605+00:00 |
| 10 | `websearch` | web | **healthy** | 985 ms | HTTP 202 | Ποικίλες — ελέγχεται ανά πηγή | 2026-11-14T09:50:40.218664+00:00 |
| 11 | `wikipedia` | web | **degraded** | 739 ms | HTTP 403 | CC BY-SA 4.0 | 2026-11-14T09:50:40.518665+00:00 |

## Known limitations (honest degradation)

- **ELSTAT** exposes no public JSON search API. The connector returns curated, official
  publication pages (real URLs) rather than invented records; `healthy` here means the
  portal is reachable, not that a machine API exists.
- **ΚΗΜΔΗΣ** is best-effort JSON. HTML or DNS failures degrade to `[]`; the platform
  reports it as `down`/`degraded` instead of fabricating contracts.
- **Eurostat** returns 404 on its bare root; the data endpoint needs dataset parameters,
  so a `degraded` probe is expected and is not hidden.
- **Overpass** rejects bare GETs (406); its health probe runs a tiny real query instead.

## Reproduce

```bash
python scripts/connector_health.py
```
