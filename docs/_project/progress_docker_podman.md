---
name: devbible-docker-podman-progress
description: Docker & Podman track in devbible — the cold start, the 192-topic syllabus, the worktree it lives in, and the per-phase resume cursor
metadata:
  type: project
---

:::danger CONSOLIDATED 2026-08-15 — THE WORKTREE IN THIS FILE NO LONGER EXISTS
Every devbible worktree and branch was **merged into `main` and DELETED** on 2026-08-15
(*"commit every uncommitted branch to main and delete everything"*). **All the content
described below is on `main`** at `/run/media/sairam/Storage/Backup/Knowledge/devbible`
— nothing was lost, every branch was verified at 0 unique commits first. Ignore any
"worktree", "branch", "not merged" or "merge at the phase close" instruction below and
**work on `main`**. `main` builds 0 warnings / 0 broken links, so a break there is yours.
Full record: `progress_worktree_consolidation_20260815.md`.
:::

# Docker & Podman — resume point

🔴🔴 **SPLIT FOUR WAYS on 2026-08-15 — the live cursor moved to
[[devbible-docker-split-4way]].** The 129 unwritten topics are now chunks **A** (phases 4+5),
**B** (6+7), **C** (8+9) and **D** (10+11+12), one session each, and *"pick docker A"* is the
whole instruction. **Open that file for which phases are yours and where to start.** This file
stays as the track's background: version facts, the no-sandbox rules, page shape, and the
per-page claim tables for the written phases 0–3. The single-session lock to `40090c06` below
is **superseded** by the split.

🔴 **START HERE if you were told to work Docker or Podman.** Locked to session
`40090c06` on 2026-08-14. The order and its history: [[devbible-docker-only-20260814]].

## Where the work lives

| | |
|---|---|
| Where | 🔴 **`main`**, at `/run/media/sairam/Storage/Backup/Knowledge/devbible` |
| Worktree | ⛔ ~~`devbible-docker`~~ — **DELETED 2026-08-15** |
| Branch | ⛔ ~~`docker-podman`~~ (was cut from `main` at `0d90db70`) — **DELETED 2026-08-15** |
| Merged into `main`? | ✅ **YES — 2026-08-15**, merge `97b78f5c`: 23 commits, 83 files, **+11,504 lines**. The old ⚠️ "NO" here is void |
| Scope | `docs/docker/` only, plus this track's rows in the four boards |

**Build:** just `yarn build` on `main`. The isolated-build dance is obsolete — the
`.docusaurus-docker` cache and the worktree are gone.

```bash
cd /run/media/sairam/Storage/Backup/Knowledge/devbible
rm -rf .docusaurus build node_modules/.cache && yarn build > build.log 2>&1
grep -icE 'warning|broken' build.log      # expect 0
```

✅ **The "113 broken links at baseline" note is STALE and must not be reused as an
excuse.** That was React 89 / TypeScript 18 / JavaScript 6 from other sessions' branches.
Those branches are all merged now and **`main` builds 0 warnings / 0 broken links**
(verified 2026-08-15). **A break you see is yours.**

⚠️ Two conflicts arose when this branch was merged, both in shared boards — `docs/README.md`
(claims + technology tables) and `src/pages/index.js`. Both were resolved by **keeping both
sides' rows**: the Docker card *and* the Nginx card stayed active on the homepage. Naively
taking one side would have silently de-activated a live technology's card.

## Cursor

✅ **Syllabus complete and committed** (`7223aeff`) — 4 parts, 13 phases, **192 topics**,
wired into `sidebars.js`, `src/data/progress.js`, the homepage card and both
`docs/README.md` tables. Build verified, 0 Docker warnings.

✅ **Phase 0 COMPLETE** (`bde9fae5`) — 14 topics, 15 files, **2,644 lines, 0 over the
300-line cap** (lengths 129–216, so no budgeting to the cap), boards updated in all
four places, and a **clean isolated rebuild with 0 broken links in `docs/docker`**.

✅ **Phase 1 COMPLETE** (`e0dc8b7c`) — 16 topics, 17 files, **2,664 lines, 0 over the
cap**, boards updated, clean rebuild with **0 broken links in `docs/docker`**.

✅ **Phase 3 COMPLETE** (`2fa23946`) — 18 topics in 17 pages + README, 2,967 lines,
0 over cap, clean rebuild with **0 broken links in `docs/docker`**.

