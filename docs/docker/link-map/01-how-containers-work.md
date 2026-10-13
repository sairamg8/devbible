---
title: "Link map · Docker and Podman · Part 1 (phases 0–2)"
sidebar_label: "01 · Docker · How containers work (0–2)"
sidebar_position: 1
---

# Link map · Docker and Podman · Part 1 — How containers work (phases 0–2)

Covers every topic row of phases 0, 1 and 2 in `docs/docker/syllabus/01-how-containers-work.md`: T00-01 to T00-14, T01-01 to T01-16 and T02-01 to T02-15. **All 45 rows have a page of ours (✅).**
*read* = I read the passage; *headings only* = fetched, headings/size checked. Third-party links carry a date where the page shows one. `#anchors` appear only where the heading id was seen in the page HTML.

🔴 **Version note.** Our README targets Docker Engine 29.7.2, Compose v5.4.0, Podman 6.1.0 (5.8.4 on this machine). The Podman release notes (raw copy) list 6.1.0 as the newest entry and confirm that Podman 6 removed cgroups v1, BoltDB (auto-migrated to SQLite), iptables and CNI. The Docker Engine 29 release notes (docs.docker.com/engine/release-notes/29/) list **29.9.0, dated 2026-10-08**, so the README's 29.7.2 is behind by two minors; the other patch numbers were not re-verified. `github.com` returns 403 to our fetcher, so READMEs are cited as `raw.githubusercontent.com` copies. `docs.docker.com/registry/` now redirects to a retired page; the registry docs live at distribution.github.io.

🔴 **Syllabus drift found.** T02-13 says "`overlay2` for Docker". The Docker storage-driver page says Engine 29.0 and later uses the **containerd image store by default for fresh installations**; an upgraded daemon keeps the classic drivers such as `overlay2`. The page should say both.

---

## Phase 0 — What a container actually is

