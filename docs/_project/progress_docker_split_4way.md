---
name: devbible-docker-split-4way
description: The FOUR-way Docker & Podman split (chunks A B C D) — per-chunk phases, cursor, rules. Open this on "pick docker A".
metadata:
  type: progress
---

🔴 **This is the live cursor for Docker & Podman.** Open it the moment the user says
*"pick docker A"* (or B, C, D) and start at that chunk's cursor. Background, version facts,
page shape and the per-phase claim tables for the **written** phases 0–3 stay in
[[devbible-docker-podman-progress]] — read that once for the house style, then work from here.

## 🔴 How a session is started — recognise this and act, do not ask

**The user types Docker plus a letter, and that is the whole instruction.** All of these mean
the same thing and require **no clarifying question, no plan, no "shall I begin"**:

> *"pick docker A"* · *"docker chunk B"* · *"docker C"* · *"take D"* · *"podman D"*

**A phase number settles it too:** 4 or 5 → **A** · 6 or 7 → **B** · 8 or 9 → **C** ·
10, 11 or 12 → **D**. Only ask if the user says "Docker" with **no letter and no phase**,
because guessing duplicates another session's work in the same checkout.

**On seeing one:** claim the chunk (your session id into the chunk table in
`docs/docker/pages/README.md` **and** into that chunk's row in `docs/README.md`), then start
writing at the topic the cursor names. 🔴 **Naming a chunk transfers it to the session it was
named in** — if a row shows an older session id, take it over and say so.

## The split — set 2026-08-15

**129 in-scope topics left of 192, split four ways, WHOLE PHASES ONLY** — so no two sessions
ever write in the same phase directory or touch the same phase `README.md`. Counted by parsing
every tier badge in `docs/docker/syllabus/*.md`; phases 0–3 (63 topics) are already written.

| Chunk | Phases | Left | Why these are paired |
|---|---|---|---|
| **A** | **4** Build strategy: cache, multi-stage, BuildKit (16) · **5** Image quality, size and supply chain (12) | **28** | Closes Part 2. Both are about the artefact you ship — the cache decides how fast it builds, phase 5 decides what is inside it, and multi-stage is the answer in both |
| **B** | **6** Storage: volumes, mounts and data (12) · **7** Networking (14) | **26** | The two things a container needs from the host. They share one root cause — rootless UID mapping and rootless networking are the same user-namespace story |
| **C** | **8** Compose (17) · **9** The MERN/PERN stack in containers (14) | **31** — 🏁 **CHUNK C COMPLETE 31/31** (phase 8 17/17, phase 9 14/14) | Phase 9 **is** phase 8 applied — the worked `compose.yaml` in 9 is the deliverable phase 8 builds up to. Splitting them would duplicate every healthcheck and volume argument |
| **D** | **10** Running in production (16) · **11** Podman in depth (16) · **12** Delivery, CI and orchestration (12) | 🏁 **44 — COMPLETE, all three phases closed** | The whole of Part 4. Quadlet (11) is how phase 10's "containers under systemd" is actually done, and phase 12's deploy-without-an-orchestrator answer is Quadlet or Compose on a VM |

⚠️ **D is the heaviest at 44 and A/B the lightest at 28/26** — deliberate, because the pairs
above are the ones that would otherwise duplicate each other's arguments. If the user wants the
tail levelled, the clean cut is handing **phase 12 (12 topics)** to whichever of A or B finishes
first; it is the most self-contained phase left. Do not re-cut it silently.

## Cursors — update your own row and nothing else

| Chunk | Phase | Written | 🔴 Start at | Held by |
|---|---|---|---|---|
| **A** | 4 | ✅ **16/16 DONE** | — phase 4 closed 2026-08-15, **16 files / 3,592 lines / 0 over 300 / 139 internal links resolved against the filesystem (not built)** | ✅ session `2e26b051` → closed out by `e75b3868` |
| **A** | 5 | 🏁 **12/12 DONE** | — 🏁 **CHUNK A IS COMPLETE, 28 of 28.** Phase 5 closed 2026-08-15: **14 files, 3,100 lines, largest 290, 0 over cap, 0 broken links, every page badged + `> Verified:`** — link-checked against the filesystem, **NOT built**. ⚠️ 10 is a **chunked directory** `10-static-binaries/`. Detail: [[devbible-session-20260815-docker-chunk-a]] | ✅ session `e75b3868` (took over from `2e26b051`) |
| **B** | 6 | 🏁 **12/12 DONE** | — phase closed 2026-08-15: 20 files, 4,270 lines, 0 over cap, 97 links resolved against the filesystem (not built) | session `d0c46f84` — chunk complete |
| **B** | 7 | 🏁 **14/14 DONE** | — phase closed 2026-08-15: **15 files, 3,131 lines, 0 over cap, 0 broken internal links (link-checked, not built)**. 🏁 **CHUNK B IS COMPLETE, 26/26 — free to pick up** | session `d0c46f84` (took over from `17c9da97`) |
| **C** | 8 | 🏁 **17/17 DONE** | — **phase 8 closed 2026-08-15: 28 files, 5,563 lines, largest 286, 0 over cap, 0 unresolved internal links, link-checked against the filesystem (NOT built)**. Master 6/6 · Understand 7/7 · Know 4/4. ✅ 01–17 — 01 (286), 02 Spec (**chunked** 473), 03 up/down (**chunked** 503), 04 services (**chunked** 557), 05 depends_on (271), 06 healthchecks (**chunked** 518), 07 networks (253), 08 volumes (254), 09 project name (198), 10 env+interpolation (225), 11 override files (237), 12 profiles (189), 13 develop.watch (270), 14 day-to-day commands (**chunked** 531), 15 podman compose (227), 16 include/extends (250), 17 --scale and the limits (216) | 🔴 session `9219957a` (2026-08-15) |
| **C** | 9 | 🏁 **14/14 DONE** | ▶ **RESUMED 2026-08-15, session `016J3KVb`** on *"docker and podman pick chunk c"* — chunk taken over from `9219957a`. 🏁 **Topic 07 COMPLETE as a SEVEN-chunk directory** `07-the-whole-stack/` (**8 files, 1,842 lines, largest 297, 0 over cap**, commits `db269b5c` + `d2fc0e23`) — the first draft of the walkthrough hit **438 lines** and was **split on concept boundaries, not trimmed**, twice: `01-the-file.md` (269 — the complete worked `compose.yaml`, no `version:`, YAML quoting) · `02-the-anchor.md` (235 — the `x-` field, the merge key, why `environment` is a mapping) · `03-the-wiring.md` (244) · `04-the-stateful-services.md` (297) · `05-the-api-and-the-frontend.md` (260) · `06-the-proxy.md` (234) · `07-the-boot-and-proving-it.md` (223) · `README.md` (80). ⚠️ **The internal chunk names were decided during writing; only the `07-the-whole-stack`
directory name was reserved in advance.**
🔴 **SELF-AUDIT CORRECTION, 2026-08-15 (`d2fc0e23`) — read this, it is the rule-1 trap caught in
the act.** The user asked whether the "300 lines is a FILE-SIZE cap, never a content budget" rule
had actually been followed. It had not, twice: **`07/01-the-file.md` and
`08-mongodb-in-a-container.md` were each REWORDED down to land at EXACTLY 300** instead of being
split at 301. Two files at exactly 300 is the documented fingerprint. Real content was lost in
07/01 — the `extends` bullet had `volumes` deleted from the list of resources `extends` does not
import, and the "shares configuration but" clause was cut, purely to save a line. **Remedy:
content restored, and both split on real concept boundaries** — 07 gained `02-the-anchor.md`
(chunks 02–06 renumbered to 03–07, every inbound link repointed) and 08 became a chunk directory
(`01-running-one.md` standalone / `02-the-replica-set.md`). Phase 9 went **29 files / 6,151 lines
→ 32 files / 6,501 lines**, largest **297**, nothing at or over the cap. ⚠️ **The lesson to carry:
reflowing prose to squeeze under the cap is the same violation as cutting a section — at 301,
SPLIT. And watch for the tell yourself: if two files land on exactly 300, you budgeted.** ✅ **Topic 08 · MongoDB in a container** (300 lines, commit `1fc71bbd`) — the replica-set requirement behind transactions and change streams, `--keyFile` implying client access control, and the `mongosh` exit-code trap. ✅ **Topic 09 · Redis in a container** (269 lines, commit `2a24f676`). ✅ **Topic 10 · Migrations and seeds** (284 lines, commit `45b97761`). ✅ **Topic 11 · Debugging Node inside a container** (274 lines, commit `a8f7bfdc`). ✅ **Topic 12 · A React/Vite frontend** (253 lines, commit `97a727ce`). ✅ **13 · Nginx in front of the API** (258, commit `97e67802`) · ✅ **14 · Connecting from the host** (216, commit `66ec0184`). 🏁 **PHASE 9 CLOSED 2026-08-15 — 14/14 at every tier (Master 5/5 · Understand 7/7 · Know 2/2): 32 files, 6,501 lines, largest 297, 0 over the cap, 281 internal links resolved against the filesystem — link-checked, NOT built.** 🏁 **CHUNK C IS COMPLETE, 31 of 31 — free to pick up.** ✅ 01 Containerising a Node/Express API (Master, **chunked** `01-node-api-dockerfile/`, 575) · ✅ 02 Dev vs prod image (225) · ✅ 03 PostgreSQL in a container (Master, **chunked**, 531) · ✅ 04 Waiting for the database (Master, **chunked**, 513) · ✅ 05 Hot reload (Master, **chunked**, 474) · ✅ 06 Secrets in dev vs prod (243). Everything phase 9 needs is already argued in phase 8 — cross-link it rather than re-explaining healthchecks, `depends_on`, volumes or interpolation | 🔴 session `016J3KVb` (2026-08-15, took over from `9219957a`) |

## 🏁 CHUNK C IS FINISHED — 2026-08-15, session `016J3KVb`

🔴 **Two self-inflicted defects were found and fixed at the end of this session. Read both.**
1. **Rule 1 violated** — two files reworded down to exactly 300 instead of split at 301, one
   losing real content. Fixed by splitting; detail in the chunk-C cursor row above.
2. **A `_category_.json` written through a python heredoc landed as one physical line of
   invalid JSON (`d2fc0e23`) and took the WHOLE SITE's sidebar down for every session** until
   `f3a46449`. ⚠️ **Never write `_category_.json` through a heredoc with escaped newlines —
   use the file tool and look at the result.** It does not fail locally to the language that
   owns it; it fails globally, and another session has to come and tell you.

**Nothing is left in chunk C.** This block is the close-out record; it supersedes the earlier
handoff from session `9219957a`, which ended at topic 07.

| | |
|---|---|
| Where | **`main`**, `/mnt/Storage/Backup/Knowledge/devbible`. ⛔ **No worktree exists and none was created** — `git worktree list` shows one entry, the main checkout. Nothing to merge, nothing to delete |
| Committed? | ✅ **Yes, everything.** Last chunk-C commit `66ec0184`. Nothing is uncommitted |
| Chunk C state | 🏁 **31 of 31 — phase 8 CLOSED 17/17, phase 9 CLOSED 14/14. Nothing left** |
| 🔴 Resume at | — nothing. **Chunk C is free to pick up.** Chunk D (phases 11, 12) is the only Docker work still open |
| Built? | ✅ **YES — build-verified.** Every page was link-checked against the filesystem first (**281/281 resolve**). Then chunk C claimed the registry row to verify a `_category_.json` fix: two isolated builds got past `sidebars.js` and all content plugins with **0 broken links and 0 docker mentions**. 🔴 **And once TypeScript phase 3 settled, session `3af83cbb` ran a full site build that came back `[SUCCESS]` with 0 warnings / 0 broken links across the WHOLE site including Docker** (recorded in `shared/session_build_devserver_registry.md`). So phase 9 may be reported as **built and green** — earlier chunk-C reports that say "link-checked, NOT built" describe the state before that run |

⚠️ **Other sessions are live in this checkout** and their uncommitted `phase-10-*` edits may
be sitting in `git status`. **Never `git add -A`; stage explicit paths.**

⚠️ **There is no git identity on this machine** (`~/.gitconfig` absent). Commit with
`git -c user.name=sairamgudiputi -c user.email=sairamgudiputi8@gmail.com commit …`.

⚠️ **Earlier note said the memory store cannot push from the sandbox. That is no longer true** —
`git push` to `sairamg8/claude-context` succeeded on 2026-08-15 from session `016J3KVb`. Try the
push; if it fails with "correct access rights", commits are local until the user pushes, and that
is not an error to fix.

### The 8 topics left in chunk C

| # | Topic | Tier | Notes for whoever writes it |
|---|---|---|---|
| 07 | The whole stack in one file | Master | The phase deliverable. API + Postgres + Redis + frontend + proxy in one worked `compose.yaml`. Will exceed 300 → chunk it. **Reuse phase 8, do not re-argue it** |
| 08 | MongoDB in a container | Understand | Fetch the official `mongo` image docs: `MONGO_INITDB_ROOT_USERNAME/PASSWORD`, `MONGO_INITDB_DATABASE`, `/docker-entrypoint-initdb.d`, the `/data/db` volume, and the **replica-set requirement for transactions and change streams** |
| 09 | Redis in a container | Know | Official `redis` image: `/data` volume, RDB vs AOF (`--appendonly yes`), passing a `redis.conf`, and whether a cache should persist at all |
| 10 | Migrations and seeds | Understand | Already half-argued in 04's startup-gate chunk: `service_completed_successfully` + `restart: "no"`, and `compose run --rm` |
| 11 | Debugging Node inside a container | Understand | `--inspect=0.0.0.0:9229`, publishing 9229, ⚠️ it is **remote code execution** — dev override only (topic 02 already says this) |
| 12 | A React/Vite frontend | Understand | Vite facts are already recorded below (`server.host`, `strictPort`, `usePolling`, `server.ws`). Add: build-time `VITE_*` env is **baked at build**, so the API URL is a build-time problem |
| 13 | Nginx in front of the API | Understand | One origin, no CORS, where TLS terminates. `docs/nginx/` exists as its own track — link only if the target file is verified to exist |
| 14 | Connecting from the host | Know | `psql`/`mongosh`/`redis-cli` against a published port, and why not to publish in production |

**Closing phase 9 = closing chunk C.** At that point: update all four boards, say so, and
**stop** — do not pick up another chunk or another language.

### Chunk C · phases 8 and 9 — evidence lives in a child file

🔴 **Fixed filenames, the per-page claim tables for phases 8 and 9, and every verified quote
(the `postgres` image, `npm ci`, node-postgres `Pool`, Vite server options, Compose secrets)
are in [[devbible-docker-chunk-c-findings]].** Open it **only when writing in phase 8 or 9** —
it is evidence, not cursor state. Everything you need to *resume* is in the handoff above.

### Chunk D · phase 10, file by file

🔴 **The filenames are fixed in advance**, so cross-links inside the phase are written once
and resolve as the phase fills. Do not rename them: `01-pid-1/`,
`02-graceful-shutdown/`, `03-resource-limits/`, `04-logs-to-stdout/`,
`05-config-and-secrets.md`, `06-failure-catalogue/`, `07-restart-as-supervision.md`,
`08-log-drivers-and-rotation.md`, `09-healthchecks-in-production.md`, `10-hardening.md`,
`11-observing.md`, `12-debugging-without-a-shell.md`, `13-disk-growth.md`,
`14-under-systemd.md`, `15-time-and-timezones.md`, `16-zero-downtime-restarts.md`.

| Topic | Files | Lines | Sources named on the page |
|---|---|---|---|
| ✅ **01 · PID 1 is not a normal process** (Master) | `01-pid-1/` — README + 2 chunks | 68 / 239 / 222 | `pid_namespaces(7)`, `signal(7)`, `wait(2)`, `docker run --init`, `podman-run(1)`, tini, catatonit, Node.js signal events |
| ✅ **02 · Graceful shutdown** (Master) | `02-graceful-shutdown/` — README + 2 chunks | 69 / 244 / 257 | `docker container stop`, Compose file reference, Dockerfile `STOPSIGNAL`, `podman-stop(1)`, `systemd-system.conf(5)`, Node.js `http` server API and signal events |
| ✅ **03 · Resource limits** (Master) | `03-resource-limits/` — README + 2 chunks | 66 / 254 / 239 | Docker resource-constraints guide, `docker container run`, `docker inspect`, `podman-run(1)`, `cgroups(7)`, `systemd.resource-control(5)`, Node.js `os` |
| ✅ **04 · Logs go to stdout and stderr** (Master) | `04-logs-to-stdout/` — README + 2 chunks | 68 / 228 / 220 | Docker logging-driver config, dual logging, `docker container logs`, `podman-run(1)`, `podman-logs(1)`, OCI annotations |
| ✅ **05 · Configuration and secrets at run time** (Understand) | `05-config-and-secrets.md` — **single page** | 259 | `docker container run`, Compose secrets reference + use-secrets how-to, Compose env-var precedence, `podman-run(1) --secret` |
| ✅ **06 · The production failure catalogue** (Master) | `06-failure-catalogue/` — README + 2 chunks | 72 / 237 / 245 | `docker inspect`, `docker system df`, Docker Hub usage/pull limits, logging-driver config, Docker networking, `HEALTHCHECK`, `time_namespaces(7)`, `pid_namespaces(7)`, `capabilities(7)` |
| ✅ **07 · Restart policies as supervision** (Understand) | `07-restart-as-supervision.md` — **single page** | 214 | Docker start-containers-automatically, `docker container run`, Compose file reference, `podman-run(1) --restart`, `podman-systemd.unit(5)` |
| ✅ **08 · Log drivers and rotation** (Understand) | `08-log-drivers-and-rotation.md` — **single page** | 237 | Docker logging configure (delivery modes), json-file driver, local driver, journald driver, `podman-run(1)` |
| ✅ **09 · Healthchecks in production** (Understand) | `09-healthchecks-in-production.md` — **single page** | 197 | Dockerfile `HEALTHCHECK`, `docker container ls`, `docker system events`, Compose file reference, `podman-healthcheck-run(1)` |
| ✅ **10 · Hardening at run time** (Understand) | `10-hardening/` — README + 2 chunks — ⚠️ **the first Understand topic in the phase to chunk** | 69 / 240 / 236 | `docker container run` (`--read-only`, `--tmpfs`, `--cap-drop`, `--security-opt`, `--user`, `--privileged`), [Docker Engine security](https://docs.docker.com/engine/security/), `podman-run(1)`, [PR_SET_NO_NEW_PRIVS(2const)](https://man7.org/linux/man-pages/man2/PR_SET_NO_NEW_PRIVS.2const.html), Compose file reference — services |
| ✅ **11 · Observing** (Know) | `11-observing.md` — **single page** | 230 | `docker container stats`, [Docker runtime metrics](https://docs.docker.com/engine/containers/runmetrics/), [daemon Prometheus](https://docs.docker.com/engine/daemon/prometheus/), `podman-stats(1)`, cAdvisor README |
| ✅ **12 · Debugging a container you cannot shell into** (Understand) | `12-debugging-without-a-shell.md` — **single page** | 276 | [docker debug](https://docs.docker.com/reference/cli/docker/debug/), `docker container cp`, `docker container run` (`--pid=container:`), [Docker networking](https://docs.docker.com/engine/network/) (`--network container:`), [nsenter(1)](https://man7.org/linux/man-pages/man1/nsenter.1.html), `podman-exec(1)` |
| ✅ **13 · Disk growth** (Understand) | `13-disk-growth.md` — **single page** | 246 | `docker system df`, `docker system prune`, `docker builder prune`, Docker logging configure, `podman-system-prune(1)` |
| ✅ **14 · Running containers under systemd** (Understand) | `14-under-systemd.md` — **single page** | 224 | Docker start-containers-automatically, [systemd.service(5)](https://man7.org/linux/man-pages/man5/systemd.service.5.html), [podman-systemd.unit(5) Quadlet](https://docs.podman.io/en/latest/markdown/podman-systemd.unit.5.html), `podman-run(1)` |
| ✅ **15 · Time, timezones and locales** (Know) | `15-time-and-timezones.md` — **single page** | 194 | `time_namespaces(7)`, `podman-run(1)` (`--tz`), Alpine wiki setting-the-timezone, musl functional-differences-from-glibc |
| ✅ **16 · Zero-downtime restarts without an orchestrator** (Know) | `16-zero-downtime-restarts.md` — **single page** | 194 | [Compose `deploy`](https://docs.docker.com/reference/compose-file/deploy/), `docker compose up`, `docker container stop`, `podman-run(1)` |

▶ **RESUMED 2026-08-15, session `6d88f249`**, on *"docker and podman pick d"* — chunk taken
over from `2f38bb4d`; topics **10** (`58bd3029`) and **11** (`782a46cb`) written and committed.
🏁 **PHASE 10 IS COMPLETE — 16 of 16, closed 2026-08-15 by session `6d88f249`.** 29 files,
**5,645 lines**, **0 over the 300-line cap**, every internal link resolved against the
filesystem — **link-checked, NOT built** (the build/dev-server registry row was never claimed).
All four boards synced and `progress.js`'s `pagesPlanned` removed for the phase.
Commits: **10** `58bd3029`, **11** `782a46cb`, **12** `4369de0e`,
**13** `64f3d4d2`, **14** `f9894b4f`, **15** `e4a3b895`, **16** `d2dcfbfd`.

▶ **RESUMED 2026-08-15, session `75a196a7`**, on *"docker and podman chunk d"* — claim taken
over from `6d88f249` in both boards. 🚧 **PHASE 11 IS OPEN — 5 of 16, and its 🏁 MASTER TIER IS COMPLETE 4/4.** ✅ **01 · Daemonless**
(Master, **chunked**, 3 files / 564 lines, largest 246; the phase index is a 4th file), commit
`ec63a026`. ✅ **02 · Rootless by default** (Master, **chunked**, 3 files / 501 lines, largest
220), commit `85dfdaae`. ✅ **03 · Pods** (Understand, single page, 206), commit `0b4099c2`.
✅ **04 · Quadlet** (Master, **chunked**, 3 files / 549 lines), commit `df7e091a` — which also
🔴 **corrected phase 10 topic 14's SEVEN-unit-type list to EIGHT** (`.image` was missing) and
repointed four other Quadlet placeholders across phase 10.
✅ **05 · Where Podman will bite you** (Master, **chunked**, 3 files / 556 lines), commit
`3a67f58b` — which also 🔴 **corrected phase 10 topic 09's unsourced "systemd timers drive
Podman healthchecks" claim** (see [[devbible-docker-chunk-d-phase11]]).
▶ **RESUMED 2026-08-16, session `8e7b6e12`**, on *"docker and podman chunk d"* — claim taken
over from `75a196a7` in both boards. ✅ **06 · `podman unshare`** (Understand, single page,
235), commit `1d6c1400` — a shell inside the namespace the containers already run in;
`sudo chown` succeeds and makes it *worse*; ⚠️ **not available with the remote client**.
✅ **07 · `--userns` modes** (Understand, single page, 252), commit `48050fdf` — six modes,
🔴 **`--pod` makes `--userns` be ignored entirely**, `nomap` as the security opposite of
`keep-id`, and Docker's daemon-wide opt-OUT vs Podman's per-container opt-IN.
✅ **08 · Pod commands** (Understand, 220), commit `c02acbd2` — 🔴 **`pod rm` deletes the
containers too**, `--pod new:` makes a pod that can never publish a port, and the
pod-vs-user-defined-network decision table.
✅ **09 · Quadlet vs `generate systemd`** (Understand, 210), commit `86d566b4` — the
deprecation quoted verbatim, `--new` as Quadlet's premise done by hand, and the migration step
everyone skips (disable the old unit).
✅ **10 · `podman auto-update`** (Know, 195), commit `517442fe` — three conditions must all
hold, and 🔴 **rollback is only real if the container sends READY via SDNOTIFY**.
✅ **11 · `kube play` / `generate kube`** (Understand, 196), commit `ed809dc6` — 🔴 **`apply` is
the only subcommand that leaves the machine**, and the unsupported cluster fields are *ignored,
not rejected*.
✅ **12 · Buildah and Skopeo** (Know, 205), commit `313a15c5` — the split is about privilege;
every Skopeo argument is a **transport plus a location**.
✅ **13 · Docker CLI compatibility** (Understand, 202), commit `b04da27b` — three levels, and
⚠️ **an alias is invisible to every script**; the API is pinned to Docker v1.40.
✅ **14 · Podman 6 breaking changes** (Understand, 199), commit `3616f4b5` — a *removal*
release; 🔴 **cgroups v1 is the hard blocker** and BoltDB→SQLite is a one-way door.
✅ **15 · `podman machine`** (Know, 196), commit `e631b11e` — 🔴 **the CLI is a remote client**,
and only `$HOME:$HOME` is shared.
✅ **16 · Podman Desktop** (Know, 195), commit `e207c28a` — a view, not a source of truth, and
the Docker Desktop licence threshold that decides it for organisations.
🏁 **PHASE 11 IS COMPLETE — 16 of 16 at every tier (Master 4/4 · Understand 8/8 · Know 4/4),
closed 2026-08-16: 25 files, 4,650 lines, largest 256, 0 over the cap, 0 console blocks, and
1,961 internal links under `docs/docker` all resolve — link-checked, NOT built.**
🔴 **That close also repointed EVERY stale `(not written yet)` inside phases 10 and 11**, which
previous sessions had left behind at their own phase closes; only genuine phase-12 forward
references remain. ⚠️ **Make this part of closing a phase** — grep `not written yet` across
your own phases before declaring one done.
🚧 **PHASE 12 IS OPEN — 1 of 12**, the last phase in chunk D and in the whole Docker track.
✅ **01 · Tag strategy** (Master, **chunked**, 3 files / 485 lines), commit `142c315d` — a tag
is a *mutable pointer*, so 🔴 **immutable tags for machines, moving tags for humans, deploy the
digest**; build-time drift and deploy-time ambiguity are different failures whose fixes do not
substitute for each other.
✅ **02 · Building images in CI** (Understand, 225), commit `14ce9fdb` — a CI runner is *a
machine with no memory*; build once per commit, and caching can be a net loss.
✅ **03 · One image, three environments** (Master, **chunked**, 3 files / 462 lines), commit
`cdfb2942` — 🔴 **a rebuild is a different image**; the one genuine exception is the browser
bundle. 🏁 **Phase 12's Master tier is COMPLETE at 2 of 2.**
✅ **04 · Registry authentication in CI** (Know, 212), commit `b2ec2890` — the ladder up to
**OIDC with nothing stored between runs**; 🔴 **Podman's credential file is different and the
compatibility is one-way**.
✅ **05 · Testing with containers** (Understand, 204), commit `75f1ada1` — wait strategies, and
⚠️ **the Ryuk reaper needs engine access so a locked-down runner hangs**.
✅ **06 · Deploying without an orchestrator** (Understand, 198), commit `bdd9049e` — Compose on
a VM vs Quadlet vs PaaS, and 🔴 **most applications never need one**.
✅ **07 · When Compose stops being enough** (Understand, 197), commit `969e0a4f` — 🔴 **four
conditions, not a feeling**; Kubernetes' own docs on what it is *not*.
✅ **08 · Kubernetes on-ramp** (Know, 180), commit `fbb11e08` — the translation table; the
healthcheck becomes **two probes** and `depends_on` has no equivalent by design.
✅ **09 · Rolling updates by hand** (When Needed, 193), commit `d073f73f` — 🔴 **both versions
run at once**; expand-and-contract; rollback is asymmetric.
✅ **10 · `docker context`** (Know, 152), commit `2d844af7` — `use` is persistent and invisible.
✅ **11 · Cost realities** (When Needed, 177), commit `c320c1ac` — four costs nobody labels;
⚠️ **no prices quoted, deliberately**.
✅ **12 · Docker Swarm in 2026** (When Needed, 172), commit `b4a2ad5e` — **not deprecated**;
*Classic* Swarm is the thing that is; the risk is ecosystem gravity.
🏁🏁 **PHASE 12 CLOSED 12/12 — CHUNK D IS FINISHED, 44 of 44, AND THE WHOLE DOCKER & PODMAN
TRACK IS COMPLETE AT 192/192.** Phase 12: 17 files / 2,913 lines / largest 236 / 0 over the
cap. Whole track: **271 files, 50,768 lines, 0 over the cap, 0 console blocks, 2,184 internal
links all resolving — link-checked, NOT built.**
✅ **THE STALE PLACEHOLDERS ARE FIXED — 2026-08-16, on the user's instruction** (*"yes please
cleanup"*). **49 of them** across chunks A/B/C's phases (6 ×17, 8 ×16, 9 ×8, 5 ×4, and one each
in 0, 1, 2, 4) all named topics that existed by then. Each target was **resolved against the
filesystem and replaced with a `.md` link — no bulk `sed`**. Commit `3b51f2dc`.
🔴 **Nothing in Docker was ever dropped or parked** — checked before the pass, so every
placeholder had a real target. **`docs/docker` now has 2,233 internal links, 0 broken, 0 files
over the 300-line cap.** The pages-index split notice was turned from a live claim board into a
completion record.
⚠️ **THE LESSON, and it cost three phase closes:** the *(not written yet)* convention has two
halves — write plain text while the target is missing, **and repoint it the moment the target
lands**. Chunks A, B and C did the first half only, and it went unnoticed because the text is
not a link, so **no link checker and no build ever flags it**. 🔴 **Grep `not written yet`
across your own phases before declaring one closed** — phase 11's close added this to the
routine; make it universal.
🔴 **Nothing is left in chunk D. Report and stop.**
🔴 **Phase 12's fixed filenames, tier map and verified quotes are in the child file
[[devbible-docker-chunk-d-phase12]]** — open it before writing anything in phase 12.

⚠️ **The pages-index `Total` was stale at 167 against a Written column summing to 170** — the
documented recompute-never-increment trap, hit again. Fixed to 171 after topic 07.

🔴 **Phase 11's fixed filenames, tier map and verified quotes are in the child file
[[devbible-docker-chunk-d-phase11]]** — open it before writing anything in phase 11. It was
split out rather than appended here because this file is already near the 300-line cap.

⚠️ **Tier shapes that held across the whole phase:** the five Master topics are chunked
directories of 516–570 lines; the Understand topics are 194–276-line single pages **except
topic 10**, which chunked at 348; the Know topics are 194–230. Match the tier, not the biggest
page.

🔴 **Verified facts from topic 15 — do not re-fetch:** `time_namespaces(7)` — *"time namespaces
do not virtualize the CLOCK_REALTIME clock. Virtualization of this clock was avoided for
reasons of complexity and overhead within the kernel"*; `CLOCK_MONOTONIC` and `CLOCK_BOOTTIME`
ARE virtualised via `/proc/[pid]/timens_offsets`, which needs **`CAP_SYS_TIME`** and fails
`EACCES` *"after the first process has been created in or has entered the namespace"*.
🔴 **Podman has `--tz`** — *"set timezone in container … area-based timezones, GMT time, as
well as `local`, which sets the timezone in the container to match the host machine"* — and
**Docker has NO equivalent**, so cross-engine files use `TZ`. Alpine needs the **`tzdata`
package** and `/etc/localtime` is a link into `/usr/share/zoneinfo/`. **musl** *"always uses
`C.UTF-8` as the default"* with no `LANG`/`LC_*`, and beyond the C locale *"all other locales
are still processed as multibyte UTF-8"*. ⚠️ **`TZ` on an image with no zoneinfo silently does
nothing** — no error.

🔴 **Verified facts from topic 16 — do not re-fetch:** Compose `deploy.update_config.order` is
*"one of `stop-first` (old task is stopped before starting new one), or `start-first`"* and
**defaults to `stop-first`** — so even where the block is honoured, the default is downtime;
`parallelism` = *"the number of containers to update at a time"*, `delay` = *"the time to wait
between updating a group of containers"*, with a matching `rollback_config`. ⚠️ **The docs do
NOT state that `docker compose` ignores `deploy`** — the page says only that `deploy` describes
what a platform should do and support depends on the runner. Do not upgrade that to "Compose
ignores it" without a source.

🔴 **Verified facts from topic 13 — do not re-fetch:** `docker system df` columns TYPE / TOTAL
/ ACTIVE / SIZE / RECLAIMABLE, networks excluded *"because it doesn't consume disk space"*;
🔴 **`SIZE` is virtual — *"the sum of SHARED SIZE and UNIQUE SIZE"*, so it OVERSTATES what a
delete frees; `RECLAIMABLE` is the honest column.** `docker system prune` default = *"all
stopped containers"*, *"all networks not used by at least one container"*, *"all dangling
images"*, *"unused build cache"*; `-a` = *"remove all unused images not just dangling ones"*;
**`--volumes` = *"prune anonymous volumes"***, excluded by default *"to prevent important data
from being deleted if there is currently no container using the volume"*. ⚠️ **The command's
own SUMMARY LINE contradicts its option table** (*"images (both dangling and unused)"*) — same
shape as the Compose `down` blurb trap; the option table is the authority and the page says so.
`builder prune --keep-storage` = *"amount of disk space to keep for cache"*. ⚠️ **Podman's
`--volumes` is BROADER than Docker's** — documented as *"volumes currently unused by any
container"*, named ones included; `--external` *"drops the default behaviour of removing unused
resources"* and cannot combine with `--all`/`--filter`.

🔴 **Verified facts from topic 14 — do not re-fetch:** Docker states plainly **"Don't combine
Docker restart policies with host-level process managers, as this creates conflicts"**, and
points at a process manager *"when processes outside Docker depend on Docker containers"*.
`systemd.service(5)`: **`Restart=` defaults to `no`** (values no/on-success/on-failure/
on-abnormal/on-watchdog/on-abort/always), **`RestartSec=` defaults to 100ms** (far too eager
for containers), `RemainAfterExit=` defaults to **no**, `Type=` defaults to **simple**
(*"started immediately after the main service process has been forked off"*), `oneshot` =
*"up after the main process exits"*. 🔴 **The page's thesis: `docker run` in the foreground is
a CLIENT, not the container's parent — systemd supervises the wrong process**, hence the
explicit `ExecStop=` and `ExecStartPre=-docker rm -f`; under daemonless Podman the container
IS the unit's child, which is the structural argument for Quadlet. **Quadlet** = *"a systemd
generator"* that *"generates corresponding regular systemd service unit files"* at boot and on
`daemon-reload`; unit types `.container .pod .volume .network .kube .build .artifact`
(⚠️ **`.artifact` is a SEVENTH type** — the older note in this file lists six); paths
`/etc/containers/systemd/` (root) and `~/.config/containers/systemd/` (rootless). ⚠️ **The
Quadlet man page does NOT say `podman generate systemd` is deprecated** — that claim comes
from topic 07's source, so keep attributing it there.

🔴 **Verified facts from topic 12 — do not re-fetch:** `docker debug` = *"Get a shell into any
container or image"*, *"an alternative to debugging with `docker exec`"*; works on running,
paused and **stopped** containers **and images**; *"at no point, do changes affect the actual
image or container"*; toolbox in `/nix` with `vim`, `nano`, `htop`, `curl`, bash/fish/zsh.
⚠️ **Its reference page names NO subscription or Docker Desktop requirement** — the page
therefore does not claim one, only that it is a Docker CLI command. 🔴 **The documented
debugging example on the run reference is the load-bearing one:** `docker run --rm -it
--pid=container:my-nginx --cap-add SYS_PTRACE --security-opt seccomp=unconfined alpine`, with
`--pid` taking *"'container:<name|id>': joins another container's PID namespace"*; the network
twin is *"attach a container to another container's networking stack directly, using the
`--network container:<name|id>` flag format"*. ⚠️ **Joining PID/net does NOT join the mount
namespace** — that is the page's key correction. `docker cp`: *"the CONTAINER can be a running
or stopped container"*, *"files copied to a container are created with UID:GID of the root
user"*, *"doesn't create parent directories for DEST_PATH"*, and **cannot copy `/proc`, `/sys`,
`/dev`, tmpfs or user-created mounts**. `nsenter -t PID` with `-m -u -i -n -p -U -C -T` and
**`-a/--all`**; with no program it uses the passwd shell, falling back to `/bin/sh`.

🔴 **Verified facts from topic 11 — do not re-fetch:** `docker stats` *"returns a live data
stream for running containers"*, and 🔴 on Linux **"the Docker CLI reports memory usage by
subtracting cache usage from the total memory usage"** while the API returns both — so the CLI
figure is NOT what the kernel enforces the limit against, and that is the page's headline.
`MEM %`/`CPU %` are *"the percentage of the host's CPU and memory"*, so read `MEM USAGE /
LIMIT` instead. cgroup v2 accounting lives at `/sys/fs/cgroup/docker/<longid>/` (or
`system.slice/docker-<longid>.scope` under systemd), v1 memory at
`/sys/fs/cgroup/memory/docker/<longid>/`. `memory.stat`: **cache** = *"memory … that can be
associated precisely with a block on a block device"*, **RSS** = *"memory that doesn't
correspond to anything on disk: stacks, heaps, and anonymous memory maps"*. ⚠️ **Network
counters are NOT cgroup metrics** — *"processes in a single cgroup can belong to multiple
network namespaces"*. 🔴 **The Docker daemon's Prometheus endpoint is daemon-only** —
*"you can only monitor Docker itself. You can't currently monitor your application using the
Docker target"*, names *"in active development"*; config key is `metrics-address` in
`daemon.json`. **cAdvisor** UI port **8080**, *"native support for Docker containers"* — ⚠️ its
README does **not** name a Prometheus endpoint, so the page does not claim one. **Podman
`stats --interval` defaults to 5 seconds**, and ⚠️ *"rootless environments are not able to
report statistics about their networking usage"* (rootlesskit traffic lands on `lo`).

🔴 **Topic 10 CHUNKED at 348 lines** — the draft was written whole and then split on the
boundary between **the four switches themselves** (`01-the-four-switches.md`, 240) and
**making them the default everywhere** (`02-enforcing-it.md`, 236: the MAC layers, the
Compose attributes, `--privileged`, Podman, the rollout order). Each chunk carries its own
four Gotchas and 3★+3 interview questions, which is *why* the split adds lines rather than
redistributing them. ⚠️ **The inbound link `01-pid-1/02-giving-pid-1-to-an-init.md →
../10-hardening.md` was repointed to `../10-hardening/README.md`** — the same
directory-repoint trap the phase already hit once.

🔴 **Verified facts from topic 10 — do not re-fetch:** `--security-opt=no-new-privileges=true`
= *"Disable container processes from gaining new privileges"*; the kernel attribute behind it
is `no_new_privs`, whose man page says `execve(2)` *"promises not to grant privileges to do
anything that could not have been done without the execve(2) call"*, rendering *"the
set-user-ID and set-group-ID mode bits, and file capabilities non-functional"*, that **"once
set, the no_new_privs attribute cannot be unset"**, and that it **"is inherited by children
created by fork(2) and clone(2), and preserved across execve(2)"**. Docker Engine security:
**"By default Docker drops all capabilities except those needed, an allowlist instead of a
denylist approach"** and *"remove all capabilities except those explicitly required for their
processes."* ⚠️ **Podman `--tmpfs` defaults to `rw,noexec,nosuid,nodev` and enables
`tmpcopyup`; Docker does neither** — and **`--read-only-tmpfs` defaults to `true`** on Podman
(`/dev`, `/dev/shm`, `/run`, `/tmp`, `/var/tmp`), which is chunk B's phase-6 finding and is
reused here rather than re-derived. **Podman's `mask=`/`unmask=` `--security-opt` values have
no Docker equivalent.** ⚠️ **The Compose reference documents `security_opt` ONLY as overriding
"the default labeling scheme"** with `label:user:USER` examples — `no-new-privileges:true` is
written in the **colon** form there against the CLI's `=`, and the page says the reference does
not document it rather than claiming the two forms are documented as equivalent.

🔴 **Verified facts from topic 09:** `HEALTHCHECK` defaults are `--interval` **30s**,
`--timeout` **30s**, `--start-period` **0s**, `--retries` **3**; exit `0` healthy, `1`
unhealthy, `2` reserved. Detection time is roughly `timeout + interval × retries` — about 90 s
on the defaults. **`depends_on: condition: service_healthy` gates STARTUP only** and never
reconsiders. **Podman schedules healthchecks with systemd timers**, so without a running
systemd session they may not run at all — "never marked unhealthy" is not evidence of health.

**Every Master topic split on a real boundary** — 01 between the kernel's three rules and
the four ways out (exec form → `--init` → bake tini in → `--pid=host`); 02 between the
deadline (who sets the budget, the four steps, why readiness fails first) and doing it in a
real service (the handler, keep-alive, what else holds the event loop open); 03 between
**memory, which kills** and **CPU/PIDs, which throttle**; 04 between the contract and the
record; 06 between *the container died* and *it is still running and useless*. 🔴 **All five
Master topics came in at 516–570 lines across three files each**; the four Understand pages
so far are **197–259 lines, single files**. Match the tier, not the biggest page.

🔴 **Phase 10 has FIVE Master rows: topics 01, 02, 03, 04 and 06** (the production failure
catalogue). **All five are written — the Master tier is COMPLETE 5/5.** Everything left in
the phase (10–16) is Understand or Know, so expect shorter pages: **do not pad them to match
the Master shape.**

🔴 **Verified facts from topic 04:** Docker's default driver is **`json-file`, which
performs NO rotation by default** — the standard way a host fills its disk; **`local` is the
recommended driver and rotates by default**; **`docker logs` reads natively only from
`local`, `json-file` and `journald`**, everything else goes through **dual logging**'s local
cache (`cache-disabled`, `cache-max-size` 20m, `cache-max-file` 5, `cache-compress` true).
**Podman's default log driver is `journald`**, and `json-file` there is an **alias for
`k8s-file`**.

🔴 **Verified facts from topic 05:** a Compose secret is **mounted as a file at
`/run/secrets/<secret_name>`**, sourced from `file:` or `environment:`, and works with a
plain `docker compose up` — ⚠️ **`docker secret` is Swarm-only**. Podman's `--secret`
defaults to `type=mount` at `/run/secrets/<name>` with **mode `0444` (world-readable inside
the container)**; `type=env`, `target=`, `uid=`, `gid=`, `mode=` are the options. Compose's
own docs warn against env-delivered passwords. ⚠️ **`.env` (interpolation into
`compose.yaml`) and `env_file:` (variables into the container) are unrelated** — the
confusion is worth keeping in the page.

🔴 **Verified facts from topic 06:** Docker Hub allows **100 pulls / 6 hours
unauthenticated, counted per IPv4 address OR IPv6 /64 subnet**, **200** for an authenticated
Personal account, unlimited on paid plans, refusing with **HTTP 429**. And
`time_namespaces(7)` virtualises `CLOCK_MONOTONIC` and `CLOCK_BOOTTIME` but **explicitly not
`CLOCK_REALTIME`** — so a container's wall clock is *always* the host's, `TZ` changes only
the display, and clock skew can never be fixed inside the container (setting it would need
`CAP_SYS_TIME` and would move the host's clock). Reuse both rather than re-deriving.

🔴 **Verified facts from topic 07:** a restart policy *"only takes effect after a
container starts successfully"*, meaning **up for at least 10 seconds**; **a manual stop
suspends the policy** until the daemon restarts or you start it yourself; `always` reapplies
after a daemon restart while `unless-stopped` respects your stop. ⛔ **Do NOT quote Docker's
restart backoff figures** — the current documentation states the 10-second rule but *not* the
delay schedule, so the page says only that the loop gets quieter, and that is deliberate.
Podman ships **`podman-restart.service`** for the reboot case; Quadlet is the general answer
and `podman generate systemd` is deprecated.

🔴 **Verified facts from topic 08 — the exact defaults, do not re-derive:**
**`json-file` (Docker's default): `max-size` `-1` (UNLIMITED), `max-file` `1`, `compress`
`false`.** **`local` (recommended): `max-size` `20m`, `max-file` `5`, compression enabled.**
⚠️ *"Existing containers don't use the new logging configuration automatically"* — a
`daemon.json` change only applies to **newly created** containers. Delivery is **blocking by
default**, so a slow driver is backpressure on the app; `mode=non-blocking` buffers with
`max-buffer-size` default **`1m`** and drops on overflow.

⚠️ **Mid-phase forward links warn until the phase closes** — still open:
`../10-hardening.md`. Expected, and
**not** the rule-1 slug bug. ⚠️ **When a topic becomes a directory, repoint its inbound
links** — topic 01 pointed at `../02-graceful-shutdown.md` and had to move to
`../02-graceful-shutdown/README.md`.

🔴 **Verified facts from topic 02 worth reusing rather than re-deriving:** `docker stop`
and Compose `stop_grace_period` both default to **10 s** (30 s for Windows containers);
systemd's `DefaultTimeoutStopSec` is **90 s** — so the same image gets a different budget
depending on how it is run, which is the topic's thesis. Node's `server.close()` **closes
idle keep-alive connections as of v19.0.0** (documented history entry);
`closeIdleConnections()` and `closeAllConnections()` were both added in **v18.2.0**, and
`closeAllConnections()` does not touch sockets upgraded to WebSocket or HTTP/2.

🔴 **Verified facts from topic 03, likewise reusable:** `-m` has a **minimum of 6m**;
`--memory-swap` is memory **plus** swap combined (equal to `--memory` = no swap; unset = as
much swap again; `-1` = unlimited); `--cpu-shares` defaults to **1024** and is a weight, not
a ceiling; **`--pids-limit` has no Docker default but defaults to 2048 under Podman**; and
`--memory`, `--cpus`, `--pids-limit` are **not supported on cgroups V1 rootless systems**.
Node's own `os` docs say **`os.cpus().length` must not be used for parallelism** — use
`os.availableParallelism()` (v18.14.0 / v19.4.0), which reflects the **affinity mask** but
is *not* documented to reflect a CFS quota; the page states that uncertainty rather than
guessing. `.State.OOMKilled` is the field that separates the three causes of exit 137.

🔴 **Two load-bearing nuances established in topic 01 — do not contradict them later.**
**Node installs default `SIGTERM`/`SIGINT` handlers**, so a plain exec-form
`CMD ["node", …]` really does stop cleanly; the ten-second stop bites shell form,
entrypoint scripts missing `exec`, and CPython (which handles `SIGINT` only). And
**adding `process.on('SIGTERM', …)` removes Node's default exit behaviour** — that is the
actual production trap and the hand-off into topic 02.

## Where the work lives

**`main`**, at **`/mnt/Storage/Backup/Knowledge/devbible`**. ⛔ There are **no worktrees** —
every one was merged and deleted 2026-08-15, and this was **re-verified 2026-08-16** by session
`8e7b6e12`: `git worktree list` shows one entry, `git worktree prune -v` finds nothing,
`git branch` shows only `main`, `git branch --no-merged main` is empty, and no sibling
`devbible-*` directory exists. **Nothing to merge, nothing to delete.** Do not create one.
⚠️ **The path used to be recorded as `/run/media/sairam/…`, which does not exist** — corrected
here and in [[devbible-worktree-consolidation-20260815]].
⚠️ **`main` is 67 commits ahead of `origin/main` and unpushed**, and only ~27 are chunk D's —
the rest are TypeScript Part A/B and Docker chunk C. **Do not push unasked.**

Directory naming follows the four written phases exactly:
`docs/docker/pages/phase-N-<slug>/NN-topic.md`, or `NN-topic/` with `_category_.json` +
`README.md` + `NN-chunk.md` parts once a topic passes 300 lines.

## 🔴 The rules every chunk writes under

- **NO SANDBOX, and it was said three times.** Nothing is run. Every claim is validated
  against **docs.docker.com**, **docs.podman.io**, the **OCI specs** or the release notes,
  and the sources are named on the page's `> Verified:` line, which ends with
  "**No sandbox** — no console output on this page."
- **No run means NO console block.** Never reconstruct a plausible terminal session.
  ⚠️ **Podman 5.8.4 is installed on this machine and Docker is not** — neither fact is
  permission to run anything.
- **300 lines is a file-size cap, never a content budget.** Write what the topic deserves,
  then split on a concept boundary into `NN-topic/`.
- **Per-file cadence** — page → the four boards → commit → memory. A session that dies must
  lose at most one file.
- **`.md` links, every numeric prefix kept.** Never a directory slug.
- 🔴 **Never `git add -A`.** Stage explicit paths; four Docker sessions plus other languages
  share this checkout.
- 🔴 **No `yarn build` or `yarn start` without claiming the row** in
  `shared/session_build_devserver_registry.md` (global rule 12). Where a build is not
  available, link-check against the filesystem and **say plainly in the report that the
  pages were link-checked, not built**.

## Shared files — what each chunk may touch

| File | Rule |
|---|---|
| `docs/docker/pages/phase-N-*/README.md` | belongs to whichever chunk owns phase N — **no phase is shared** |
| `docs/docker/pages/README.md` | the phase-table rows for **your** phases, plus your own chunk row in the claim table |
| `docs/README.md` | **your chunk's claim row only**, plus the Docker technology row at a phase close |
| `src/data/progress.js` | the **docker** row only — `pages: N` **and** `pagesPlanned: 192` while mid-phase |

⚠️ `progress.js` has **one** docker row for all four chunks: it counts **topics written across
the whole track**, so re-read the current value before incrementing and expect another chunk to
have moved it. If your edit conflicts, take the higher number and add your own delta.

⛔ **Cross-chunk links break the build.** Where a page needs a topic another chunk owns, write
it as **bold plain text with *(not written yet)*** — never a link. The same goes for the
`Next →` footer of the last page of your last phase.

## What phases 0–3 already established, so it is not re-argued

Cross-link these instead of re-explaining them; the per-page claim tables are in
[[devbible-docker-podman-progress]].

- **The ten-second stop** — shell form, PID 1's missing default dispositions, `exec "$@"`.
  Phase 10's graceful-shutdown topic is the third visit and should say so.
- **"Rotate it — rebuilding does not unpublish"** — the answer to any secret in a layer or a
  build arg. Phases 4 (`--mount=type=secret`) and 5 (supply chain) inherit it.
- **"Docker reports; something else must act"** — healthchecks and restart policies react to
  exit, never to wedged. Phases 8 (`condition: service_healthy`) and 10 build on it.
- **The engine divergences already flagged inline:** short-name resolution, rootless UID
  mapping, privileged ports, systemd-timer healthchecks, no daemon to re-assert restart
  policies, Buildah not fetching BuildKit frontends. Phase 11 collects the depth — the other
  chunks call the difference out inline and link forward.
- **Page shape:** tier badge + `> Verified:` → a bold one-sentence thesis → the concept before
  any flag → the commands → both engines where they differ (or an explicit "identical") →
  four Gotchas as symptom → cause → fix → three starred + three unstarred interview questions
  with prose answers.

## Version facts — verified 2026-08-14, do not re-derive

Docker Engine **29.7.2** · Compose **v5.4.0** (bundling BuildKit **v0.32.1**) · Dockerfile
frontend **v1.26.0** · runc **v1.4.3** · Podman **6.1.0** upstream. Podman 6 breaking: cgroups
v1 removed, BoltDB dropped with automatic SQLite migration, Intel macOS and Windows 10 hosts
dropped.

## Closing a phase

1. Every topic written, the phase `README.md` index and Coverage table complete.
2. All four boards updated (rule 9) — `progress.js`, the phase README,
   `docs/docker/pages/README.md`, `docs/README.md`.
3. Link-check, or a **claimed** build. Report which one it was.
4. Update this file's cursor row and commit the memory.

🏁 **When a chunk's last phase closes, say so and stop** — do not pick up another chunk or
another language on the strength of rule 9. The other chunks belong to live sessions.