🔴 **NEXT is now per chunk — see [[devbible-docker-split-4way]].** Chunk **A** starts at
Phase 4 topic 01 · How the layer cache decides; **B** at Phase 6 topic 01; **C** at Phase 8
topic 01; **D** at Phase 10 topic 01. Nothing of phases 4–12 is written.

**Running total: 63 of 192 topics (33%). Phases 0, 1, 2, 3 done — 129 topics left.**
Part 1 (How containers work) complete; Part 2 (Building images) is 18/46.

⚠️ **Mid-phase forward links warn until the phase closes** — pages link ahead to
siblings and to the phase `README.md` that does not exist yet. Expected, and **not**
the rule-1 slug bug. **Commit per file; run the clean build at the phase boundary.**
The last page of a phase must end its footer with bold plain text and *(not written
yet)* for the next phase, never a link.

| Phase | Topics | Written |
|---|---|---|
| 0 · What a container actually is | 14 | ✅ **14 — COMPLETE** |
| 1 · Running containers | 16 | ✅ **16 — COMPLETE** |
| 2 · Images, layers and registries | 15 | ✅ **15 — COMPLETE** |
| 3 · The Dockerfile | 18 | ✅ **18 — COMPLETE** (17 pages) |
| 4 · Build strategy: cache, multi-stage, BuildKit | 16 | **0 — next** |
| 5 · Image quality, size and supply chain | 12 | 0 |
| 6 · Storage: volumes, mounts and data | 12 | 0 |
| 7 · Networking | 14 | 0 |
| 8 · Compose | 17 | 0 |
| 9 · The MERN/PERN stack in containers | 14 | 0 |
| 10 · Running containers in production | 16 | 0 |
| 11 · Podman in depth | 16 | 0 |
| 12 · Delivery, CI and orchestration | 12 | 0 |

Tiers, counted from the badges rather than estimated: **Master 55 · Understand 85 ·
Know 44 · When Needed 8**. Master is **28.6%**, inside the brief's 25–30% band — it
came in at **38%** on the first pass and 18 rows were demoted, which is the same
over-Mastering the Git syllabus had to correct.

## Version facts — verified 2026-08-14

| | |
|---|---|
| Docker Engine | **29.7.2**, released 5 Aug 2026 |
| Docker Compose | **v5.4.0** (3 Aug 2026), bundling **BuildKit v0.32.1** |
| Dockerfile frontend | **v1.26.0** |
| runc | **v1.4.3** |
| Podman | **6.1.0** upstream; **5.8.4** on this machine |
| Podman 6 breaking | cgroups v1 **removed**; BoltDB dropped, auto-migrates to SQLite; Intel macOS and Windows 10 hosts dropped |

⚠️ **This machine has Podman 5.8.4 and NO Docker CLI** (`docker: command not found`).
That is a fact about the environment, not a reason to install anything — see the
no-sandbox rule below.

## 🔴 The rules this track is written under

- **NO SANDBOX** (global rule 8, restated to this session twice: *"there is
  sandboxing will verify against documentation and using online"*, then flatly
  *"there is no sandboxing"*). No `ex*` script, no harness, nothing run to produce
  evidence. Every claim is validated against **docs.docker.com**, **docs.podman.io**,
  the **OCI specs** or the release notes, and the source is named on the page's
  `> Verified:` line.
- **No run means NO console block.** Pages show commands as commands. Never
  reconstruct a plausible terminal session — an invented output is worse than none.
  Podman being installed does **not** license running it.
- **300 lines is a file-size cap, never a content budget.** Write what the topic
  deserves, then split on a concept boundary into `NN-topic/`.
- **Per-file cadence** — page → four boards → commit → memory.
- **`.md` links, every numeric prefix kept. Never `git add -A`.**

## The shape of a page

Decided at the syllabus and recorded in `docs/docker/pages/README.md`:
tier badge + `> Verified:` line → the concept before any flag → the commands →
**both engines** where they differ (or an explicit "identical" note) → Gotchas as
symptom → cause → fix → Interview questions with answers.

**Engine-neutral by default.** The syllabus deliberately teaches Docker and Podman
together because both turn up in practice, calls out the ~5% that genuinely differs
per topic, and collects the Podman-specific depth in Phase 11 so the other twelve
phases stay readable.

## Traps found so far