### T00-01 · A container is a process — Master · ✅ written `docs/docker/pages/phase-0-what-a-container-is/01-a-container-is-a-process.md`
- **Read this:** [What even is a container: namespaces and cgroups](https://jvns.ca/blog/2016/10/10/what-even-is-a-container/) · Julia Evans, 10 Oct 2016 · short walk through namespaces, cgroups and seccomp-bpf, ending in "what are containers?" (*read* the headings, ≈900 words) · covers our angle: **partial** — 2016, no root filesystem or OCI, no rootless · fetched 2026-10-12
- **Also good:** [What is Docker?](https://docs.docker.com/get-started/docker-overview/) · Docker docs, modified 2026-09-07 · "The underlying technology": namespaces give the isolated workspace (*read*) · fetched 2026-10-12
- **Beyond the docs:** [Build a Container from Scratch in Go](https://labs.iximiuz.com/tutorials/build-a-container-from-scratch-in-go-1b92e418) · iximiuz Labs (Liz Rice's GOTO 2018 talk, tutorial by Başar Subaşı; page shows last updated Aug 14, 2026) · builds a tiny runtime step by step with UTS, PID and mount namespaces, chroot and a cgroups v2 `pids.max`, so the container-is-a-process claim is shown in code rather than described · fetched 2026-10-13 (*headings only*)
- **Our delta:** "there is no container object in the kernel" is our framing; neither page says it in those words (not confirmed).

### T00-02 · Namespaces — Master · ✅ written `docs/docker/pages/phase-0-what-a-container-is/02-namespaces.md`
- **Read this:** [namespaces(7)](https://man7.org/linux/man-pages/man7/namespaces.7.html) · Linux man-pages · table of every type with its flag, including Time (`/proc/PID/ns/time` since Linux 5.6) (*read* the table) · covers our angle: **partial** — reference, no "which symptom is which namespace" · fetched 2026-10-12
- **Also good:** [user_namespaces(7)](https://man7.org/linux/man-pages/man7/user_namespaces.7.html) · Linux man-pages · UID mapping (*headings only*) · fetched 2026-10-12
- **Our delta:** the symptom-to-namespace table.

### T00-03 · cgroups v2 — Master · ✅ written `docs/docker/pages/phase-0-what-a-container-is/03-cgroups.md`
- **Read this:** [Resource constraints](https://docs.docker.com/engine/containers/resource_constraints/) · Docker docs, modified 2026-08-16 · `--memory`, `--memory-swap`, `--cpus` change the container's cgroup settings; risks of running out of memory (*read*) · covers our angle: **partial** — flags only, no cgroup v2 files, nothing on why `free` shows host RAM · fetched 2026-10-12
- **Also good:** [Control Group v2](https://docs.kernel.org/admin-guide/cgroup-v2.html) · kernel.org · the authoritative file reference (*headings only*) · [Podman RELEASE_NOTES.md (raw)](https://raw.githubusercontent.com/containers/podman/main/RELEASE_NOTES.md) · github (raw) · "Support for running on cgroups v1 systems has been removed" in the 6.0 notes (*read*) · fetched 2026-10-12
- **Checked, not chosen:** a search for `free` and `/proc/meminfo` versus cgroup limits returned only old LXC list posts and a forum thread; none is a Docker page.
- **Our delta:** why `free -h` shows host memory (it reads `/proc/meminfo`, which is not scoped to the cgroup). Not confirmed by a primary page I fetched.

### T00-04 · The image is not the container — Master · ✅ written `docs/docker/pages/phase-0-what-a-container-is/04-image-vs-container.md`
- **Read this:** [Storage drivers](https://docs.docker.com/engine/storage/drivers/) · Docker docs · writes go to a thin writable container layer, deleted with the container; many containers share one image (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [What is an image?](https://docs.docker.com/get-started/docker-concepts/the-basics/what-is-an-image/) · Docker docs · images are immutable and made of layers (*read*) · fetched 2026-10-12
- **Beyond the docs:** [You Don't Need an Image To Run a Container](https://iximiuz.com/en/posts/you-dont-need-an-image-to-run-a-container/) · Ivan Velichko, iximiuz.com, May 16, 2020 (updated Aug 7, 2021) · runs a container with runc from a plain directory and config.json, which separates what an image is for (build and distribute) from what running needs · fetched 2026-10-13 (*read*)

### T00-05 · The runtime stack, Docker — Understand · ✅ written `docs/docker/pages/phase-0-what-a-container-is/05-runtime-stack-docker.md`
- **Read this:** [containerd vs. Docker](https://www.docker.com/blog/containerd-vs-docker/) · Docker blog, 27 Mar 2024, modified 2024-11-13 · containerd delegates to runc "using a shim process" (*read*) · covers our angle: **partial** — no "which piece dies when" table · fetched 2026-10-12
- **Also good:** [What is Docker?](https://docs.docker.com/get-started/docker-overview/) · Docker docs · daemon, client, registries, objects (*headings only*) · fetched 2026-10-12
- **Beyond the docs:** [Implementing Container Runtime Shim: runc](https://iximiuz.com/en/posts/implementing-container-runtime-shim/) · Ivan Velichko, iximiuz.com, Dec 15, 2019 (updated Sep 11, 2022) · explains why a shim exists: it holds stdio and records the exit code so containers survive a manager restart, which the Docker blog only mentions · fetched 2026-10-13 (*read*)
- **Our delta:** the failure table. That a shim lets containers survive a daemon restart came from search summaries only (not confirmed on a fetched page).

### T00-06 · The runtime stack, Podman — Understand · ✅ written `docs/docker/pages/phase-0-what-a-container-is/06-runtime-stack-podman.md`
- **Read this:** [conmon README (raw)](https://raw.githubusercontent.com/containers/conmon/main/README.md) · github (raw) · conmon sits between a container manager (Podman, CRI-O) and an OCI runtime (runc, crun) (*read*) · covers our angle: **partial** — no process tree, no "child of your shell's session" · fetched 2026-10-12
- **Also good:** [Podman README (raw)](https://raw.githubusercontent.com/containers/podman/main/README.md) · github (raw) · "No manager daemon" (*read*) · fetched 2026-10-12
- **Checked, not chosen:** blog posts from a web search describe Podman → conmon → crun, but none is primary.
- **Our delta:** the explicit chain and the session-child claim; crun as the default runtime is not confirmed here.

### T00-07 · OverlayFS and copy-up — Understand · ✅ written `docs/docker/pages/phase-0-what-a-container-is/07-overlayfs.md`
- **Read this:** [OverlayFS storage driver](https://docs.docker.com/engine/storage/drivers/overlayfs-driver/) · Docker docs · `copy_up` copies the entire file, even if only a small part changes (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Overlay Filesystem](https://docs.kernel.org/filesystems/overlayfs.html) · kernel.org · lower, upper, copy up, metacopy (*read* the copy-up passage) · fetched 2026-10-12

### T00-08 · The OCI specifications — Understand · ✅ written `docs/docker/pages/phase-0-what-a-container-is/08-oci-specs.md`
- **Read this:** [Open Container Initiative overview](https://opencontainers.org/about/overview/) · opencontainers.org · three specs: runtime, image, distribution (*read*) · covers our angle: full · fetched 2026-10-12
- **Beyond the docs:** [What is Open Container Initiative (OCI)? Build Spec, Runtime Spec, Image Spec and more](https://mkdev.me/posts/what-is-open-container-initiative-oci-build-spec-runtime-spec-image-spec-and-more) · Kirill Shirinkin, mkdev, published 10/08/24, updated 01/03/25 · explains why compliant tools interoperate (build with one, run with another) and notes that an image is not strictly required to run a container · fetched 2026-10-13 (*read*)
- **Our delta:** why Docker and Podman are interchangeable in practice.

### T00-09 · Capabilities and --privileged — Understand · ✅ written `docs/docker/pages/phase-0-what-a-container-is/09-capabilities.md`
- **Read this:** [Running containers: runtime privilege and Linux capabilities](https://docs.docker.com/engine/containers/run/#runtime-privilege-and-linux-capabilities) · Docker docs, modified 2026-05-13 · `--cap-add`, `--cap-drop`, `--privileged` gives access to devices; table of default capabilities (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [capabilities(7)](https://man7.org/linux/man-pages/man7/capabilities.7.html) · Linux man-pages · `CAP_SYS_ADMIN` is overloaded, with later splits such as `CAP_BPF` (*read*) · fetched 2026-10-12

### T00-10 · seccomp, AppArmor and SELinux — Understand · ✅ written `docs/docker/pages/phase-0-what-a-container-is/10-seccomp-apparmor-selinux.md`
- **Read this:** [Seccomp security profiles for Docker](https://docs.docker.com/engine/security/seccomp/) · Docker docs · default profile disables about 44 of 300+ syscalls, an allowlist (*read*) · covers our angle: **partial** — no AppArmor or SELinux · fetched 2026-10-12
- **Also good:** [AppArmor security profiles](https://docs.docker.com/engine/security/apparmor/) · Docker docs · auto-generated `docker-default` profile (*read*) · [Bind mounts: configure the SELinux label](https://docs.docker.com/engine/storage/bind-mounts/#configure-the-selinux-label) · Docker docs · `z` marks content shared between containers, `Z` private; both change labels on the host path (*read*) · fetched 2026-10-12
- **Beyond the docs:** [Container security fundamentals part 5: AppArmor and SELinux](https://securitylabs.datadoghq.com/articles/container-security-fundamentals-part-5/) · Rory McCune, Datadog Security Labs, Aug 4, 2023 · covers the two mandatory access control systems and how each applies to containers, the half the Docker seccomp page leaves out (seccomp is not covered; it is the next part in the series) · fetched 2026-10-13 (*read*)
- **Checked, not chosen:** [Red Hat on user namespaces and SELinux](https://www.redhat.com/en/blog/user-namespaces-selinux-rootless-containers) · page dated June 25, 2020 (*headings only*; page is mostly site navigation in our fetcher).
- **Our delta:** the "permission denied on a file you can see" diagnosis ladder.

### T00-11 · Rootless containers — Understand · ✅ written `docs/docker/pages/phase-0-what-a-container-is/11-rootless.md`
- **Read this:** [Podman rootless tutorial (raw)](https://raw.githubusercontent.com/containers/podman/main/docs/tutorials/rootless_tutorial.md) · github (raw) · `/etc/subuid` and `/etc/subgid` ranges; `root` in the container is your user on the host (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Rootless mode](https://docs.docker.com/engine/security/rootless/) · Docker docs, modified 2026-06-07 · needs `newuidmap`/`newgidmap` and at least 65,536 subordinate IDs (*read*) · fetched 2026-10-12
- **Our delta:** the exact outside UID depends on the user's `/etc/subuid` line (the Docker example shows 231072), not a fixed 100000.

### T00-12 · Why "works on my machine" stops being a sentence — Know · ✅ written `docs/docker/pages/phase-0-what-a-container-is/12-works-on-my-machine.md`
- **Read this:** [What is a container?](https://docs.docker.com/get-started/docker-concepts/the-basics/what-is-a-container/) · Docker docs · self-contained, isolated processes with no reliance on host dependencies (*read*) · covers our angle: **partial** — the "image ships the config too" point is ours · fetched 2026-10-12
- **Beyond the docs:** [Not Every Container Has an Operating System Inside](https://iximiuz.com/en/posts/not-every-container-has-an-operating-system-inside/) · Ivan Velichko, iximiuz.com, May 7, 2020 (updated Sep 4, 2022) · shows a container that is one static binary on a scratch base, so what ships is the userland and config, never a kernel · fetched 2026-10-13 (*read*)

### T00-13 · Containers vs VMs vs serverless — Know · ✅ written `docs/docker/pages/phase-0-what-a-container-is/13-containers-vs-vms.md`
- **Read this:** [What is a container?](https://www.docker.com/resources/what-container/) · docker.com · containers virtualize the OS, VMs the hardware (*read*) · covers our angle: **partial** — vendor page, no blast-radius or boot-time numbers, serverless barely mentioned · fetched 2026-10-12
- **Our delta:** the honest trade table. I found no neutral page covering isolation strength and serverless together.

### T00-14 · Getting one installed — Know · ✅ written `docs/docker/pages/phase-0-what-a-container-is/14-installing.md`
- **Read this:** [Install Docker Engine](https://docs.docker.com/engine/install/) · Docker docs, modified 2026-09-11 · per-platform procedures, release channels, support, licensing (*headings only*) · covers our angle: **partial** — Engine only · fetched 2026-10-12
- **Also good:** [Docker Desktop license agreement](https://docs.docker.com/subscription-billing/desktop-license/) · Docker docs, modified 2026-09-28 · free for fewer than 250 employees AND under $10 million revenue, personal, education, non-commercial open source (*read*) · [Podman installation](https://podman.io/docs/installation) · podman.io · Mac and Windows run a Podman machine (*read*) · fetched 2026-10-12

---

## Phase 1 — Running containers

### T01-01 · docker run anatomy — Master · ✅ written `docs/docker/pages/phase-1-running-containers/01-docker-run-anatomy.md`
- **Read this:** [Running containers: general form](https://docs.docker.com/engine/containers/run/#general-form) · Docker docs, modified 2026-05-13 · image references, options, commands and arguments (*read* the headings, ≈9k words) · covers our angle: full · fetched 2026-10-12
- **Also good:** [docker container run](https://docs.docker.com/reference/cli/docker/container/run/) · Docker docs · full option table (*headings only*) · fetched 2026-10-12

### T01-02 · Foreground vs detached — Master · ✅ written `docs/docker/pages/phase-1-running-containers/02-detached-and-cleanup.md`
- **Read this:** [Running containers: foreground and background](https://docs.docker.com/engine/containers/run/#foreground-and-background) · Docker docs · `--detach`, `--attach`, `--tty`, `--interactive`; three ways to identify a container (*read*) · covers our angle: **partial** — nothing on unnamed containers · fetched 2026-10-12
- **Also good:** [docker container run](https://docs.docker.com/reference/cli/docker/container/run/) · Docker docs · `--rm` removes the container and its anonymous volumes (*read* the option table) · fetched 2026-10-12

### T01-03 · ps / inspect / logs / stats — Master · ✅ written `docs/docker/pages/phase-1-running-containers/03-ps-inspect-logs-stats.md`
- **Read this:** [docker container ls](https://docs.docker.com/reference/cli/docker/container/ls/) · Docker docs · `docker ps` is an alias; `-a` shows all (*read*) · covers our angle: **partial** — one of the four commands · fetched 2026-10-12
- **Also good:** [docker container logs](https://docs.docker.com/reference/cli/docker/container/logs/) · Docker docs · `-f`, `--since`, `--tail` (*read*) · [docker container inspect](https://docs.docker.com/reference/cli/docker/container/inspect/) · Docker docs · low-level information (*headings only*) · fetched 2026-10-12
- **Checked, not chosen:** [docker container stats](https://docs.docker.com/reference/cli/docker/container/stats/) · live stream of resource usage (*read* the description).
- **Our delta:** "which command answers which question".

### T01-04 · exec vs run — Master · ✅ written `docs/docker/pages/phase-1-running-containers/04-exec-vs-run.md`
- **Read this:** [docker container exec](https://docs.docker.com/reference/cli/docker/container/exec/) · Docker docs · runs a new command in a running container (*read* the description) · covers our angle: **partial** — no contrast with `run` · fetched 2026-10-12
- **Our delta:** the "my changes disappeared" explanation.

### T01-05 · Publishing ports — Master · ✅ written `docs/docker/pages/phase-1-running-containers/05-publishing-ports.md`
- **Read this:** [Port publishing and mapping](https://docs.docker.com/engine/network/port-publishing/) · Docker docs · published ports are reachable from outside the host; `-p 127.0.0.1:8080:80` limits them to the host; behaviour changed in releases before 28.0.0 (*read*) · covers our angle: full · fetched 2026-10-12

### T01-06 · Environment — Master · ✅ written `docs/docker/pages/phase-1-running-containers/06-environment.md`
- **Read this:** [Running containers: environment variables](https://docs.docker.com/engine/containers/run/#environment-variables) · Docker docs · overriding image defaults (*headings only*) · covers our angle: **partial** — precedence against image `ENV` not confirmed from a passage · fetched 2026-10-12
- **Also good:** [Overriding container defaults](https://docs.docker.com/get-started/docker-concepts/running-containers/overriding-container-defaults/) · Docker docs, modified 2025-12-03 · section on setting environment variables (*headings only*); `-e` and `--env-file` are listed in the [run option table](https://docs.docker.com/reference/cli/docker/container/run/) (*read*) · fetched 2026-10-12

### T01-07 · The lifecycle — Understand · ✅ written `docs/docker/pages/phase-1-running-containers/07-lifecycle.md`
- **Read this:** [docker container pause](https://docs.docker.com/reference/cli/docker/container/pause/) · Docker docs · suspends all processes in the container (*read*) · covers our angle: **partial** — one transition only; I found no Docker page with the created, running, paused, exited state diagram · fetched 2026-10-12
- **Checked, not chosen:** the `ls` and `run` reference pages (no state list found).
- **Our delta:** the whole state diagram.

### T01-08 · Stop is two signals — Understand · ✅ written `docs/docker/pages/phase-1-running-containers/08-stop-is-two-signals.md`
- **Read this:** [docker container stop](https://docs.docker.com/reference/cli/docker/container/stop/) · Docker docs · `SIGTERM`, then `SIGKILL` after a grace period; `STOPSIGNAL` or `--stop-signal` changes the first (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [docker container attach](https://docs.docker.com/reference/cli/docker/container/attach/) · Docker docs · PID 1 ignores signals with the default action (*read*) · fetched 2026-10-12

### T01-09 · Exit codes — Understand · ✅ written `docs/docker/pages/phase-1-running-containers/09-exit-codes.md`
- **Read this:** [Running containers: exit status](https://docs.docker.com/engine/containers/run/#exit-status) · Docker docs · 125 is the daemon, 126 not invokable, 127 not found, anything else is the command's own code (*read*) · covers our angle: **partial** — no 137 or 143 · fetched 2026-10-12
- **Also good:** [podman run: exit status](https://docs.podman.io/en/latest/markdown/podman-run.1.html) · Podman docs · same 125 scheme, "error is with Podman itself" (*read*) · fetched 2026-10-12
- **Beyond the docs:** [Docker exit code 137: OOMKilled or SIGKILL?](https://www.netdata.cloud/guides/docker/docker-exit-code-137/) · Netdata guides (no date shown on page) · 137 is 128 plus signal 9, how to tell an OOM kill from an ignored SIGTERM with `.State.OOMKilled`, and the 10 second stop timeout, which fills the gap the Docker page leaves · fetched 2026-10-13 (*read*)
- **Our delta:** 137 (SIGKILL or OOM) and 143 (SIGTERM) are signal numbers plus 128; no fetched page states it.

### T01-10 · -i, -t and -it — Understand · ✅ written `docs/docker/pages/phase-1-running-containers/10-interactive-and-tty.md`
- **Read this:** [docker container run](https://docs.docker.com/reference/cli/docker/container/run/) · Docker docs · `-i` keeps STDIN open even if not attached (*read* the option table) · covers our angle: **partial** — definitions only, nothing on `-it` hanging a CI job · fetched 2026-10-12
- **Our delta:** what a TTY allocates and the CI hang; I found no page for it.

### T01-11 · Overriding ENTRYPOINT and CMD — Understand · ✅ written `docs/docker/pages/phase-1-running-containers/11-overriding-entrypoint.md`
- **Read this:** [Running containers: default entrypoint](https://docs.docker.com/engine/containers/run/#default-entrypoint) · Docker docs · `--entrypoint` overwrites the image entrypoint; a trailing command is appended to it (*read*) · covers our angle: **partial** — no recipe for an image with no shell · fetched 2026-10-12

### T01-12 · --restart policies — Understand · ✅ written `docs/docker/pages/phase-1-running-containers/12-restart-policies.md`
- **Read this:** [Start containers automatically](https://docs.docker.com/engine/containers/start-containers-automatically/) · Docker docs, modified 2026-08-16 · `no`, `on-failure`, `always`, `unless-stopped`; restart policy versus process manager (*read*) · covers our angle: **partial** — Docker only; the Podman side is under Also good · fetched 2026-10-12
- **Also good:** [podman run: `--restart`](https://docs.podman.io/en/latest/markdown/podman-run.1.html#restart-policy) · Podman docs · same flag with `no`, `on-failure`, `always`, `unless-stopped`; `podman-restart.service` restarts containers after a reboot, and inside systemd units use `Restart=` instead (*read*) · fetched 2026-10-12
- **Our delta:** that Podman needs no daemon for this is our framing; the Podman page ties reboot restarts to a systemd unit (the daemonless claim itself is not confirmed here).

### T01-13 · Reclaiming disk — Understand · ✅ written `docs/docker/pages/phase-1-running-containers/13-reclaiming-disk.md`
- **Read this:** [Prune unused Docker objects](https://docs.docker.com/engine/manage-resources/pruning/) · Docker docs, modified 2026-08-13 · images, containers, volumes, networks, build cache, everything (*headings only*) · covers our angle: **partial** · fetched 2026-10-12
- **Also good:** [docker system prune](https://docs.docker.com/reference/cli/docker/system/prune/) · Docker docs · stopped containers, unused networks, dangling images, build cache; `--volumes` adds anonymous volumes (*read*) · fetched 2026-10-12
- **Beyond the docs:** [Docker: Clean up unused stuff on your development machine](https://adamj.eu/tech/2023/08/21/docker-clean-up/) · Adam Johnson, Aug 21, 2023 · a practical routine with `docker system df` to preview, age-filtered prune, and the separate `docker volume prune` because `--volumes` cannot combine with `--filter` · fetched 2026-10-13 (*read*)
- **Our delta:** `system df` was not opened.

### T01-14 · --user, --workdir, --hostname, --add-host — Know · ✅ written `docs/docker/pages/phase-1-running-containers/14-user-workdir-hostname.md`
- **Read this:** [docker container run](https://docs.docker.com/reference/cli/docker/container/run/) · Docker docs · `--add-host` takes host:ip; option table, plus `workdir` example heading (*read* the table) · covers our angle: **partial** — flags only · fetched 2026-10-12
- **Also good:** [Running containers: user](https://docs.docker.com/engine/containers/run/#user) · Docker docs (*headings only*) · fetched 2026-10-12

### T01-15 · docker cp — Know · ✅ written `docs/docker/pages/phase-1-running-containers/15-docker-cp.md`
- **Read this:** [docker container cp](https://docs.docker.com/reference/cli/docker/container/cp/) · Docker docs · copies between a container and the local filesystem, both ways (*read* the usage) · covers our angle: **partial** — "a smell if load-bearing" is ours · fetched 2026-10-12

### T01-16 · attach vs logs -f — When Needed · ✅ written `docs/docker/pages/phase-1-running-containers/16-attach-vs-logs.md`
- **Read this:** [docker container attach](https://docs.docker.com/reference/cli/docker/container/attach/) · Docker docs · detach with CTRL-p CTRL-q when run with `-i -t`; `--sig-proxy` makes CTRL-c a SIGINT to the container (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [docker container logs](https://docs.docker.com/reference/cli/docker/container/logs/) · Docker docs · `-f`, `--follow` (*read*) · fetched 2026-10-12

---

## Phase 2 — Images, layers and registries

### T02-01 · Image references — Master · ✅ written `docs/docker/pages/phase-2-images-and-registries/01-image-references.md`
- **Read this:** [docker image tag](https://docs.docker.com/reference/cli/docker/image/tag/) · Docker docs · `[HOST[:PORT]/]NAMESPACE/REPOSITORY[:TAG]`; omitted host means Docker Hub (*read*) · covers our angle: **partial** — digest part and the implicit `library/` namespace not shown · fetched 2026-10-12
- **Also good:** [OCI distribution spec (raw)](https://raw.githubusercontent.com/opencontainers/distribution-spec/main/spec.md) · github (raw) · the registry protocol (*headings only*) · fetched 2026-10-12

### T02-02 · Tags move, digests do not — Master · ✅ written `docs/docker/pages/phase-2-images-and-registries/02-tags-vs-digests.md`
- **Read this:** [Building best practices: pin base image versions](https://docs.docker.com/build/building/best-practices/#pin-base-image-versions) · Docker docs, modified 2026-09-04 · tags are mutable; `FROM alpine:3.21@sha256:…` pins; the cost is opting out of automated security fixes (*read*) · covers our angle: full · fetched 2026-10-12
- **Beyond the docs:** [Overcoming Docker's Mutable Image Tags](https://www.mend.io/blog/overcoming-dockers-mutable-image-tags/) · Rhys Arkins, Mend, Mar 19, 2018 · a real incident where tags kept their names but changed content and broke builds, plus tag-and-digest pinning kept current by Renovate · fetched 2026-10-13 (*read*)

### T02-03 · pull / push / images / tag / rmi — Master · ✅ written `docs/docker/pages/phase-2-images-and-registries/03-pull-push-tag.md`
- **Read this:** [docker image ls](https://docs.docker.com/reference/cli/docker/image/ls/) · Docker docs · untagged (dangling) images are hidden unless `-a` (*read*) · covers our angle: **partial** — `ls` only · fetched 2026-10-12
- **Also good:** [docker image rm](https://docs.docker.com/reference/cli/docker/image/rm/) · Docker docs · removes and un-tags (*read*) · [docker image prune](https://docs.docker.com/reference/cli/docker/image/prune/) · Docker docs · removes all dangling images (*read*) · fetched 2026-10-12

### T02-04 · Layers — Master · ✅ written `docs/docker/pages/phase-2-images-and-registries/04-layers.md`
- **Read this:** [Understanding the image layers](https://docs.docker.com/get-started/docker-concepts/building-images/understanding-image-layers/) · Docker docs, modified 2026-01-21 · build an image and watch layers stack (*read* the headings, ≈1.5k words) · covers our angle: **partial** — sharing between images is on the storage page · fetched 2026-10-12
- **Also good:** [Storage drivers](https://docs.docker.com/engine/storage/drivers/) · Docker docs · multiple containers share an image (*read*) · fetched 2026-10-12

### T02-05 · Choosing a base image — Understand · ✅ written `docs/docker/pages/phase-2-images-and-registries/05-choosing-a-base-image.md`
- **Read this:** [Building best practices: choose the right base image](https://docs.docker.com/build/building/best-practices/#choose-the-right-base-image) · Docker docs · (*headings only*) · covers our angle: **partial** — section text not read in full · fetched 2026-10-12
- **Also good:** [Distroless README (raw)](https://raw.githubusercontent.com/GoogleContainerTools/distroless/main/README.md) · github (raw) · images with only your application and its runtime dependencies (*read* the opening) · fetched 2026-10-12
- **Beyond the docs:** [Fly With Alpine](https://fly.io/blog/fly-with-alpine/) · fly.io blog (no author or date shown on page) · weighs Alpine against Debian slim with measurements and the musl versus glibc and missing-tools costs, concluding Debian stays the default · fetched 2026-10-13 (*read*)
- **Our delta:** the size, debuggability and compatibility triangle; Docker Hardened Images has a docs section at docs.docker.com/dhi/ (*not opened*).

### T02-06 · history — Understand · ✅ written `docs/docker/pages/phase-2-images-and-registries/06-history.md`
- **Read this:** [docker image history](https://docs.docker.com/reference/cli/docker/image/history/) · Docker docs · options, `--format`, `--platform` (*headings only*) · covers our angle: **partial** — no worked "find the 400 MB layer" · fetched 2026-10-12

### T02-07 · The image config — Understand · ✅ written `docs/docker/pages/phase-2-images-and-registries/07-image-config.md`
- **Read this:** [OCI image config (raw)](https://raw.githubusercontent.com/opencontainers/image-spec/main/config.md) · github (raw) · `ExposedPorts` is a set of defaults, merged at run time (*read*) · covers our angle: **partial** — defines `Env`, `Entrypoint`, `Cmd`, `User`, `WorkingDir`, `Labels`, `ExposedPorts`, but it is the OCI spec, not what `docker inspect` prints · fetched 2026-10-12
- **Also good:** [docker container inspect](https://docs.docker.com/reference/cli/docker/container/inspect/) · Docker docs (*headings only*) · fetched 2026-10-12

### T02-08 · Registries and rate limits — Understand · ✅ written `docs/docker/pages/phase-2-images-and-registries/08-registries.md`
- **Read this:** [Docker Hub pull usage and limits](https://docs.docker.com/docker-hub/usage/pulls/) · Docker docs, modified 2026-09-03 · per 6 hours: unauthenticated 100 per IPv4 address or IPv6 /64, Personal 200, Pro, Team and Business unlimited; a multi-arch pull counts once per architecture (*read*) · covers our angle: **partial** — Hub only; GHCR, Quay, ECR, GAR, ACR not covered · fetched 2026-10-12
- **Also good:** [What is a registry?](https://docs.docker.com/get-started/docker-concepts/the-basics/what-is-a-registry/) · Docker docs (*headings only*) · fetched 2026-10-12
- **Our delta:** other registries; the numbers move, so the page should cite this one.

### T02-09 · Authentication — Understand · ✅ written `docs/docker/pages/phase-2-images-and-registries/09-authentication.md`
- **Read this:** [docker login](https://docs.docker.com/reference/cli/docker/login/) · Docker docs · without a credential store, credentials sit in `config.json` base64-encoded, "less secure"; credential helpers (*read*) · covers our angle: full · fetched 2026-10-12

### T02-10 · Multi-arch and the manifest list — Understand · ✅ written `docs/docker/pages/phase-2-images-and-registries/10-multi-arch.md`
- **Read this:** [Multi-platform builds](https://docs.docker.com/build/building/multi-platform/) · Docker docs, modified 2026-04-16 · multi-platform images hold a manifest list pointing to one manifest per platform (*read*) · covers our angle: **partial** — no `exec format error` · fetched 2026-10-12
- **Also good:** [OCI image index (raw)](https://raw.githubusercontent.com/opencontainers/image-spec/main/image-index.md) · github (raw) · the OCI image index: a higher-level manifest pointing to image manifests for one or more platforms (*read* the opening) · fetched 2026-10-12
- **Checked, not chosen:** community posts on `exec format error` from a web search (oneuptime.com, moby issue 44291); not opened.

### T02-11 · save/load vs export/import — Know · ✅ written `docs/docker/pages/phase-2-images-and-registries/11-save-load-export-import.md`
- **Read this:** [docker container export](https://docs.docker.com/reference/cli/docker/container/export/) · Docker docs · exports a container's filesystem as a tar archive; volumes are not included (*read*) · covers our angle: **partial** — no contrast with `save` · fetched 2026-10-12
- **Also good:** [docker image import](https://docs.docker.com/reference/cli/docker/image/import/) · Docker docs · creates a filesystem image from a tarball; `--change` can set CMD and ENTRYPOINT (*read*) · [docker image save](https://docs.docker.com/reference/cli/docker/image/save/) · Docker docs (*headings only*) · fetched 2026-10-12
- **Our delta:** the import page does not say ENTRYPOINT is lost; the page should say the config is not carried unless set.

### T02-12 · Podman's registries.conf — Know · ✅ written `docs/docker/pages/phase-2-images-and-registries/12-podman-registries-conf.md`
- **Read this:** [containers-registries.conf(5) (raw)](https://raw.githubusercontent.com/containers/image/main/docs/containers-registries.conf.5.md) · github (raw) · `unqualified-search-registries` tried in order; `short-name-mode` and aliases (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [podman pull](https://docs.podman.io/en/latest/markdown/podman-pull.1.html) · Podman docs · a short name with no alias makes Podman prompt for the registry (*read*) · fetched 2026-10-12

### T02-13 · Where layers live on disk — Know · ✅ written `docs/docker/pages/phase-2-images-and-registries/13-storage-on-disk.md`
- **Read this:** [Select a storage driver](https://docs.docker.com/engine/storage/drivers/select-storage-driver/) · Docker docs, modified 2026-03-09 · containerd image store is the default for fresh installs of Engine 29.0 and later; upgraded daemons keep the classic drivers such as `overlay2` (*read*) · covers our angle: **partial** — Docker side only · fetched 2026-10-12
- **Also good:** [containers-storage.conf(5) (raw)](https://raw.githubusercontent.com/containers/storage/main/docs/containers-storage.conf.5.md) · github (raw) · the `driver` option for Podman (*read*) · fetched 2026-10-12
- **Our delta:** correct the "`overlay2` for Docker" line: fresh Engine 29 installs use the containerd image store, upgraded ones may still run `overlay2` (see the drift note above).

### T02-14 · Your own registry and a pull-through cache — Know · ✅ written `docs/docker/pages/phase-2-images-and-registries/14-your-own-registry.md`
- **Read this:** [Mirror the Docker Hub library](https://docs.docker.com/docker-hub/image-library/mirror/) · Docker docs · a local mirror avoids each daemon fetching from the internet; run a registry as a pull-through cache (*read*) · covers our angle: **partial** — running a general registry is elsewhere · fetched 2026-10-12
- **Also good:** [About Registry](https://distribution.github.io/distribution/about/) · CNCF Distribution docs · image naming, use cases, requirements (*headings only*) · fetched 2026-10-12

### T02-15 · Image signing — Know · ✅ written `docs/docker/pages/phase-2-images-and-registries/15-image-signing.md`
- **Read this:** [Cosign signing overview](https://docs.sigstore.dev/cosign/signing/overview/) · Sigstore docs · keyless signing ties an OIDC identity to an artifact via a short-lived certificate and a transparency log entry (*read*) · covers our angle: **partial** — does not say what a signature does not prove · fetched 2026-10-12
- **Also good:** [Content trust in Docker](https://docs.docker.com/engine/security/trust/) · Docker docs · Docker Content Trust is "being retired"; the Notary v1 service shuts down on 8 Dec 2026 (*read*) · fetched 2026-10-12
- **Beyond the docs:** [Keyless Container Image Signing with Sigstore Cosign](https://ndthuan.com/keyless-container-image-signing-cosign/) · Thuan Nguyen, Aug 16, 2026 · states plainly that a signature over a digest shows who signed it, not that the image is safe, which the Sigstore page does not stress · fetched 2026-10-13 (*read*)
- **Our delta:** a valid signature shows who signed, not that the image is safe; the page should avoid recommending `docker trust` for new work.
