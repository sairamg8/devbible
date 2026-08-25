# Topic 02 · Connection pooling with HikariCP — chunk plan (COMPLETE)

Tier: Understand (`t-understand` on every chunk). Coordinator owns `README.md`
and every `← Prev / Next →` footer. Every file's last line is `<!--FOOTER-->`.
`sidebar_position` values are provisional 1..27 and unique; renumber if needed.

| # | pos | File | lines | gotchas | Qs |
|---|---|---|---|---|---|
| 1 | 1 | `01-what-the-pool-hands-you.md` (not mine) | 282 | 6 | 6 |
| 2 | 2 | `02-why-a-small-pool-is-faster.md` (not mine) | 268 | 7 | 6 |
| 3 | 3 | `03-the-connection-budget.md` | 231 | 5 | 6 |
| 4 | 4 | `03b-reducing-cm.md` | 263 | 7 | 6 |
| 5 | 5 | `03c-the-server-side-ceiling.md` | 268 | 7 | 6 |
| 6 | 6 | `03d-the-fleet-budget.md` | 283 | 8 | 7 |
| 7 | 7 | `03e-two-pools-not-one-bigger.md` | 257 | 7 | 7 |
| 8 | 8 | `03f-wiring-a-second-datasource.md` | 272 | 7 | 5 |
| 9 | 9 | `04-the-six-clocks.md` | 297 | 7 | 7 |
| 10 | 10 | `04b-maxlifetime-and-keepalive.md` | 235 | 7 | 5 |
| 11 | 11 | `04c-keepalive-and-the-reapers.md` | 256 | 8 | 7 |
| 12 | 12 | `04d-idletimeout-and-minimumidle.md` | 289 | 8 | 7 |
| 13 | 13 | `04e-when-a-clock-is-silently-disabled.md` | 274 | 8 | 6 |
| 14 | 14 | `05-connection-is-not-available.md` | 278 | 8 | 7 |
| 15 | 15 | `05b-the-exception-underneath.md` | 267 | 8 | 6 |
| 16 | 16 | `06-leak-detection.md` | 240 | 7 | 5 |
| 17 | 17 | `06b-finding-and-preventing-leaks.md` | 276 | 9 | 7 |
| 18 | 18 | `07-session-state.md` | 280 | 8 | 7 |
| 19 | 19 | `07b-what-sql-leaves-behind.md` | 278 | 9 | 7 |
| 20 | 20 | `07c-scoping-state-correctly.md` | 269 | 8 | 6 |
| 21 | 21 | `07d-connection-level-defaults.md` | 272 | 7 | 6 |
| 22 | 22 | `08-starting-up-or-failing-fast.md` | 199 | 6 | 5 |
| 23 | 23 | `08b-readiness-liveness-and-shutdown.md` | 271 | 8 | 6 |
| 24 | 24 | `08c-watching-the-pool.md` | 258 | 9 | 5 |
| 25 | 25 | `08d-the-database-side.md` | 243 | 6 | 6 |
| 26 | 26 | `08e-pgbouncer-in-front.md` | 259 | 7 | 5 |
| 27 | 27 | `08f-operating-two-layers.md` | 260 | 8 | 7 |

**27 files, 7,125 lines. 0 over the 300-line cap. 0 broken links** (every `.md`
target resolved against the filesystem). No console blocks anywhere.

## Split log (rule 1 — split on a concept boundary, never trim)
- 03  drafted at 320 → `03` (the deadlock floor) + `03b` (reducing Cm).
- 03c drafted at 327 → `03c` (the ceiling itself) + `03d` (the fleet budget).
- 03e drafted at 337 → `03e` (why / how big) + `03f` (the Boot 4.1 wiring).
- 04b drafted at 325 → `04b` (maxLifetime) + `04c` (keepaliveTime + the reapers).
  This renamed idleTimeout to `04d` and validateNumerics to `04e`.
- 06  drafted at 311 → `06` (the detector) + `06b` (finding and preventing).
- 07c drafted at 310 → `07c` (transaction scope) + `07d` (connection scope).
- 08  drafted at 306 → `08` (initializationFailTimeout) + `08b` (readiness,
  liveness, shutdown). Monitoring became `08c`, PgBouncer moved down.
- 08c drafted at 315 → `08c` (metrics + alerting) + `08d` (the database side).
- 08e drafted at 328 → `08e` (what transaction mode is and breaks) +
  `08f` (operating two layers).
All inbound links were repointed after each rename and re-verified.