- **`docs/mongodb/` and `docs/redis/` both carry `position: 9`** in their
  `_category_.json`, and **neither has a sidebar entry** in `sidebars.js`. Docker took
  position **10** and added `dockerSidebar`. Not mine to fix — flagged only.
- **The homepage card had to be activated, not created.** `src/pages/index.js` already
  listed Docker & Podman as a disabled card under "Infrastructure"; it needed `to`,
  `active: true`, `stats` and `progress` plus a `summarise('docker')` const.
- **A `devbible-nginx` worktree on branch `nginx` already exists** — another session
  has Nginx. Stay off it.

## Phase 0 — what each page argues (so it is never re-derived)

| # | Page | The load-bearing claim |
|---|---|---|
| 01 | A container is a process | The kernel has **no container object**. Namespaces + cgroups + rootfs, assembled by a program that then `execve()`s. A container does not boot |
| 02 | Namespaces | All eight with `CLONE_` flags. **What is NOT namespaced** — `/proc/meminfo`, CPU count, wall clock — is the half that causes bugs. `nsenter -t <pid> -n` debugs an image with no shell |
| 03 | cgroups v2 | Unified hierarchy, no-internal-processes rule, `memory.max`/`cpu.max`/`pids.max`. Exit **137** = 128+9. A limit does not make the app use less memory, it makes the kernel kill it sooner |
| 04 | Image vs container | One image → many containers, shared read-only layers. The writable layer dies on **`rm`**, not on `stop`. `docker system df` answers "where did my disk go" |
| 05 | The Docker stack | CLI → dockerd → containerd → shim → runc → process. **`runc` exits after `execve`** — nothing is "running" the container. The shim exists so the daemon can die. Socket = root-equivalent API |
| 06 | The Podman stack | Daemonless fork/exec; `conmon` per container does the shim's job (double-forks, holds stdio, records exit code). Costs: linger, systemd-timer healthchecks, netavark, compose-by-provider |
| 07 | OverlayFS | `copy_up` copies the **whole file** — overlay is file-granular, not block-granular. Whiteouts hide, never delete, so a secret removed in a later `RUN` still ships |
| 08 | OCI specs | Runtime v1.3.0 / image v1.1.0 / distribution v1.1.0, three hand-offs in one pipeline. **Dockerfile, Compose, networking and drivers are NOT standardised** — exactly where a Podman column is needed |
| 09 | Capabilities | The 14 Docker grants by default, and the notable absences. `--cap-drop=ALL` then add back. `--privileged` also stands down AppArmor/SELinux — it removes the boundary |
| 10 | seccomp/AppArmor/SELinux | Three layers, three questions (operation / syscall / object). ~44 of 300+ syscalls blocked. **`:z` vs `:Z`** is the Fedora bind-mount fix; `:Z` relabels recursively. MAC denials log on the **host** |
| 11 | Rootless | `USERNAME:UID:RANGE`, 65536 default. Root inside = **you**; UID 1000 inside = 100999 outside. `podman unshare chown`, never `sudo chown`. `--userns=keep-id` |
| 12 | Works on my machine | The image ships filesystem **and config** — which is why `export` loses the start command. What still varies: kernel, arch, mounts, network, limits |
| 13 | Containers vs VMs | They **compose** — containers inside VMs is the normal production shape. Kata/gVisor/Firecracker give VM-grade isolation with the image unchanged |
| 14 | Installing | There is **always a Linux VM** on macOS/Windows. Desktop licence: 250 employees **AND** $10M — Engine on Linux is unaffected. `docker` group = passwordless root |

## Page-shape decisions made in phase 0, to keep consistent

- **`> Verified:` names 3–5 primary sources** and always ends with "**No sandbox** — no
  console output on this page."
- **A bold one-sentence thesis** immediately under the badge, before any detail.
- **Gotchas are symptom → cause → fix**, four of them, and the fix says what *not* to do
  where there is a popular wrong answer (`sudo chown`, disabling SELinux, `--privileged`,
  `seccomp=unconfined` as a fix rather than a diagnosis).
- **Interview questions: three starred**, then three unstarred. Answers are prose.
- **Cross-engine differences are inline**, not a separate section, except where they earn
  a page (05/06) or a phase (11).

## Phase 1 — what each page argues

