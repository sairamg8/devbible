---
title: "Link map · Docker and Podman · Part 4 (phases 10–12)"
sidebar_label: "04 · Docker · Production and depth (10–12)"
sidebar_position: 4
---

# Link map · Docker and Podman · Part 4 — Production and depth (phases 10–12)

Covers every topic row of phases 10, 11 and 12 in `docs/docker/syllabus/04-production-and-depth.md`: T10-01 to T10-16, T11-01 to T11-16 and T12-01 to T12-12. That is 44 rows. **All 44 have a page of ours (✅)**; the path shown is the topic's folder README or its single page.
*read* = I read the passage; *headings only* = fetched, headings/size checked. Third-party links carry a date where the page shows one. `#anchors` are not used.

🔴 **Version note.** Our README targets Engine 29.7.2, Compose v5.4.0, Podman 6.1.0. The Docker Engine 29 release notes now list **29.9.0, dated 2026-10-08** (29.8.2 on 2026-09-30), so the README is behind by at least two minors. The Podman release notes (raw copy) still start at 6.1.0, and 6.0 lists the removals the syllabus names: BoltDB (auto-migrated to SQLite), Intel macOS, Windows 10, cgroups v1; it also lists iptables and CNI removal. I did not re-verify Compose or BuildKit numbers. `github.com` returns 403 to our fetcher, so READMEs are cited as `raw.githubusercontent.com` copies. Docker Hub pull limits read on 2026-10-12: 100 per 6 hours per IPv4 address or IPv6 /64 when unauthenticated, 200 for a Personal account, unlimited for paid plans.

---

## Phase 10 — Running containers in production

