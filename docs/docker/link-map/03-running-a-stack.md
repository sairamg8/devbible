---
title: "Link map · Docker · Part 3 (phases 6–9)"
sidebar_label: "03 · Running a stack"
sidebar_position: 3
---

# Link map · Docker · Part 3 (phases 6–9)

Covers every topic row of `docs/docker/syllabus/03-running-a-stack.md`: T06-01 to T06-12 phase 6 (storage), T07-01 to T07-14 phase 7 (networking), T08-01 to T08-17 phase 8 (Compose), T09-01 to T09-14 phase 9 (the MERN/PERN stack, in the `-b` file). That is 57 rows; phase 9 (T09-01 to T09-14) sits in the continuation file `03-running-a-stack-b.md`, split to stay under the 300-line cap. Each has a page of ours (✅); where one page folder carries a row, the path is the folder README.
*read* = I read the passage; *headings only* = fetched, headings/size checked. Third-party links carry a date where the page shows one. No `#anchors` are given.

🔴 **Version note (2026-10-12).** The Docker Engine 29 release notes (page modified 2026-10-07) list **29.9.0** as newest; the syllabus README says 29.7.2, so it is behind. That release's notes name BuildKit v0.34.0 and RootlessKit 3.2.0. podman.io shows **Podman 6.1.3** as latest stable; the README says 6.1.0. The Compose release-notes page returns 403 to our fetcher, so the current Compose version is **not confirmed**. `github.com` also returns 403, so READMEs are cited as `raw.githubusercontent.com` copies.

---

## Phase 6 — Storage: volumes, mounts and data