| # | Page | The load-bearing claim |
|---|---|---|
| 01 | run anatomy | **Flags before the image are the engine's; everything after is the process's.** `run myapp -e FOO=bar` sets nothing and warns about nothing. run = pull + create + start + attach, and splitting it isolates which half failed |
| 02 | detached and cleanup | `--rm` also deletes **anonymous volumes**. Names are unique across **stopped** containers, which is the "name already in use" surprise. `rm -f` is SIGKILL with no grace |
| 03 | ps/inspect/logs/stats | Four commands, four questions, triage order. `Restarting (n)` is a masked crash loop; `unhealthy` still serves traffic. **`inspect` is the arbiter** when config and belief disagree. `logs` only ever shows PID 1's stdout/stderr |
| 04 | exec vs run | The distinction behind "my changes disappeared". `exec` shares the namespaces, so it is the **honest** way to test whether the API can reach the DB. `exec -u root` for non-root images |
| 05 | publishing ports | Container port is **last**; `-p` binds 0.0.0.0. You usually do not need to publish **at all** between containers. `EXPOSE` publishes nothing. 🔴 **Docker's nat-table rules divert packets before `ufw`'s INPUT chain** — verified against Docker's packet-filtering page; firewalld is integrated with, ufw is not |
| 06 | environment | Run time beats image `ENV`. **`--env-file` is parsed by the engine, not sourced** — no export, no quote stripping, no expansion, no inline comments. Env is observable, so it is not a secret store |
| 07 | lifecycle | "Exited is not gone" — `stop` ends the process, `rm` destroys the container. Why containers exit instantly, including the **daemonising** case: a container is one process, not a machine |
| 08 | stop is two signals | SIGTERM → 10s → unconditional SIGKILL. Two traps swallow the first: shell form puts `sh` at PID 1 (does not forward), and **PID 1 has no default dispositions so an unhandled SIGTERM is discarded**. "Every stop takes exactly ten seconds" is the diagnostic |
| 09 | exit codes | 125 engine / 126 not invocable / 127 not found (chroot convention, moby#14012, Docker 1.10.0); 128+N for signals. **137 is ambiguous three ways** — `.State.OOMKilled` decides, because adding memory to a SIGTERM problem changes nothing. Missing **interpreter** reports as 127 |
| 10 | interactive and TTY | `-i` and `-t` are independent. No TTY means **block-buffered** stdout, which is why logs arrive in bursts — fix the app, never by adding `-t` to a service |
| 11 | overriding entrypoint | Two rules cover every case; the ladder for getting a shell ends at `--entrypoint ""`. **`exec "$@"` is the last line of every correct entrypoint script** — without it the shell stays PID 1 and swallows SIGTERM |
| 12 | restart policies | `always` vs `unless-stopped` differ **only** after a manual stop plus a reboot. A policy is not a healthcheck — it reacts to exit, never to wedged. 🔴 Podman: `--restart=always` does **not** survive a reboot rootless; that needs `loginctl enable-linger` + Quadlet |
| 13 | reclaiming disk | `system df` before any prune. **`--volumes` deletes data** and there is no undo; named volumes are the protection. Build cache is the usual surprise; `until=` filters beat blanket `-a` |
| 14 | user/workdir/hostname | Numeric UIDs always work, names may not. `-u $(id -u):$(id -g)` for bind mounts. **`--hostname` is not DNS.** `host-gateway` on Linux |
| 15 | docker cp | Works on **stopped** containers, which is its real value. A smell in a deploy script, with a table of where each copied thing belongs |
| 16 | attach vs logs -f | `attach` owns stdin, so `Ctrl-C` stops the container. `Ctrl-P Ctrl-Q` needs a TTY — so the dangerous case has no safe exit. Default to `logs -f` |

## Phase 2 — what each page argues

| # | Page | The load-bearing claim |
|---|---|---|
| 01 | image references | `node:24` = `docker.io/library/node:24`. **A segment is a registry only if it has a `.` or `:`, or is `localhost`.** 🔴 Podman resolves short names via `unqualified-search-registries`, so **fully qualify everywhere** |
| 02 | tags vs digests | **A tag is a subscription, not a version.** Three concrete failures: non-reproducible builds, CI/prod divergence, `latest`. Pin the digest, keep the readable tag beside it, and **automate the bump or pinning becomes "years behind on patches"** |
| 03 | pull/push/tag/rmi | `tag` creates a **name**, copies nothing — and is how you push anywhere but Hub. Summing the SIZE column overcounts. `rmi` removes a tag first; a **stopped** container still counts as a reference |
| 04 | layers | A layer is a **diff**, content-addressed. Config-only instructions add no filesystem layer. Sharing means a "smaller" base can add **more unique bytes** on a host already sharing slim. The unit of cleanup is the **layer**. Minimising layer count is stale advice |
| 05 | base images | The size/debuggability/compatibility triangle. **Alpine = musl, not glibc** — native modules, DNS edge cases, BusyBox tools; `-slim` is the sane default. Distroless costs you `exec`, so have the debug story **first**. `scratch` needs a static binary |
| 06 | docker history | Find the largest layer, read its instruction, ask if it belongs in the **final** image. `<missing>` is normal. 🔴 **Build `ARG`s are visible here** — the concrete reason ARG is not a secret mechanism |
| 07 | image config | The OCI config fields mapped to their instructions. **`.Config.User` empty = root.** Image config = intended, container inspect = actual. This is exactly what `export` loses |
| 08 | registries | 🔴 **Hub: 100 pulls/6h unauthenticated PER IPv4 or IPv6 /64**, 200 authenticated free, unlimited paid, HTTP 429. "Per IP" is why CI behind NAT dies. Four mitigations in effort order; authenticate first |
| 09 | authentication | The `WWW-Authenticate` token exchange → tokens are **per-repository, per-action, short-lived**, so "logged in but denied" is normal. `--password-stdin` never `-p`. OIDC first in CI. 🔴 Podman's authfile is per-session `XDG_RUNTIME_DIR` — systemd units cannot see it |
| 10 | multi-arch | Manifest list / OCI index. **`--push` is mandatory** — the local store cannot hold a list. QEMU is "much slower for compute-heavy tasks" (Docker's words). `exec format error`; fix structurally by building multi-platform **in CI** |
| 11 | save vs export | `save`/`load` moves an **image**; `export`/`import` moves a **filesystem** and loses the config, hence "no command specified". **`skopeo` is usually better**, and `skopeo inspect` reads a tag without pulling |
| 12 | registries.conf | `unqualified-search-registries` + the three `short-name-mode` values. `prefix`/`location`/`mirror`/`insecure`/`blocked`. Docker's `registry-mirrors` is **Hub-only** with no equivalent of location rewriting |
| 13 | storage on disk | The four roots. 🔴 **Rootless bills your HOME and its quota.** Never hand-delete under the root — the layer DB and disk must agree and there is no repair tool. `vfs` is a red flag |
| 14 | own registry | Usually no. The two cases that earn it: **pull-through cache** and **air gap**. The one-liner is a dev registry. **Deleting tags frees nothing until GC runs** |
| 15 | image signing | Provenance, **not** safety — a compromised pipeline signs validly. Keyless cosign + Rekor. 🔴 **`cosign verify` without `--certificate-identity` proves only that *someone* signed it.** Podman's `policy.json` enforces natively. Start with digest pinning |

## Phase 3 — what each page argues

**Merge on record:** 18 syllabus topics → 17 pages. `LABEL` and the deprecated
`MAINTAINER` share page 12, and the Coverage table says so. Nothing dropped.

| # | Page | The load-bearing claim |
|---|---|---|
| 01 | FROM | Starts a **stage**, not just a base. **Pre-`FROM` `ARG` is global scope and must be redeclared** inside a stage or it is an empty string with no error. Inherits the base's config — the `USER` that breaks your `apt-get`, the `ENTRYPOINT` that swallows your `CMD`. `scratch` needs the CA bundle |
| 02 | RUN | **Shell form for `RUN`, exec form for the entrypoint** — stated as a pair. Clean in the **same** layer. 🔴 `apt-get update` and `install` must share a `RUN` or a cached stale index breaks the build. Cache/secret mounts; `ARG` ruled out as a secret |
| 03 | COPY vs ADD | **Use `COPY`.** Auto-extract depends on the **file**, not the instruction — a readability trap. `ADD <url>` commits the archive as a layer; `RUN curl \| tar` does not. `--checksum` is `ADD`'s one real advantage. `--chown` at copy time beats `RUN chown -R` |
| 04 | WORKDIR | `RUN cd` dies with its shell; `cd` **within** one `RUN` is fine. Applies to `CMD`/`ENTRYPOINT`/`COPY`/`ADD` too. Directories it creates are **root-owned** even after a `USER` |
| 05 | CMD vs ENTRYPOINT | The four combinations, then the table that matters: **what a user can override**. `ENTRYPOINT []` clears an inherited one — the "my CMD is ignored" fix. 🔴 `exec "$@"` ends every correct entrypoint script |
| 06 | exec vs shell form | Shell form makes `sh` PID 1; **`sh` does not forward `SIGTERM`, and as PID 1 with no handler it is not killed by it either** — so the grace period always elapses. `["npm start"]` is a 127. **Field diagnostic: time a `docker stop`** |
| 07 | ENV vs ARG | Three scoping rules cover every "my ARG is empty". `ENV` beats a same-named `ARG` in `RUN`. 🔴 **`ARG` is not a secret** — visible in `docker history`; rotate, because rebuilding does not unpublish. `TARGETARCH`/`BUILDPLATFORM` for native cross-compilation |
| 08 | .dockerignore | Three problems: upload time, **cache invalidation** (`.git` changes the `COPY` hash every commit — the commonest "the cache does not work"), and secrets in a layer. Root-only matching, so nested needs `**/`. Allowlist inversion. `Dockerfile` belongs here but not in `.gitignore` |
| 09 | USER | Default is root and most images never change it. **Install as root, run as somebody else.** `COPY --chown`, and `mkdir`+`chown` before the switch. **Numeric UID for the final `USER`** — orchestrator policies cannot resolve names. `USER` and `--userns` are independent |
| 10 | EXPOSE | Publishes nothing, restricts nothing. **Container-to-container needs neither `EXPOSE` nor `-p`.** Keep it as documentation that travels with the image |
| 11 | HEALTHCHECK | Defaults verified: interval **30s**, timeout **30s**, start-period **0s**, retries **3**; exit 0/1, 2 reserved. **The defaults are bad** — a 30s timeout leaves a hung service "healthy" ~90s. Check **your own** readiness, not dependencies, or a DB blip marks every replica unhealthy at once. 🔴 Docker only **reports** — unhealthy containers keep serving. Podman drives checks from **systemd timers** |
| 12 | LABEL (+MAINTAINER) | `.source` (GHCR package linking) and `.revision` (which commit is deployed) earn their place. A timestamp label makes the image **non-reproducible** and must go **last** or it wrecks the cache |
| 13 | VOLUME | Five reasons it hurts: anonymous volumes accumulate, it **silently defeats `--read-only`**, there is **no `VOLUME NONE`**, later build writes to the path are **discarded**, and it takes a deployment decision from the operator. Official DB images are the defensible exception |
| 14 | heredocs | Same single layer as `&&`. 🔴 **The failure mode is the point** — `sh` continues after a failed command and returns the **last** status, so every heredoc `RUN` needs `set -e` or it half-succeeds silently |
| 15 | syntax directive | **The frontend, not the engine, defines the instruction set** — new features with no engine upgrade. Must be line 1 or it is silently just a comment. Cost: a **pulled image**, so it breaks air-gapped builds. 🔴 **Buildah does not fetch frontends** — accepted and ignored under Podman |
| 16 | STOPSIGNAL/SHELL | Changes the **first** signal only, never the final `SIGKILL`, and installs no handler. nginx wants `SIGQUIT`. `SHELL ["/bin/bash","-o","pipefail","-c"]` — else a failed `curl` piped into a successful `grep` commits wrong content |
| 17 | ONBUILD | Acts at a distance: invisible in the child, runs **before** the child's own instructions, inherits the child's context, **not** chained to grandchildren. The official `onbuild` variants were deprecated and removed — that is the ecosystem's verdict |

## Recurring threads worth reusing in later phases

These keep paying off and should be cross-linked rather than re-argued:

- **The ten-second stop** — one measurable symptom tying together shell form, PID 1's
  missing default dispositions, and `exec "$@"`. Phases 1, 3 and 10.
- **"Rotate it — rebuilding does not unpublish"** — the correct response to any secret
  that reached a layer or a build arg. Phases 2, 3 and 5.
- **"Docker reports; something else must act"** — healthchecks, and restart policies
  reacting to exit rather than health. Phases 1, 3, 8 and 10.
- **The engine divergences that actually matter**, all flagged inline: short-name
  resolution, rootless UID mapping, privileged ports, systemd-timer healthchecks,
  no daemon to re-assert restart policies, Buildah not fetching frontends.