### T10-01 · PID 1 is not a normal process — Master · ✅ written `docs/docker/pages/phase-10-production/01-pid-1/README.md`
- **Read this:** [Tini README](https://raw.githubusercontent.com/krallin/tini/master/README.md) · krallin/tini · zombie reaping, signal forwarding, "default signal handlers work" for your process, and that `--init` already ships Tini (*read*) · covers our angle: **partial** — no "10 seconds on every deploy" story · fetched 2026-10-12
- **Also good:** [docker container run → Specify an init process](https://docs.docker.com/reference/cli/docker/container/run/) · Docker docs · `--init` makes an init the PID 1 so zombies are reaped (*read*) · fetched 2026-10-12
- **Our delta:** the hang-then-SIGKILL timeline; whether Podman's `--init` behaves the same is not confirmed.

### T10-02 · Graceful shutdown — Master · ✅ written `docs/docker/pages/phase-10-production/02-graceful-shutdown/README.md`
- **Read this:** [docker container stop](https://docs.docker.com/reference/cli/docker/container/stop/) · Docker docs · SIGTERM first, SIGKILL after the grace period; `STOPSIGNAL` or `--stop-signal` change the first signal; `-t` sets the wait (*read*) · covers our angle: **partial** — no application-side handler or connection draining · fetched 2026-10-12
- **Also good:** [Shutdown gracefully](https://raw.githubusercontent.com/goldbergyoni/nodebestpractices/master/sections/docker/graceful-shutdown.md) · Node.js Best Practices · why SIGTERM handling is the app's job; short, mentions a 30 second Kubernetes grace period (*read*) · fetched 2026-10-12
- **Also good:** [How to Handle Docker Container Graceful Shutdown and Signal Handling](https://oneuptime.com/blog/post/2026-01-16-docker-graceful-shutdown-signals/view) · OneUptime, dated 2026-01-16 in the URL · Node `server.close()` plus forced-exit timer, shell-form PID 1 trap, `stop_grace_period` (*read*) · fetched 2026-10-12
- **Our delta:** idle keep-alive sockets, load-balancer drain order, and a stop timeout longer than the work in flight.

### T10-03 · Resource limits — Master · ✅ written `docs/docker/pages/phase-10-production/03-resource-limits/README.md`
- **Read this:** [Resource constraints](https://docs.docker.com/engine/containers/resource_constraints/) · Docker docs · memory limits, OOME risk on the host, `--cpus` as CFS period and quota (*read*) · covers our angle: **partial** — `--pids-limit` and exit 137 are not on this page · fetched 2026-10-12
- **Also good:** [docker container run](https://docs.docker.com/reference/cli/docker/container/run/) · Docker docs · `--pids-limit` (-1 for unlimited) and `--oom-kill-disable` in the option table (*read* the option table) · fetched 2026-10-12
- **Our delta:** what an OOM kill looks like from outside; see T10-06 for the 137 reading.

### T10-04 · Logs go to stdout and stderr — Master · ✅ written `docs/docker/pages/phase-10-production/04-logs-to-stdout/README.md`
- **Read this:** [XI. Logs](https://12factor.net/logs) · The Twelve-Factor App · the app writes its event stream unbuffered to stdout and never manages log files (*read*, short) · covers our angle: **partial** — no Docker mechanics · fetched 2026-10-12
- **Also good:** [View container logs](https://docs.docker.com/engine/logging/) · Docker docs · `docker logs` shows the command's STDOUT and STDERR (*read* intro) · fetched 2026-10-12
- **Our delta:** why a log file inside the writable layer is a bug; structured one-line-per-event output.

### T10-05 · Configuration and secrets at runtime — Understand · ✅ written `docs/docker/pages/phase-10-production/05-config-and-secrets.md`
- **Read this:** [Secrets in Compose](https://docs.docker.com/compose/how-tos/use-secrets/) · Docker docs · secrets mount as files at `/run/secrets/<name>`, Linux containers only (*read*) · covers our angle: **partial** — Compose only; does not say what `docker inspect` or `/proc` expose for env vars (not confirmed) · fetched 2026-10-12
- **Also good:** [Environment variables in Compose](https://docs.docker.com/compose/how-tos/environment-variables/) · Docker docs · where to set them, precedence, interpolation (*headings only*) · fetched 2026-10-12
- **Our delta:** "not in the image" versus "not in the process list" is our framing.

### T10-06 · The production failure catalogue — Master · ✅ written `docs/docker/pages/phase-10-production/06-failure-catalogue/README.md`
- **Read this:** [Docker exit code 137: OOMKilled or SIGKILL?](https://www.netdata.cloud/guides/docker/docker-exit-code-137/) · Netdata · 137 is only "got SIGKILL"; causes table: cgroup OOM, external SIGKILL, stop timeout, host OOM, child OOM with `OOMKilled: false` and `memory.events` (*read*) · covers our angle: **partial** — one failure out of seven; no publication date shown · fetched 2026-10-12
- **Also good:** [Usage and limits: pulls](https://docs.docker.com/docker-hub/usage/pulls/) · Docker docs · the rate-limit numbers above (*read*) · fetched 2026-10-12
- **Our delta:** no single page lists the catalogue (tried: "docker production failure modes", "container incident checklist"); disk-full, clock skew, DNS and unhealthy-but-serving stay our own.

### T10-07 · Restart policies as supervision — Understand · ✅ written `docs/docker/pages/phase-10-production/07-restart-as-supervision.md`
- **Read this:** [Start containers automatically](https://docs.docker.com/engine/containers/start-containers-automatically/) · Docker docs · `no`, `on-failure[:max-retries]`, `always`, `unless-stopped`; warns not to combine restart policies with a host process manager (*read*) · covers our angle: **partial** — nothing on the silent crash loop or alerting (not confirmed) · fetched 2026-10-12
- **Our delta:** the crash loop that never alerts.

### T10-08 · Log drivers and rotation — Understand · ✅ written `docs/docker/pages/phase-10-production/08-log-drivers-and-rotation.md`
- **Read this:** [JSON File logging driver](https://docs.docker.com/engine/logging/drivers/json-file/) · Docker docs · `max-size` and `max-file` example for `daemon.json`; values must be strings; file-based storage warning (*read*) · covers our angle: **full**, apart from the 40 GB story · fetched 2026-10-12
- **Also good:** [Configure logging drivers](https://docs.docker.com/engine/logging/configure/) · Docker docs · driver list including `journald`; blocking versus non-blocking `mode` (*read*) · fetched 2026-10-12

### T10-09 · Healthchecks in production — Understand · ✅ written `docs/docker/pages/phase-10-production/09-healthchecks-in-production.md`
- **Read this:** [Liveness, readiness and startup probes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/) · kubernetes.io · the three probe kinds and what the kubelet does with each (*read* liveness and readiness passages) · covers our angle: **partial** — Kubernetes, not Docker or Compose · fetched 2026-10-12
- **Also good:** [Dockerfile reference](https://docs.docker.com/reference/dockerfile/) · Docker docs · the `HEALTHCHECK` instruction (*headings only*) · fetched 2026-10-12
- **Our delta:** liveness versus readiness as concepts for a plain Docker host, where nothing acts on "unhealthy" by itself (not confirmed on either page).

### T10-10 · Hardening at run time — Understand · ✅ written `docs/docker/pages/phase-10-production/10-hardening/README.md`
- **Read this:** [Docker Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html) · OWASP · set a user, limit capabilities, `--security-opt=no-new-privileges`, read-only filesystem, rootless mode, secrets (*read* rules 4 and 8, rest *headings only*) · covers our angle: **full** for the four switches; Podman not covered · fetched 2026-10-12
- **Also good:** [docker container run](https://docs.docker.com/reference/cli/docker/container/run/) · Docker docs · `--read-only`, `--cap-drop`, `--security-opt="no-new-privileges=true"` in the reference (*read*) · fetched 2026-10-12

### T10-11 · Observing — Know · ✅ written `docs/docker/pages/phase-10-production/11-observing.md`
- **Read this:** [docker container stats](https://docs.docker.com/reference/cli/docker/container/stats/) · Docker docs · `--no-stream`, `--format "{{ json . }}"`, columns for memory usage/limit and PIDs (*read*) · covers our angle: **partial** — no cAdvisor, no host versus cgroup memory · fetched 2026-10-12
- **Also good:** [cAdvisor README](https://raw.githubusercontent.com/google/cadvisor/master/README.md) · google/cadvisor · per-container usage daemon, run as a container (*read* intro) · fetched 2026-10-12
- **Also good:** [Runtime metrics](https://docs.docker.com/engine/containers/runmetrics/) · Docker docs · says its detailed examples use the cgroup v1 layout (*headings only* plus that note) · fetched 2026-10-12
- **Our delta:** why `docker stats` memory is not `free`, on cgroup v2 hosts.

### T10-12 · Debugging a container you cannot shell into — Understand · ✅ written `docs/docker/pages/phase-10-production/12-debugging-without-a-shell.md`
- **Read this:** [docker debug](https://docs.docker.com/reference/cli/docker/debug/) · Docker docs · debug shell into slim containers and images with no shell, without changing the image (*read* intro) · covers our angle: **partial** — whether it needs a paid plan is not confirmed; no Podman equivalent · fetched 2026-10-12
- **Also good:** [nsenter(1)](https://man7.org/linux/man-pages/man1/nsenter.1.html) · Linux man-pages · run a program in another process's namespaces (*read* description) · fetched 2026-10-12
- **Our delta:** copying a static binary in; no page found for it.

### T10-13 · Disk growth — Understand · ✅ written `docs/docker/pages/phase-10-production/13-disk-growth.md`
- **Read this:** [Prune unused Docker objects](https://docs.docker.com/engine/manage-resources/pruning/) · Docker docs · dangling versus unused images, containers, volumes, networks, build cache (*read* images section, rest *headings only*) · covers our angle: **full** for images; production-host caution is ours · fetched 2026-10-12
- **Also good:** [docker system prune](https://docs.docker.com/reference/cli/docker/system/prune/) · Docker docs · `--volumes` adds anonymous volumes to the prune; volumes are skipped by default (*read*) · fetched 2026-10-12

### T10-14 · Running containers under systemd — Understand · ✅ written `docs/docker/pages/phase-10-production/14-under-systemd.md`
- **Read this:** [podman-systemd.unit(5)](https://docs.podman.io/en/latest/markdown/podman-systemd.unit.5.html) · Podman docs · Quadlet unit types, `[Install]` with `WantedBy=default.target` (*read* intro and Install section) · covers our angle: **partial** — Podman only; no Docker unit-file page found · fetched 2026-10-12
- **Also good:** [Start containers automatically → process manager](https://docs.docker.com/engine/containers/start-containers-automatically/) · Docker docs · using systemd with Docker, and why not to mix it with restart policies (*read*) · fetched 2026-10-12

### T10-15 · Time, timezones and locales — Know · ✅ written `docs/docker/pages/phase-10-production/15-time-and-timezones.md`
- **Read this:** [How to Set Container Timezone in Docker](https://oneuptime.com/blog/post/2026-01-16-docker-container-timezone/view) · OneUptime, Jan 16, 2026 · default UTC, `TZ` env var, tzdata must be installed on Alpine and Ubuntu (*read*) · covers our angle: **partial** — vendor blog, no locale coverage · fetched 2026-10-12
- **Our delta:** no first-party Docker page on it (tried: docs.docker.com search for "timezone"); locales are ours.

### T10-16 · Zero-downtime restarts without an orchestrator — Know · ✅ written `docs/docker/pages/phase-10-production/16-zero-downtime-restarts.md`
- **Read this:** [docker-rollout README](https://raw.githubusercontent.com/wowu/docker-rollout/main/README.md) · wowu/docker-rollout · scales a Compose service to twice the instances, waits for ready, removes the old ones (*read*) · covers our angle: **partial** — a plugin, not the manual dance; no rollback · fetched 2026-10-12
- **Also good:** [Use Compose in production](https://docs.docker.com/compose/how-tos/production/) · Docker docs · deploying changes on a single server (*read* headings and intro) · fetched 2026-10-12

---

## Phase 11 — Podman in depth

### T11-01 · Daemonless — Master · ✅ written `docs/docker/pages/phase-11-podman-in-depth/01-daemonless/README.md`
- **Read this:** [podman(1)](https://docs.podman.io/en/latest/markdown/podman.1.html) · Podman docs · "a fully featured container engine that is a simple daemonless tool" (*read* description) · covers our angle: **partial** — one sentence; nothing on restart, logs or `systemctl` · fetched 2026-10-12
- **Also good:** [podman system service](https://docs.podman.io/en/latest/markdown/podman-system-service.1.html) · Podman docs · the API service is optional and can be socket-activated on demand (*read*) · fetched 2026-10-12
- **Our delta:** the process tree (conmon, runtime) is not confirmed by any official page I read.

### T11-02 · Rootless by default — Master · ✅ written `docs/docker/pages/phase-11-podman-in-depth/02-rootless-by-default/README.md`
- **Read this:** [Basic setup and use of Podman in a rootless environment](https://raw.githubusercontent.com/containers/podman/main/docs/tutorials/rootless_tutorial.md) · containers/podman · `/etc/subuid` and `/etc/subgid` ranges, `podman system migrate`, pasta networking (*read*) · covers our angle: **partial** — no UID arithmetic worked through · fetched 2026-10-12
- **Also good:** [user_namespaces(7)](https://man7.org/linux/man-pages/man7/user_namespaces.7.html) · Linux man-pages · the mapping rules (*headings only*) · fetched 2026-10-12
- **Our delta:** the arithmetic that turns a container UID into a host UID.

### T11-03 · Pods — Understand · ✅ written `docs/docker/pages/phase-11-podman-in-depth/03-pods.md`
- **Read this:** [podman pod create](https://docs.podman.io/en/latest/markdown/podman-pod-create.1.html) · Podman docs · infra container, exit policy (`stop` used by kube play and Quadlet), per-pod options (*read* those passages, rest *headings only*) · covers our angle: **partial** — "containers reach each other on localhost" is not stated in the passages I read (not confirmed) · fetched 2026-10-12
- **Also good:** [podman pod](https://docs.podman.io/en/latest/markdown/podman-pod.1.html) · Podman docs · "groups of containers, called pods" and the subcommand list (*read*) · fetched 2026-10-12

### T11-04 · Quadlet — Master · ✅ written `docs/docker/pages/phase-11-podman-in-depth/04-quadlet/README.md`
- **Read this:** [podman-systemd.unit(5)](https://docs.podman.io/en/latest/markdown/podman-systemd.unit.5.html) · Podman docs · lists `.artifact`, `.build`, `.container`, `.image`, `.kube`, `.network`, `.pod`, `.volume`; `[Install]` keys; `AutoUpdate=` (*read*) · covers our angle: **full** as reference; **partial** as a tutorial · fetched 2026-10-12
- **Our delta:** the page now also lists `.artifact` and `.image`, which our syllabus row omits.

### T11-05 · Where Podman will bite you — Master · ✅ written `docs/docker/pages/phase-11-podman-in-depth/05-where-podman-bites/README.md`
- **Read this:** [Shortcomings of rootless Podman](https://raw.githubusercontent.com/containers/podman/main/rootless.md) · containers/podman · no ports below 1024 without the sysctl, UID limits, device nodes (*read*) · covers our angle: **partial** — no linger, healthcheck timers or `netavark` messages · fetched 2026-10-12
- **Also good:** [loginctl(1)](https://man7.org/linux/man-pages/man1/loginctl.1.html) · Linux man-pages · `enable-linger` spawns a user manager at boot and keeps it after logout (*read*) · fetched 2026-10-12
- **Our delta:** healthchecks driven by systemd timers and Compose gaps: no page found.

### T11-06 · `podman unshare` — Understand · ✅ written `docs/docker/pages/phase-11-podman-in-depth/06-podman-unshare.md`
- **Read this:** [podman unshare](https://docs.podman.io/en/latest/markdown/podman-unshare.1.html) · Podman docs · launches a process in a new user namespace, defaulting to `$SHELL` (*read*) · covers our angle: **partial** — man page, no worked `chown` on a volume · fetched 2026-10-12

### T11-07 · `--userns` modes — Understand · ✅ written `docs/docker/pages/phase-11-podman-in-depth/07-userns-modes.md`
- **Read this:** [Rootless Podman user namespace modes](https://www.redhat.com/en/blog/rootless-podman-user-namespace-modes) · Red Hat blog, published 2023-01-11, modified 2025-11-21 · default, `keep-id`, `auto`, `nomap` with a bind-mount ownership example (*read*) · covers our angle: **full** · fetched 2026-10-12
- **Also good:** [podman run → `--userns`](https://docs.podman.io/en/latest/markdown/podman-run.1.html) · Podman docs · the reference (*headings only*, 130 KB page) · fetched 2026-10-12

### T11-08 · `podman pod create` / `ps` / `rm` — Understand · ✅ written `docs/docker/pages/phase-11-podman-in-depth/08-pod-commands.md`
- **Read this:** [podman pod create](https://docs.podman.io/en/latest/markdown/podman-pod-create.1.html) · Podman docs · options and exit policy (*headings only* plus the infra and exit-policy passages *read*) · covers our angle: **partial** — pod versus user-defined network is not discussed · fetched 2026-10-12
- **Also good:** [podman pod ps](https://docs.podman.io/en/latest/markdown/podman-pod-ps.1.html) · Podman docs (*headings only*) · fetched 2026-10-12
- **Also good:** [podman network create](https://docs.podman.io/en/latest/markdown/podman-network-create.1.html) · Podman docs · the alternative to a pod (*headings only*) · fetched 2026-10-12

### T11-09 · Quadlet vs `podman generate systemd` — Understand · ✅ written `docs/docker/pages/phase-11-podman-in-depth/09-quadlet-vs-generate-systemd.md`
- **Read this:** [podman generate systemd](https://docs.podman.io/en/latest/markdown/podman-generate-systemd.1.html) · Podman docs · marked DEPRECATED, recommends Quadlet, "no plans to remove", urgent bug fixes only (*read*) · covers our angle: **full** · fetched 2026-10-12
- **Also good:** [podman-systemd.unit(5)](https://docs.podman.io/en/latest/markdown/podman-systemd.unit.5.html) · Podman docs · the replacement (*read*) · fetched 2026-10-12

### T11-10 · `podman auto-update` — Know · ✅ written `docs/docker/pages/phase-11-podman-in-depth/10-auto-update.md`
- **Read this:** [podman auto-update](https://docs.podman.io/en/latest/markdown/podman-auto-update.1.html) · Podman docs · `registry` policy via label or `AutoUpdate=`, `--rollback` default true when the restarted unit fails (*read*) · covers our angle: **full** · fetched 2026-10-12
- **Our delta:** the page says failure detection works best when the container notifies readiness; we should show how.

### T11-11 · `podman kube play` / `generate kube` — Understand · ✅ written `docs/docker/pages/phase-11-podman-in-depth/11-kube-play.md`
- **Read this:** [podman kube play](https://docs.podman.io/en/latest/markdown/podman-kube-play.1.html) · Podman docs · creates containers, pods and volumes from Kubernetes YAML (*read* intro, rest *headings only*) · covers our angle: **partial** — reference, no on-ramp framing · fetched 2026-10-12
- **Also good:** [podman kube generate](https://docs.podman.io/en/latest/markdown/podman-kube-generate.1.html) · Podman docs · generates Pod YAML from containers, pods or volumes (*read* intro) · fetched 2026-10-12
- **Our delta:** `podman generate kube` now 404s on the docs site; the command is `podman kube generate`.

### T11-12 · Buildah and Skopeo — Know · ✅ written `docs/docker/pages/phase-11-podman-in-depth/12-buildah-and-skopeo.md`
- **Read this:** [Skopeo README](https://raw.githubusercontent.com/containers/skopeo/main/README.md) · containers/skopeo · copy images between registries without privilege, inspect remote images (*read* intro) · covers our angle: **partial** — Skopeo half only · fetched 2026-10-12
- **Also good:** [Buildah](https://buildah.io/) · buildah.io · "a tool that facilitates building OCI container images" (*read* top, rest *headings only*) · fetched 2026-10-12

### T11-13 · Docker CLI compatibility — Understand · ✅ written `docs/docker/pages/phase-11-podman-in-depth/13-docker-cli-compatibility.md`
- **Read this:** [podman system service](https://docs.podman.io/en/latest/markdown/podman-system-service.1.html) · Podman docs · `systemctl --user start podman.socket`, `DOCKER_HOST=unix://$XDG_RUNTIME_DIR/podman/podman.sock`, Docker v1.40 compatibility layer (*read*) · covers our angle: **partial** — no `alias docker=podman` (not confirmed) · fetched 2026-10-12
- **Also good:** [Using Podman instead of Docker (Testcontainers for Go)](https://golang.testcontainers.org/system_requirements/using_podman/) · testcontainers.org · socket discovery from `DOCKER_HOST`, rootless or rootful (*read*) · fetched 2026-10-12

### T11-14 · Podman 6 breaking changes — Understand · ✅ written `docs/docker/pages/phase-11-podman-in-depth/14-podman-6-breaking-changes.md`
- **Read this:** [Podman release notes (raw)](https://raw.githubusercontent.com/containers/podman/main/RELEASE_NOTES.md) · containers/podman · 6.0 removes BoltDB (auto-migration to SQLite), Intel Macs, Windows 10, cgroups v1, iptables and CNI (*read* the 6.0 list; 6.1.0 is the top entry) · covers our angle: **full**, plus two removals our row omits · fetched 2026-10-12

### T11-15 · `podman machine` — Know · ✅ written `docs/docker/pages/phase-11-podman-in-depth/15-podman-machine.md`
- **Read this:** [podman machine](https://docs.podman.io/en/latest/markdown/podman-machine.1.html) · Podman docs · Podman on macOS and Windows requires a VM; subcommands manage it (*read*) · covers our angle: **partial** — nothing on CPU, memory or disk the VM holds · fetched 2026-10-12
- **Our delta:** 6.1.0 adds `podman machine restart` (read in the release notes).

### T11-16 · Podman Desktop — Know · ✅ written `docs/docker/pages/phase-11-podman-in-depth/16-podman-desktop.md`
- **Read this:** [Podman Desktop introduction](https://podman-desktop.io/docs/intro) · podman-desktop.io · official docs entry; nav lists containers, pods, Compose, Kubernetes contexts (*headings only*) · covers our angle: **partial** — "what it adds over the CLI" is not argued · fetched 2026-10-12

---

## Phase 12 — Delivery, CI and the road to orchestration

### T12-01 · Tag strategy — Master · ✅ written `docs/docker/pages/phase-12-delivery-and-ci/01-tag-strategy/README.md`
- **Read this:** [Manage tags and labels with GitHub Actions](https://docs.docker.com/build/ci/github-actions/manage-tags-labels/) · Docker docs · `docker/metadata-action` with `type=sha`, `type=semver`, `type=ref,event=branch` (*read* the example workflow) · covers our angle: **partial** — a how-to, does not argue that `latest` is a trap · fetched 2026-10-12
- **Our delta:** immutable SHA tag plus moving tags, and pinning by digest.

### T12-02 · Building images in CI — Understand · ✅ written `docs/docker/pages/phase-12-delivery-and-ci/02-building-in-ci.md`
- **Read this:** [Cache management with GitHub Actions](https://docs.docker.com/build/ci/github-actions/cache/) · Docker docs · inline, registry (`cache-from`/`cache-to`) and other cache exporters in a workflow (*read*) · covers our angle: **full** for the cache mechanics · fetched 2026-10-12
- **Also good:** [Cache storage backends](https://docs.docker.com/build/cache/backends/) · Docker docs · the backend list (*headings only*) · fetched 2026-10-12

### T12-03 · One image, three environments — Master · ✅ written `docs/docker/pages/phase-12-delivery-and-ci/03-one-image-three-environments/README.md`
- **Read this:** [V. Build, release, run](https://12factor.net/build-release-run) · The Twelve-Factor App · strict separation of build and run stages (*read*, short) · covers our angle: **partial** — no digest promotion · fetched 2026-10-12
- **Our delta:** promoting one digest; no page found for it (tried: "promote same image digest staging production docker").

### T12-04 · Registry authentication in CI — Know · ✅ written `docs/docker/pages/phase-12-delivery-and-ci/04-registry-auth-in-ci.md`
- **Read this:** [OpenID Connect](https://docs.github.com/en/actions/concepts/security/openid-connect) · GitHub Docs · workflows exchange short-lived tokens instead of stored secrets (*read* overview) · covers our angle: **partial** — cloud providers; Docker Hub support not confirmed · fetched 2026-10-12
- **Also good:** [Docker access tokens](https://docs.docker.com/security/access-tokens/) · Docker docs · the token-based alternative to passwords (*headings only*) · fetched 2026-10-12

### T12-05 · Testing with containers — Understand · ✅ written `docs/docker/pages/phase-12-delivery-and-ci/05-testing-with-containers.md`
- **Read this:** [Getting started with Testcontainers for Node.js](https://testcontainers.com/guides/getting-started-with-testcontainers-for-nodejs/) · testcontainers.com · integration tests against a real PostgreSQL container (*read* intro) · covers our angle: **full** for Node · fetched 2026-10-12
- **Also good:** [Use Docker service containers](https://docs.github.com/en/actions/tutorials/use-containerized-services/use-docker-service-containers) · GitHub Docs · CI service containers (*read* intro) · fetched 2026-10-12

### T12-06 · Deploying without an orchestrator — Understand · ✅ written `docs/docker/pages/phase-12-delivery-and-ci/06-deploying-without-an-orchestrator.md`
- **Read this:** [Use Compose in production](https://docs.docker.com/compose/how-tos/production/) · Docker docs · production overrides, `restart` policy, "Running Compose on a single server" (*read* headings and intro) · covers our angle: **partial** — Compose only; Quadlet and PaaS are not covered · fetched 2026-10-12
- **Also good:** [podman-systemd.unit(5)](https://docs.podman.io/en/latest/markdown/podman-systemd.unit.5.html) · Podman docs · the Quadlet option (*read*) · fetched 2026-10-12

### T12-07 · When Compose stops being enough — Understand · ✅ written `docs/docker/pages/phase-12-delivery-and-ci/07-when-compose-stops-being-enough.md`
- **Read this:** [When to Use Docker Compose vs. Kubernetes](https://earthly.dev/blog/dockercompose-vs-k8s/) · Earthly blog, date not shown · contents list: scalability, reliability, self-healing versus quick local setup (*headings only*) · covers our angle: **partial** — vendor blog, older, not a threshold · fetched 2026-10-12
- **Our delta:** searches turned up only blogs with rules of thumb and no authoritative threshold; our four triggers (multi-host, health-gated rollouts, autoscaling, team isolation) stay our own judgement.

### T12-08 · Kubernetes on-ramp — Know · ✅ written `docs/docker/pages/phase-12-delivery-and-ci/08-kubernetes-on-ramp.md`
- **Read this:** [Translate a Docker Compose file to Kubernetes resources](https://kubernetes.io/docs/tasks/configure-pod-container/translate-compose-kubernetes/) · kubernetes.io · Kompose converts a Compose file (*read* contents, headings) · covers our angle: **partial** — a conversion tool, not the Pod/Deployment/Service/probe mapping · fetched 2026-10-12
- **Also good:** [Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/) · kubernetes.io (*headings only*) · fetched 2026-10-12
- **Also good:** [Pods](https://kubernetes.io/docs/concepts/workloads/pods/) · kubernetes.io (*headings only*) · fetched 2026-10-12
- **Our delta:** what has no equivalent.

### T12-09 · Rolling updates and rollback by hand — When Needed · ✅ written `docs/docker/pages/phase-12-delivery-and-ci/09-rolling-updates-by-hand.md`
- **Read this:** none found — tried: "docker rolling update without orchestrator rollback", "compose blue green manual", docs.docker.com, GitHub READMEs.
- **Also good:** [Apply rolling updates to a service](https://docs.docker.com/engine/swarm/swarm-tutorial/rolling-update/) · Docker docs · what `--update-delay` automates in Swarm (*read* the policy passage) · fetched 2026-10-12
- **Our delta:** the manual four-step dance and its failure modes are ours; see T10-16 for the plugin version.

### T12-10 · `docker context` — Know · ✅ written `docs/docker/pages/phase-12-delivery-and-ci/10-docker-context.md`
- **Read this:** [Docker contexts](https://docs.docker.com/engine/manage-resources/contexts/) · Docker docs · `docker context use`, and `DOCKER_HOST`/`DOCKER_CONTEXT` or `--context` override the active context (*read*) · covers our angle: **full** · fetched 2026-10-12

### T12-11 · Cost realities — When Needed · ✅ written `docs/docker/pages/phase-12-delivery-and-ci/11-cost-realities.md`
- **Read this:** [Usage and limits: pulls](https://docs.docker.com/docker-hub/usage/pulls/) · Docker docs · pull-rate tiers and what counts as a pull (*read*) · covers our angle: **partial** — Hub pulls only; no registry storage, egress or CI minutes · fetched 2026-10-12
- **Also good:** [Cache management with GitHub Actions](https://docs.docker.com/build/ci/github-actions/cache/) · Docker docs · cache as a build-time lever (*read*) · fetched 2026-10-12
- **Our delta:** no neutral page on registry storage or egress prices (tried: Docker Hub and GitHub docs); cite a vendor price page on the day.

### T12-12 · Docker Swarm in 2026 — When Needed · ✅ written `docs/docker/pages/phase-12-delivery-and-ci/12-swarm-in-2026.md`
- **Read this:** [Swarm mode](https://docs.docker.com/engine/swarm/) · Docker docs · Swarm mode is built into the Engine; Classic Swarm is no longer actively developed (*read* intro) · covers our angle: **partial** — no 2026 status statement · fetched 2026-10-12
- **Also good:** [Is Docker Swarm Still Safe in 2026?](https://www.virtualizationhowto.com/2026/03/is-docker-swarm-still-safe-in-2026/) · Virtualization Howto, March 23, 2026 · no major features lately; says Mirantis committed to support through 2030 (*read*) · fetched 2026-10-12
- **Our delta:** the 2030 date is reported by that blog; Mirantis's own 2022 release does not state it in the passage I found, so treat it as not confirmed at source. Search results disagree on "maintenance mode".
