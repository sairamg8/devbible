# Topic 09 · Centralized configuration — chunk plan

Tier: **Know**. Breadth over depth: the reader should be able to *choose*, and to recognise the
failure modes. 🔴 Read `../_PHASE-NOTES.md` first — it is binding.

## Boundary
Owns **where a service's configuration comes from when there are thirty of them**: Spring Cloud
Config vs the platform's own ConfigMaps and Secrets, refresh semantics, and secret handling.
🔴 **Phase 9 owns Spring Boot's own config model** (profiles, property sources, relaxed binding,
`@ConfigurationProperties`) — link, do not re-teach. 🔴 **08 owns Consul's discovery half**;
09 covers Consul as a *config* backend only.

## Chunks (a PLAN, not a budget)
| # | File | What it argues |
|---|---|---|
| 1 | `01-the-problem-at-thirty-services.md` | The same change in thirty repos, applied inconsistently |
| 2 | `02-what-should-not-be-centralized.md` | Config that is really code; the flag that should have been a deploy |
| 3 | `03-spring-cloud-config-server.md` | **Config 5.0** — the git-backed server and its layout |
| 3b | `03b-the-config-client.md` | How a Boot 4.1 app imports remote config; `spring.config.import` |
| 3c | `03c-the-config-server-is-now-a-hard-dependency.md` | Startup fails when it is down — fail-fast vs retry, and the honest choice |
| 4 | `04-profiles-labels-and-precedence.md` | Which value actually wins, and how to prove it |
| 5 | `05-refresh.md` | `@RefreshScope`, the `/actuator/refresh` endpoint, and what does **not** refresh |
| 5b | `05b-refresh-is-not-atomic.md` | Thirty services refreshing at different moments is a distributed state |
| 6 | `06-spring-cloud-bus.md` | **Bus 5.0** — broadcast refresh, and why it is less used than it was |
| 7 | `07-configmaps-and-secrets.md` | The Kubernetes-native answer: mounted files and env vars |
| 7b | `07b-a-configmap-change-is-a-restart.md` | Rollout semantics; the subtlety of mounted-file updates |
| 8 | `08-secrets-are-not-configuration.md` | Base64 is not encryption; the separate lifecycle secrets need |
| 8b | `08b-vault.md` | **Vault 5.0** — dynamic secrets and leases, at Know depth |
| 9 | `09-encryption-in-the-config-server.md` | `{cipher}` values, key management, and what it does not protect against |
| 10 | `10-choosing.md` | Decision table: are you on a platform that already ships config |
| 11 | `11-the-checklist.md` | Auditing where a running service's values actually came from |

## Verify, do not assume
- ⚠️ 🔴 Verify how a **Boot 4.1** client imports Config Server properties. `bootstrap.yml` and
  `spring-cloud-starter-bootstrap` were superseded by `spring.config.import` — confirm the
  current form from the Config 5.0 reference and **say the old form is gone** if it is.
- ⚠️ Verify exactly what `@RefreshScope` does and does not rebind — the list of things that do
  not refresh is the useful half of this topic.
- ⚠️ Check what phase 9 already covered: `ls ../../phase-9-spring-boot/`. Link, do not repeat.
- ⚠️ **No cluster, no sandbox.** No `kubectl describe configmap` output, no actuator responses
  that were not in the documentation.