### T06-01 · The container filesystem is disposable — Master · ✅ written `docs/docker/pages/phase-6-storage/01-filesystem-is-disposable.md`
- **Read this:** [Persisting container data](https://docs.docker.com/get-started/docker-concepts/running-containers/persisting-container-data/) · docs.docker.com · each container gets its own file changes, deleted with the container; restarting a database should not mean an empty one (*read*) · covers our angle: **partial** — beginner framing, no layer detail · fetched 2026-10-12
- **Also good:** [Storage drivers](https://docs.docker.com/engine/storage/drivers/) · docs.docker.com · the thin writable "container layer" holds every change and does not persist after the container is deleted (*read*) · fetched 2026-10-12
- **Our delta:** `docker rm` as design, not bug; the `docker stop` versus `docker rm` line is ours.

### T06-02 · Named volumes vs bind mounts vs tmpfs — Master · ✅ written `docs/docker/pages/phase-6-storage/02-volumes-bind-mounts-tmpfs/README.md`
- **Read this:** [Volumes](https://docs.docker.com/engine/storage/volumes/) · docs.docker.com · when to use volumes, lifecycle, named versus anonymous, populate-from-image, read-only, drivers, backup (*read*; modified 2026-07-21) · covers our angle: **partial** — Docker only, no Podman volume notes · fetched 2026-10-12
- **Also good:** [Bind mounts](https://docs.docker.com/engine/storage/bind-mounts/) · docs.docker.com · host path mounted in, files already in the target directory are obscured (*read*) · fetched 2026-10-12
- **Also good:** [tmpfs mounts](https://docs.docker.com/engine/storage/tmpfs/) · docs.docker.com · Linux only, not shareable between containers, counts toward the container memory limit (*read*) · fetched 2026-10-12
- **Our delta:** the one-job-one-mount decision table; Podman's volume behaviour.

### T06-03 · `-v` short syntax vs `--mount` — Understand · ✅ written `docs/docker/pages/phase-6-storage/03-v-vs-mount.md`
- **Read this:** [Bind mounts · Syntax](https://docs.docker.com/engine/storage/bind-mounts/) · docs.docker.com · `--mount` is preferred; `--volume` silently creates a missing host directory, `--mount` errors instead (*read*) · covers our angle: full · fetched 2026-10-12
- **Our delta:** the colon-separated short form field order and the Compose long syntax are ours.

### T06-04 · Bind mounts in development, and the `node_modules` trap — Master · ✅ written `docs/docker/pages/phase-6-storage/04-bind-mounts-in-development/README.md`
- **Read this:** [Bind mounts](https://docs.docker.com/engine/storage/bind-mounts/) · docs.docker.com · mounting over a non-empty directory obscures what the image put there, which "can be surprising" (*read*) · covers our angle: **partial** — states the shadowing rule, never names `node_modules` · fetched 2026-10-12
- **Also good:** [Use Compose Watch](https://docs.docker.com/compose/how-tos/file-watch/) · docs.docker.com · sync instead of bind-mount; ignore `node_modules/` for speed and because compiled artifacts differ by host OS (*read*) · fetched 2026-10-12
- **Also good:** [Sharing local files with containers](https://docs.docker.com/get-started/docker-concepts/running-containers/sharing-local-files/) · docs.docker.com · volume versus bind mount, live edit loop (*read*) · fetched 2026-10-12
- **Our delta:** the anonymous-volume fix for `node_modules`; no page found that names the trap in one place.

### T06-05 · File ownership and UID mismatch — Master · ✅ written `docs/docker/pages/phase-6-storage/05-uid-mismatch/README.md`
- **Read this:** [Understanding rootless Podman's user namespace modes](https://www.redhat.com/en/blog/rootless-podman-user-namespace-modes) · Red Hat blog · table of host UID versus container UID for default, `keep-id`, `auto`, `nomap`; page shows January 25, 2023; metadata published 2023-01-11, modified 2025-11-21 (*read*) · covers our angle: **partial** — no worked file-ownership example on a bind mount · fetched 2026-10-12
- **Also good:** [Podman rootless tutorial (raw)](https://raw.githubusercontent.com/containers/podman/main/docs/tutorials/rootless_tutorial.md) · containers/podman · `/etc/subuid` and `/etc/subgid` ranges, `podman unshare ls -ldn` to see mapped owners, 65534 means unmapped (*read*) · fetched 2026-10-12
- **Our delta:** why a file shows as `165536` on the host; neither page works that arithmetic through for a bind mount.

### T06-06 · Volume lifecycle — Understand · ✅ written `docs/docker/pages/phase-6-storage/06-volume-lifecycle.md`
- **Read this:** [Volumes](https://docs.docker.com/engine/storage/volumes/) · docs.docker.com · create and manage, anonymous volumes get removed with `--rm`, each container makes its own anonymous volume, remove all volumes (*read*) · covers our angle: **partial** — no `inspect` walkthrough · fetched 2026-10-12
- **Also good:** [docker volume prune](https://docs.docker.com/reference/cli/docker/volume/prune/) · docs.docker.com · by default removes only anonymous unused volumes; `--all` also removes named ones (*read*) · fetched 2026-10-12
- **Our delta:** how anonymous volumes pile up silently; Podman's `volume prune` is a sibling page (`docs.podman.io/en/latest/markdown/podman-volume-prune.1.html`, *read*).

### T06-07 · SELinux `:z` and `:Z` — Understand · ✅ written `docs/docker/pages/phase-6-storage/07-selinux-z-and-Z.md`
- **Read this:** [podman-run · Volume mounts](https://docs.podman.io/en/latest/markdown/podman-run.1.html) · docs.podman.io · `:z` marks content shared between containers, `:Z` private to one; both relabel the files (*read* the volume passage; the rest *headings only*, 130k characters) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Bind mounts · Configure the SELinux label](https://docs.docker.com/engine/storage/bind-mounts/) · docs.docker.com · same two options; warns it changes the host path itself, with effects beyond Docker (*read*) · fetched 2026-10-12
- **Also good:** [Dealing with user namespaces and SELinux on rootless containers](https://www.redhat.com/en/blog/user-namespaces-selinux-rootless-containers) · Red Hat blog · `container_t` versus `container_file_t` and why a volume mount breaks it; page shows June 25, 2020; metadata published 2020-06-04, modified 2025-11-20 (*read*) · fetched 2026-10-12
- **Our delta:** never `:Z` on a home directory or shared path; the page gives the shared-versus-private rule only.

### T06-08 · `--read-only` root filesystem plus tmpfs — Know · ✅ written `docs/docker/pages/phase-6-storage/08-read-only-rootfs.md`
- **Read this:** [Docker Security Cheat Sheet · Rule 8](https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html) · OWASP · `--read-only` combined with `--tmpfs` for temporary writes, Compose equivalent; notes it does not make the API read-only (*read*) · covers our angle: **partial** — no list of what breaks first · fetched 2026-10-12
- **Also good:** [podman-run · --read-only](https://docs.podman.io/en/latest/markdown/podman-run.1.html) · docs.podman.io · `--read-only-tmpfs` defaults to true, mounting tmpfs on `/dev`, `/dev/shm`, `/run`, `/tmp`, `/var/tmp` (*read*) · fetched 2026-10-12
- **Our delta:** the Docker/Podman difference (Podman adds those tmpfs mounts for you) and what a Node app breaks first.

### T06-09 · `--userns=keep-id` (Podman) — Understand · ✅ written `docs/docker/pages/phase-6-storage/09-userns-keep-id.md`
- **Read this:** [Understanding rootless Podman's user namespace modes](https://www.redhat.com/en/blog/rootless-podman-user-namespace-modes) · Red Hat blog · `keep-id` maps your user to the same UID inside, shown with `podman top`; page shows January 25, 2023; metadata published 2023-01-11, modified 2025-11-21 (*read*) · covers our angle: **partial** — little on bind-mount ownership · fetched 2026-10-12
- **Also good:** [Podman rootless tutorial (raw)](https://raw.githubusercontent.com/containers/podman/main/docs/tutorials/rootless_tutorial.md) · containers/podman · a container with a non-root `USER` must use `--userns=keep-id` when mounting volumes (*read*) · fetched 2026-10-12
- **Our delta:** `keep-id:uid=...,gid=...` (listed in podman-run, *read*) for images whose user is not your UID.

### T06-10 · Backing up and restoring a volume — Understand · ✅ written `docs/docker/pages/phase-6-storage/10-backup-and-restore.md`
- **Read this:** [Volumes · Back up, restore, or migrate data volumes](https://docs.docker.com/engine/storage/volumes/) · docs.docker.com · throwaway container with `--volumes-from`, a host directory at `/backup`, `tar` the data (*read*) · covers our angle: **partial** — a file copy, not a consistent database backup · fetched 2026-10-12
- **Also good:** [PostgreSQL · SQL Dump](https://www.postgresql.org/docs/current/backup-dump.html) · postgresql.org · `pg_dump` output regenerates the database as of the dump (*read*; the page is the version 18 docs) · fetched 2026-10-12
- **Our delta:** tar of a live Postgres data directory is unsafe; use `pg_dump` through `exec`. The Docker page does not say this.

### T06-11 · Volume drivers and network storage — Know · ✅ written `docs/docker/pages/phase-6-storage/11-volume-drivers.md`
- **Read this:** [Volumes · Share data between machines](https://docs.docker.com/engine/storage/volumes/) · docs.docker.com · NFS, CIFS/Samba and block-storage examples, drivers abstract the storage system from the app (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Docker volume plugins](https://docs.docker.com/engine/extend/plugins_volume/) · docs.docker.com · the `VolumeDriver` API; modified 2026-04-09 (*read* the intro; endpoints *headings only*) · fetched 2026-10-12
- **Our delta:** Podman's volume driver stance and why a database should not sit on NFS.

### T06-12 · Bind-mount performance on macOS and Windows — Know · ✅ written `docs/docker/pages/phase-6-storage/12-bind-mount-performance.md`
- **Read this:** [Change your Docker Desktop settings](https://docs.docker.com/desktop/settings-and-maintenance/settings/) · docs.docker.com · VirtioFS versus gRPC FUSE on Mac; the page claims up to 98% less time on file operations and says VirtioFS is the only option under Docker VMM; modified 2026-09-29 (*read*) · covers our angle: **partial** — Mac only, no Windows WSL 2 guidance and no benchmark we can check · fetched 2026-10-12
- **Also good:** [Use Compose Watch](https://docs.docker.com/compose/how-tos/file-watch/) · docs.docker.com · many small files cause high I/O load on some setups, so sync instead (*read*) · fetched 2026-10-12
- **Our delta:** keep `node_modules` off the mount; the Windows side (project inside the WSL filesystem) is not confirmed by a page we read.

---

## Phase 7 — Networking

### T07-01 · The default bridge vs a user-defined bridge — Master · ✅ written `docs/docker/pages/phase-7-networking/01-default-vs-user-defined-bridge.md`
- **Read this:** [Bridge network driver](https://docs.docker.com/engine/network/drivers/bridge/) · docs.docker.com · user-defined bridges give automatic DNS by name or alias; the default bridge reaches by IP only, `--link` is legacy; modified 2026-02-21 (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Networking overview](https://docs.docker.com/engine/network/) · docs.docker.com · containers with no `--network` join the default bridge; custom networks get their own DNS handling (*read*) · fetched 2026-10-12
- **Our delta:** the "why `docker run` alone cannot resolve names but Compose can" link to Phase 8.

### T07-02 · Service discovery — Master · ✅ written `docs/docker/pages/phase-7-networking/02-service-discovery.md`
- **Read this:** [Networking in Compose](https://docs.docker.com/compose/how-tos/networking/) · docs.docker.com · each service registers its name with an internal DNS server; the default network is enough for most development; modified 2026-08-16 (*read*) · covers our angle: **partial** — the container-port versus published-port rule is shown by example, not stated as a rule · fetched 2026-10-12
- **Also good:** [Bridge network driver](https://docs.docker.com/engine/network/drivers/bridge/) · docs.docker.com · the same name resolution outside Compose (*read*) · fetched 2026-10-12
- **Our delta:** reach `db:5432`, never the published `8001`; no `-p` needed for container-to-container.

### T07-03 · `localhost` inside a container is the container — Master · ✅ written `docs/docker/pages/phase-7-networking/03-localhost-is-the-container.md`
- **Read this:** [Networking in Compose](https://docs.docker.com/compose/how-tos/networking/) · docs.docker.com · each service is reachable by its service name through an internal DNS server, with no IP addresses needed (*read*) · covers our angle: **partial** — the fix (`DB_HOST=postgres`) is shown, the "localhost is the container" rule is not stated · fetched 2026-10-12
- **Also good:** [Docker Desktop networking how-tos](https://docs.docker.com/desktop/features/networking/networking-how-tos/) · docs.docker.com · `host.docker.internal` is the name for the host, which implies `localhost` is not it (*read*) · fetched 2026-10-12
- *Checked, not chosen:* a How-To Geek article (2021) states the rule plainly, but curl could not fetch it with a 200 from here, so it is not linked.
- **Our delta:** the rule itself and the `DB_HOST=postgres` versus `localhost` pair are ours; no fetchable official page states the rule in one line (not confirmed).

### T07-04 · Publishing ports — Understand · ✅ written `docs/docker/pages/phase-7-networking/04-publishing-ports.md`
- **Read this:** [Port publishing and mapping](https://docs.docker.com/engine/network/port-publishing/) · docs.docker.com · `-p` creates firewall rules mapping a host address and port to the container; `-p 8080:80` listens on any host address; modified 2025-09-12 (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Docker with iptables](https://docs.docker.com/engine/network/firewall-iptables/) · docs.docker.com · remote hosts reach a container only through a published port, and rules go in the `DOCKER-USER` chain (*read*; modified 2026-08-12) · fetched 2026-10-12
- **Our delta:** bind to `127.0.0.1:` for dev databases; the iptables page covers the firewall side but not host-firewall tools such as `ufw` (not confirmed).

### T07-05 · Network drivers — Know · ✅ written `docs/docker/pages/phase-7-networking/05-network-drivers.md`
- **Read this:** [Networking overview · Drivers](https://docs.docker.com/engine/network/) · docs.docker.com · the built-in driver table: bridge, host, none, overlay, ipvlan, macvlan (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Macvlan network driver](https://docs.docker.com/engine/network/drivers/macvlan/) · docs.docker.com · gives each container its own MAC address so it appears on the physical network (*read* the intro) · fetched 2026-10-12
- **Also good:** [None network driver](https://docs.docker.com/engine/network/drivers/none/) · docs.docker.com · only the loopback device (*read*) · fetched 2026-10-12
- **Our delta:** the one-sentence-each table; the Docker IPvlan driver page was fetched (200) but *headings only*, so it is not linked.

### T07-06 · `network create` / `ls` / `inspect` / `connect` / `disconnect` — Understand · ✅ written `docs/docker/pages/phase-7-networking/06-network-commands.md`
- **Read this:** [Bridge network driver · Manage a user-defined bridge](https://docs.docker.com/engine/network/drivers/bridge/) · docs.docker.com · create, connect to and disconnect from a user-defined bridge, with IPv6 options (*read*) · covers our angle: **partial** — `inspect` output is not explained field by field · fetched 2026-10-12
- **Also good:** [podman network connect](https://docs.podman.io/en/latest/markdown/podman-network-connect.1.html) · docs.podman.io · the Podman equivalent (*read*) · fetched 2026-10-12
- **Our delta:** reading `inspect` for the container IP and attached networks; attaching a running container to a second network.

### T07-07 · Reaching the host from inside — Understand · ✅ written `docs/docker/pages/phase-7-networking/07-reaching-the-host.md`
- **Read this:** [Docker Desktop networking how-tos](https://docs.docker.com/desktop/features/networking/networking-how-tos/) · docs.docker.com · `host.docker.internal` resolves to the host, with a curl example; modified 2026-09-29 (*read*) · covers our angle: **partial** — Desktop only; the Linux caveat is missing · fetched 2026-10-12
- **Also good:** [podman-run · host-gateway](https://docs.podman.io/en/latest/markdown/podman-run.1.html) · docs.podman.io · Podman adds `host.containers.internal` and `host.docker.internal` to `/etc/hosts`, and pasta uses `--map-guest-addr` (*read*) · fetched 2026-10-12
- **Our delta:** the Linux caveat (`--add-host=host.docker.internal:host-gateway`) comes from web search results only; no fetchable page confirmed it, so it is not confirmed.

### T07-08 · Rootless networking — Understand · ✅ written `docs/docker/pages/phase-7-networking/08-rootless-networking.md`
- **Read this:** [Podman basic networking (raw)](https://raw.githubusercontent.com/containers/podman/main/docs/tutorials/basic_networking.md) · containers/podman · rootless containers default to pasta, rootful to netavark; bridge, host and none setups (*read*) · covers our angle: **partial** — nothing on source IPs in logs or throughput · fetched 2026-10-12
- **Also good:** [Podman 5.3 changes for improved networking with pasta](https://blog.podman.io/2024/10/podman-5-3-changes-for-improved-networking-experience-with-pasta/) · Podman blog · since Podman 5.0 pasta replaces slirp4netns as the default, and works differently (*read*; 2024-10-25) · fetched 2026-10-12
- **Also good:** [Rootless mode troubleshooting](https://docs.docker.com/engine/security/rootless/troubleshoot/) · docs.docker.com · Docker's rootless `-p` does not propagate source IP addresses by default (*read*; modified 2026-09-01) · fetched 2026-10-12
- **Our delta:** the performance difference between pasta and slirp4netns is not confirmed by any page read; the Podman side of source IPs is not confirmed either.

### T07-09 · Privileged ports rootless — Understand · ✅ written `docs/docker/pages/phase-7-networking/09-privileged-ports-rootless.md`
- **Read this:** [Podman rootless.md (raw)](https://raw.githubusercontent.com/containers/podman/main/rootless.md) · containers/podman · ports below 1024 need `CAP_NET_BIND_SERVICE`; set `net.ipv4.ip_unprivileged_port_start` or use a proxy or redirect (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Podman troubleshooting (raw)](https://raw.githubusercontent.com/containers/podman/main/troubleshooting.md) · containers/podman · the exact pasta "Permission denied" error for `-p 80:80`, and the same failure with `--network=host` (*read* that section; the rest *headings only*, 74k characters) · fetched 2026-10-12
- **Also good:** [Rootless mode troubleshooting](https://docs.docker.com/engine/security/rootless/troubleshoot/) · docs.docker.com · Docker's rootless mode, same limit, defers to an "Exposing privileged ports" section (*read*) · fetched 2026-10-12
- **Our delta:** the 8080-and-proxy answer for dev; the troubleshooting page does show the `/etc/sysctl.d` persistence file.

### T07-10 · `--network=host` — Know · ✅ written `docs/docker/pages/phase-7-networking/10-network-host.md`
- **Read this:** [Host network driver](https://docs.docker.com/engine/network/drivers/host/) · docs.docker.com · no isolation, no own IP, a port 80 bind is port 80 on the host; `-p` and `-P` are ignored with a warning; lists performance as a use case; Linux Engine and Desktop 4.34+; modified 2026-08-16 (*read*) · covers our angle: full · fetched 2026-10-12
- **Our delta:** the trade-off argument (what you lose); the page gives no measured numbers.

### T07-11 · Debugging the network — Understand · ✅ written `docs/docker/pages/phase-7-networking/11-debugging-the-network.md`
- **Read this:** [netshoot README (raw)](https://raw.githubusercontent.com/nicolaka/netshoot/master/README.md) · nicolaka/netshoot · `--net container:<name>` shares a target's namespace; `nsenter` route for bridge namespaces needs `--privileged` (*read*) · covers our angle: **partial** — no Podman and no DNS-from-inside method · fetched 2026-10-12
- **Also good:** [podman-unshare](https://docs.podman.io/en/latest/markdown/podman-unshare.1.html) · docs.podman.io · run a command inside the rootless user namespace (*read*) · fetched 2026-10-12
- **Our delta:** `nsenter -t <pid> -n` from the host is community lore: web search found blog posts only, so our page owns it. Checking DNS from inside (`getent hosts`) is ours too.

### T07-12 · Podman's stack: `netavark` and `aardvark-dns` — Understand · ✅ written `docs/docker/pages/phase-7-networking/12-netavark-and-aardvark.md`
- **Read this:** [CNI deprecation and removal from Podman 5.0](https://blog.podman.io/2023/11/cni-deprecation-and-removal-from-podman-5-0/) · Podman blog · CNI replaced by netavark and aardvark-dns, dropped from upstream builds at 5.0; 2023-11-06 (*read*) · covers our angle: **partial** — no error-message map · fetched 2026-10-12
- **Also good:** [netavark README (raw)](https://raw.githubusercontent.com/containers/netavark/main/README.md) · containers/netavark · rootless support, IPv4/IPv6, DNS via aardvark-dns (*read*) · fetched 2026-10-12
- **Our delta:** which error text comes from which component is ours; no page found that maps it.

### T07-13 · Custom subnets, IPv6, and the VPN clash — Know · ✅ written `docs/docker/pages/phase-7-networking/13-subnets-ipv6-and-vpn.md`
- **Read this:** [dockerd reference](https://docs.docker.com/reference/cli/dockerd/) · docs.docker.com · `default-address-pools` in `daemon.json` sets the base and size for new networks; modified 2026-10-02 (*read* the config example; the rest *headings only*) · covers our angle: **partial** — no VPN-clash story · fetched 2026-10-12
- **Also good:** [Use IPv6 networking](https://docs.docker.com/engine/daemon/ipv6/) · docs.docker.com · `docker network create --ipv6 --subnet ...` and the Compose `enable_ipv6` form (*read*; modified 2026-04-13) · fetched 2026-10-12
- **Our delta:** the corporate-VPN subnet clash: no page found that names it, so our page owns the argument.

### T07-14 · Overlay networks and multi-host — When Needed · ✅ written `docs/docker/pages/phase-7-networking/14-overlay-and-multi-host.md`
- **Read this:** [Overlay network driver](https://docs.docker.com/engine/network/drivers/overlay/) · docs.docker.com · distributed network across daemon hosts; hosts must be in a swarm; ports 2377/tcp and 4789/udp open; modified 2026-08-16 (*read*) · covers our angle: full · fetched 2026-10-12
- **Our delta:** why a single-host MERN stack never needs it, and where Kubernetes takes over.

---

## Phase 8 — Compose

### T08-01 · What Compose is — Understand · ✅ written `docs/docker/pages/phase-8-compose/01-what-compose-is.md`
- **Read this:** [How Compose works](https://docs.docker.com/compose/intro/compose-application-model/) · docs.docker.com · a YAML Compose file configures the services, and the Compose CLI creates and starts them; the file follows the Compose Specification; modified 2026-05-28 (*read*) · covers our angle: **partial** — no "reconciles reality to the file" explanation · fetched 2026-10-12
- **Also good:** [History and development of Compose](https://docs.docker.com/compose/intro/history/) · docs.docker.com · supported CLI versions are now Compose v2 and v5, both defined by the Specification; v1 is not listed as supported (*read*; modified 2026-03-12) · fetched 2026-10-12
- **Our delta:** the reconcile model (`up` compares file with running state) and the hyphenated `docker-compose` being dead.

### T08-02 · `compose.yaml` and the Compose Specification — Master · ✅ written `docs/docker/pages/phase-8-compose/02-compose-yaml-and-the-spec/README.md`
- **Read this:** [Version and name top-level elements](https://docs.docker.com/reference/compose-file/version-and-name/) · docs.docker.com · `version` is kept for backward compatibility, informative only, and warns that it is obsolete if used; Compose always validates against the newest schema (*read*; modified 2025-07-09) · covers our angle: **partial** — the `version:` rule only; the `compose.yaml` filename is not argued · fetched 2026-10-12
- **Also good:** [Compose file reference](https://docs.docker.com/reference/compose-file/) · docs.docker.com · the top-level elements; modified 2026-05-28 (*headings only*) · fetched 2026-10-12
- **Also good:** [compose-spec.io](https://compose-spec.io/) · Compose Specification site · the open spec itself (*headings only*, a short landing page) · fetched 2026-10-12
- **Our delta:** `compose.yaml` over `docker-compose.yml` as the preferred filename: the pages read here do not argue it, so our page owns it.

### T08-03 · `up` / `down` / `-d` / `--build` — Master · ✅ written `docs/docker/pages/phase-8-compose/03-up-and-down/README.md`
- **Read this:** [docker compose down](https://docs.docker.com/reference/cli/docker/compose/down/) · docs.docker.com · removes containers, networks defined in the file and the default network; `-v` is the volumes flag; external networks and volumes are never removed (*read*) · covers our angle: **partial** — describes `-v` but does not warn that it deletes the dev database · fetched 2026-10-12
- **Also good:** [docker compose up](https://docs.docker.com/reference/cli/docker/compose/up/) · docs.docker.com · changed services are recreated with mounted volumes preserved; `--no-recreate`, `--force-recreate`, `--scale`, `--wait` (*read*) · fetched 2026-10-12
- **Our delta:** `down -v` deleting the dev database is our headline; the reference lists the flag without warning.

### T08-04 · The `services` block — Master · ✅ written `docs/docker/pages/phase-8-compose/04-services-block/README.md`
- **Read this:** [Services top-level element](https://docs.docker.com/reference/compose-file/services/) · docs.docker.com · every attribute (`image`, `build`, `command`, `environment`, `ports`, `volumes`, `restart`, `healthcheck` and more); modified 2026-08-16 (*headings only*; `container_name`, `healthcheck` and `depends_on` passages *read*) · covers our angle: **partial** — a 72k-character reference, not a teaching path · fetched 2026-10-12
- **Also good:** [Compose Application Model](https://docs.docker.com/compose/intro/compose-application-model/) · docs.docker.com · services as computing components, with networks and volumes beside them (*read*) · fetched 2026-10-12
- **Our delta:** the six-attribute core and an order to learn them in.

### T08-05 · `depends_on` with `condition: service_healthy` — Master · ✅ written `docs/docker/pages/phase-8-compose/05-depends-on.md`
- **Read this:** [Control startup and shutdown order in Compose](https://docs.docker.com/compose/how-tos/startup-order/) · docs.docker.com · Compose waits for "running", not "ready"; the fix is `condition: service_healthy` with a `healthcheck`, plus `service_completed_successfully`; modified 2025-12-03 (*read*) · covers our angle: full · fetched 2026-10-12
- **Our delta:** the app must still retry (Phase 9, T09-04), since a database can restart after boot.

### T08-06 · Healthchecks in Compose — Master · ✅ written `docs/docker/pages/phase-8-compose/06-healthchecks/README.md`
- **Read this:** [Control startup order · Postgres example](https://docs.docker.com/compose/how-tos/startup-order/) · docs.docker.com · `pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}` with `interval: 10s`, `retries: 5`, `start_period: 30s`, `timeout: 10s` on `postgres:18` (*read*) · covers our angle: **partial** — Postgres only, nothing for Mongo or Redis · fetched 2026-10-12
- **Also good:** [Services · healthcheck](https://docs.docker.com/reference/compose-file/services/) · docs.docker.com · `test`, `interval`, `timeout`, `retries`, `start_period`, `start_interval`, `disable: true`; same defaults as the Dockerfile instruction (*read*) · fetched 2026-10-12
- **Our delta:** Mongo and Redis checks: web search returned only blog posts (`redis-cli ping`, a `mongosh` ping), none fetched, so our page must verify them against each image's docs. Not confirmed.

### T08-07 · Networks in Compose — Understand · ✅ written `docs/docker/pages/phase-8-compose/07-networks.md`
- **Read this:** [Networking in Compose](https://docs.docker.com/compose/how-tos/networking/) · docs.docker.com · one default bridge network per app, service-name DNS, custom and external networks, extra hosts, debugging; modified 2026-08-16 (*read*) · covers our angle: full · fetched 2026-10-12
- **Our delta:** segmenting a stack so the database is not on the proxy's network.

### T08-08 · Volumes in Compose — Master · ✅ written `docs/docker/pages/phase-8-compose/08-volumes.md`
- **Read this:** [Volumes top-level element](https://docs.docker.com/reference/compose-file/volumes/) · docs.docker.com · named volume declaration, `external`, `driver`, `name`; modified 2026-05-14 (*read*) · covers our angle: **partial** — the top-level element only, not the per-service mount syntax · fetched 2026-10-12
- **Also good:** [Volumes (Docker Engine)](https://docs.docker.com/engine/storage/volumes/) · docs.docker.com · "Use a volume with Docker Compose" and "Start a service with volumes" sections (*headings only*) · fetched 2026-10-12
- **Our delta:** the anonymous-volume `node_modules` trick (see T06-04).

### T08-09 · The project name — Understand · ✅ written `docs/docker/pages/phase-8-compose/09-project-name.md`
- **Read this:** [Specify a project name](https://docs.docker.com/compose/how-tos/project-name/) · docs.docker.com · defaults to the directory name of the Compose file; several ways to override it, with an order of precedence; modified 2026-02-21 (*read*) · covers our angle: full · fetched 2026-10-12
- **Our delta:** two checkouts of the same directory name colliding.

### T08-10 · Environment and interpolation — Understand · ✅ written `docs/docker/pages/phase-8-compose/10-environment-and-interpolation.md`
- **Read this:** [Environment variables precedence](https://docs.docker.com/compose/how-tos/environment-variables/envvars-precedence/) · docs.docker.com · the ordered list, highest first, starting with `docker compose run -e`; modified 2026-06-22 (*read*) · covers our angle: **partial** — precedence only; the three mechanisms are explained on the next page · fetched 2026-10-12
- **Also good:** [Set environment variables](https://docs.docker.com/compose/how-tos/environment-variables/set-environment-variables/) · docs.docker.com · `environment`, `env_file`, and the project `.env`; modified 2026-05-28 (*read*) · fetched 2026-10-12
- **Also good:** [Interpolation](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/) · docs.docker.com · `${VAR}` forms and defaults; modified 2026-06-19 (*headings only*) · fetched 2026-10-12
- **Our delta:** why `.env` is read for the file's own `${}` while `env_file` feeds the container.

### T08-11 · Override files — Understand · ✅ written `docs/docker/pages/phase-8-compose/11-override-files.md`
- **Read this:** [Merge Compose files](https://docs.docker.com/compose/how-tos/multiple-compose-files/merge/) · docs.docker.com · `compose.override.yaml` read by default; single-value options replaced, multi-value options such as `ports` combined; modified 2026-06-22 (*read*) · covers our angle: full · fetched 2026-10-12
- **Our delta:** `docker compose config` to see the merged result (T08-14).

### T08-12 · `profiles` — Know · ✅ written `docs/docker/pages/phase-8-compose/12-profiles.md`
- **Read this:** [Using profiles with Compose](https://docs.docker.com/compose/how-tos/profiles/) · docs.docker.com · `--profile` or `COMPOSE_PROFILES`, several profiles at once; modified 2026-02-21 (*read*) · covers our angle: full · fetched 2026-10-12

### T08-13 · `develop.watch` — Know · ✅ written `docs/docker/pages/phase-8-compose/13-develop-watch.md`
- **Read this:** [Use Compose Watch](https://docs.docker.com/compose/how-tos/file-watch/) · docs.docker.com · `sync`, `rebuild`, `sync+restart`; the `ignore` list for `node_modules/`; modified 2026-08-19 (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Develop top-level element](https://docs.docker.com/reference/compose-file/develop/) · docs.docker.com · `rebuild` rebuilds the image and recreates the service; `sync+restart` needs Compose 2.23.0 or later; modified 2026-06-18 (*read*) · fetched 2026-10-12
- **Our delta:** file ownership under `sync` is ours.

### T08-14 · Day-to-day commands — Understand · ✅ written `docs/docker/pages/phase-8-compose/14-day-to-day-commands/README.md`
- **Read this:** [docker compose](https://docs.docker.com/reference/cli/docker/compose/) · docs.docker.com · the command index with global flags (*headings only*) · covers our angle: **partial** — an index, not a workflow · fetched 2026-10-12
- **Also good:** [docker compose config](https://docs.docker.com/reference/cli/docker/compose/config/) · docs.docker.com · prints the model after interpolation and merging (*headings only*, option table checked) · fetched 2026-10-12
- **Also good:** [docker compose run](https://docs.docker.com/reference/cli/docker/compose/run/) · docs.docker.com · `--rm` and one-off commands (*headings only*) · fetched 2026-10-12
- **Our delta:** the `logs -f` / `exec` / `run --rm` / `ps` / `top` routine; the Docker reference pages for `compose exec` and `compose logs` were fetched but *headings only*, so they are not linked.

### T08-15 · `podman compose` and `podman-compose` — Understand · ✅ written `docs/docker/pages/phase-8-compose/15-podman-compose.md`
- **Read this:** [podman-compose (man page)](https://docs.podman.io/en/latest/markdown/podman-compose.1.html) · docs.podman.io · `podman compose` is a thin wrapper around an external provider (`docker-compose` or `podman-compose`) pointed at the Podman socket (*read*) · covers our angle: **partial** — which provider is picked first, and divergences, are not on the page · fetched 2026-10-12
- **Also good:** [podman-compose README (raw)](https://raw.githubusercontent.com/containers/podman-compose/main/README.md) · containers/podman-compose · a Python implementation of the Compose Spec on Podman, rootless and daemonless; needs a network backend with DNS (*read*) · fetched 2026-10-12
- **Our delta:** the divergences list (healthcheck conditions, `develop.watch`, pods): not confirmed by any page read.

### T08-16 · `include` and `extends` — Know · ✅ written `docs/docker/pages/phase-8-compose/16-include-and-extends.md`
- **Read this:** [Include](https://docs.docker.com/compose/how-tos/multiple-compose-files/include/) · docs.docker.com · pulls in another Compose file; conflicting resources are an error, customised with an override file; modified 2026-05-28 (*read*) · covers our angle: **partial** — `extends` is a separate page · fetched 2026-10-12
- **Also good:** [Extend](https://docs.docker.com/compose/how-tos/multiple-compose-files/extends/) · docs.docker.com · reuse a service from another file; paths relative to the base file; not supported with `docker stack deploy`; modified 2026-05-28 (*read*) · fetched 2026-10-12
- **Our delta:** when to prefer each, and the merge-versus-include distinction.

### T08-17 · `--scale` and the limits of Compose — Know · ✅ written `docs/docker/pages/phase-8-compose/17-scale-and-limits.md`
- **Read this:** [Services · container_name](https://docs.docker.com/reference/compose-file/services/) · docs.docker.com · Compose does not scale a service beyond one container if `container_name` is set (*read*) · covers our angle: **partial** — no mention of fixed host ports clashing · fetched 2026-10-12
- **Also good:** [docker compose up · --scale](https://docs.docker.com/reference/cli/docker/compose/up/) · docs.docker.com · `--scale` overrides the Compose file's scale setting (*read*) · fetched 2026-10-12
- **Our delta:** the fixed-host-port clash on one host and the stateful-service problem: web search found blog and forum posts only, none fetched, so our page owns them.

