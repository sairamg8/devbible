---
name: devbible-docker-chunk-b
description: Docker & Podman chunk B (phases 6 storage, 7 networking) — per-file progress, decisions and traps. Session 17c9da97, from 2026-08-15.
metadata:
  type: progress
---

**Chunk B of the four-way Docker split** — phases **6 (Storage, 12 topics)** and
**7 (Networking, 14 topics)**, 26 topics. 🏁 **BOTH PHASES COMPLETE 2026-08-15** — started by session `17c9da97`, finished by `d0c46f84`. The split rules, the cursor table and the shared-file rules live in
[[devbible-docker-split-4way]]; house style and the phase 0–3 background in
[[devbible-docker-podman-progress]]. This file is the per-file detail.

## Where it stands

| Phase | Written | Next |
|---|---|---|
| **6 · Storage** | 🏁 **12 / 12 — COMPLETE** (2026-08-15) | — |
| **7 · Networking** | 🏁 **14 / 14 — COMPLETE** (2026-08-15) | — |

🔴 **Chunk B taken over by session `d0c46f84` on 2026-08-15** (was `17c9da97`) — both
board rows re-stamped. ⚠️ `git commit` in this checkout now needs explicit identity:
`GIT_AUTHOR_NAME=sairamgudiputi GIT_AUTHOR_EMAIL=sairamgudiputi8@gmail.com` (plus the
`GIT_COMMITTER_*` pair) — the global config is not visible from this session's `HOME`.

### Phase 6 files so far

| Topic | Files | Lines | Notes |
|---|---|---|---|
| 01 · The container filesystem is disposable | `01-filesystem-is-disposable.md` | 272 | single file |
| 02 · Volumes, bind mounts and tmpfs | `02-volumes-bind-mounts-tmpfs/` — README + `01-named-volumes.md` + `02-bind-mounts-and-tmpfs.md` | 44 + 208 + 249 = **501** | **chunked** — the single file came in at 305, over the cap, and was split on the volumes/binds boundary |
| 03 · `-v` short syntax vs `--mount` | `03-v-vs-mount.md` | 241 | single file |
| 04 · Bind mounts in development | `04-bind-mounts-in-development/` — README + `01-the-development-loop.md` + `02-the-node-modules-trap.md` + `03-compose-and-watch.md` | 45 + 184 + 248 + 248 = **725** | **chunked** — the loop, the trap and its four fixes, then Compose `develop.watch` |
| 05 · File ownership and UID mismatch | `05-uid-mismatch/` — README + `01-a-uid-is-just-a-number.md` + `02-rootless-and-the-shift.md` + `03-the-fixes.md` | 49 + 188 + 214 + 272 = **723** | **chunked** — the model, the rootless shift with the mapping formula, then seven fixes ordered by how often each is right |
| 06 · Volume lifecycle | `06-volume-lifecycle.md` | 263 | single file — the five commands, `ls` filters, labels, and the `down` vs `down -v` table |
| 07 · SELinux `:z` and `:Z` | `07-selinux-z-and-Z.md` | 241 | single file — recognising SELinux vs a UID mismatch, the two suffixes, and the permanent `semanage` fix |
| 08 · `--read-only` plus `tmpfs` | `08-read-only-rootfs.md` | 221 | single file — what breaks first, the `docker diff` migration plan, and the Podman `--read-only-tmpfs` divergence |
| 09 · `--userns=keep-id` | `09-userns-keep-id.md` | 201 | single file — the `--userns` mode table, `uid=`/`gid=`, and the four honest costs |
| 10 · Backing up and restoring a volume | `10-backup-and-restore.md` | 241 | single file — the documented tar idiom, `podman volume export/import`, and why it is not a database backup |
| 11 · Volume drivers and network storage | `11-volume-drivers.md` | 231 | single file — the `local` driver is `mount(8)`; where it stops; the honest NFS-and-databases warning |
| 12 · Bind-mount performance on macOS and Windows | `12-bind-mount-performance.md` | 208 | single file — the VM boundary, VirtioFS, WSL 2 file location, and `:cached`/`:delegated` as fossils |

🏁 **PHASE 6 IS COMPLETE — 12/12, 20 files, 4,270 lines, 0 over the 300-line cap.**
**97 internal links resolved against the filesystem — link-checked, NOT built.** No dev
server and no build were run at any point (registry row says so).
⚠️ A whole-`docs/docker` link check showed **23 missing targets, all in phases 8 and 10**
— chunks C and D's forward links to their own unwritten pages. **Not mine, left alone.**

Plus `phase-6-storage/_category_.json` (`position: 7`) and
`phase-6-storage/README.md` (the 12-row index).

### Phase 7 files so far

| Topic | Files | Lines | Notes |
|---|---|---|---|
| — | `phase-7-networking/_category_.json` (`position: 8`) + `README.md` | 81 | 14-row index; unwritten rows are bold plain text + *(not written yet)* |
| 01 · Default vs user-defined bridge | `01-default-vs-user-defined-bridge.md` | 225 | the four documented differences, why Compose "just works", ⚠️ Podman's default network DOES resolve names |
| 02 · Service discovery | `02-service-discovery.md` | 250 | `127.0.0.11`, **the container's port not the published one**, aliases, and the five failure causes in likelihood order |
| 03 · `localhost` is the container | `03-localhost-is-the-container.md` | 208 | the two mirror-image symptoms (config names localhost / server BINDS localhost), the three-way address table, `ss -tlnp` as the one-line diagnosis — **closes the Master tier of phase 7** |
| 04 · Publishing ports | `04-publishing-ports.md` | 233 | the syntax read right-to-left, *insecure by default*, `127.0.0.1:` as the habit, and **publishing bypasses `ufw`** |
| 05 · Network drivers (Know) | `05-network-drivers.md` | 254 | the six-driver map with Docker's own one-liners, then **the spine of the page: `host` and `none` are MODES, not drivers you can `network create`** (`none`'s driver is listed as `null`); host discards publishing flags; macvlan's three warnings; Podman has no `overlay` because it has no daemon |
| 06 · `network create` and friends (Understand) | `06-network-commands.md` | 278 | the five commands; **`--internal` is the flag worth remembering** (no route out, enforced by absence of a route); `connect` works on a RUNNING container and a container may be on several networks; the inspect-first triage order that IS the phase gate; 🔴 **`podman network rm -f` stops and REMOVES the containers using the network** where Docker's `rm` simply refuses |
| 07 · Reaching the host from inside (Understand) | `07-reaching-the-host.md` | 231 | `--add-host … :host-gateway` and *"It's conventional to use `host.docker.internal`"* — **Desktop resolves it automatically, Docker ENGINE does not**, which is the Linux caveat; daemon key `host-gateway-ip`; 🔴 **the half everyone forgets — the HOST service bound to `127.0.0.1` is unreachable even once the name resolves** (mirror image of page 03); Podman adds BOTH `host.containers.internal` and `host.docker.internal` and *"silently skip[s]"* them when it cannot determine the IP or under `podman machine` (gvproxy resolves instead) |
| 08 · Rootless networking (Understand) | `08-rootless-networking.md` | 217 | the thesis: **an unprivileged user cannot touch the host's network stack, so traffic goes through a USER-MODE TCP/IP stack** — everything else follows. 🔴 **Source IP does NOT propagate by default with `docker run -p`**, and `userland-proxy` is *incompatible* with RootlessKit propagation (so `"userland-proxy": false` too); Podman's pasta preserves it BUT rootless bridge networks forward via `rootlessport` unless switched. `inspect`'s `IPAddress` is namespaced inside RootlessKit and unreachable from the host; `ping` fails when `ping_group_range` is `1 0`; user-mode stacks are *"generally slower than the one in kernel mode"* |
| 09 · Privileged ports rootless (Understand) | `09-privileged-ports-rootless.md` | 206 | 🔴 **the refusal is on the HOST port** — pasta's error literally says *"Listen failed for HOST TCP port \*/80"* — so `-p 8080:80` is untouched and the image needs no change; the four answers ranked (high port + proxy · `ip_unprivileged_port_start`, set as HIGH as possible, Podman's guide uses **80** not 0 · `CAP_NET_BIND_SERVICE` on `rootlesskit`, lost on upgrade · rootful); ⚠️ `sudo podman` is a DIFFERENT engine with its own storage, not a permissions fix |
| 10 · `--network=host` (Know) | `10-network-host.md` | 183 | the DECISION page (05 is the map): what you give up — publishing discarded, DNS gone, host port collisions back — and 🔴 Podman's own warning, *"full access to abstract Unix domain sockets and to TCP/UDP sockets bound to localhost … may be considered a security vulnerability"*; the five cases where it is right (big/dynamic port ranges, broadcast/multicast discovery, monitoring agents, measured throughput, appliance hosts); ⚠️ host mode does NOT let a rootless container bind 80 — that is a process privilege, not a namespace |
| 11 · Debugging the network (Understand) | `11-debugging-the-network.md` | 218 | **the phase-gate page** — the five-step ladder (on the same network? → resolves inside? → TCP opens? → what is it BOUND to? → only then look from the host); 🔴 **`--network container:<target>` + a tool image (netshoot) is the answer for a distroless image with no shell** — same namespace, so the answers are authoritative, and the target is untouched; `nsenter -t <pid> -n` as the rootful alternative; **`podman unshare --rootless-netns`** joins *"the rootless network namespace used for netavark networking"* so a rootless container's IP is reachable at all; ⚠️ never `apt install curl` into the thing under investigation, and `ping` is not a network test |
| 12 · netavark and aardvark-dns (Understand) | `12-netavark-and-aardvark.md` | 203 | the split — **netavark = interfaces, NAT, port forwarding, firewall (firewalld/nftables drivers); aardvark-dns = container `A`/`AAAA` names only**, launched BY netavark; the which-error-comes-from-where table; 🔴 **the CNI trap** — `network_backend` empty auto-detects and *"If there are already containers/images or CNI networks preset it will choose CNI"*, so an upgraded host silently is not on netavark; the config dir is the tell (`/etc/cni/net.d` vs `/etc/containers/networks`); `default_subnet` **10.88.0.0/16**, `dns_bind_port` **53** |
| 13 · Custom subnets, IPv6 and the VPN clash (Know) | `13-subnets-ipv6-and-vpn.md` | 206 | the built-in `default-address-pools` quoted in full (**`172.17.0.0/16` first, and `192.168.0.0/16` IS in the list**), Podman's `default_subnet` `10.88.0.0/16`; 🔴 **`network create` checks only DOCKER'S OWN networks, so a VPN-route clash succeeds silently** — the team-wide fix is `default-address-pools` in `daemon.json`, per-network `--subnet` is a stopgap; pool exhaustion on CI = coarse `size`, not a leak; **IPv6 is OFF by default and Linux-only**, `ip6tables` on by default, no-subnet means ULA, and `2001:db8::/64` is documentation-only |
| 14 · Overlay networks and multi-host (When Needed) | `14-overlay-and-multi-host.md` | 146 | requires Swarm — *"even when connecting standalone containers"*; the three port groups (**2377/tcp control · 7946 tcp+udp node · 4789/udp data** — a formed cluster proves only 2377); `ingress` + `docker_gwbridge` are created FOR you; `--attachable` is what lets a plain container join; encryption is OPT-IN (`--opt encrypted`, unsupported for Windows containers); the honest recommendation — Kubernetes, or a host-level VPN/mesh under ordinary bridges; **Podman has no overlay because it has no daemon to connect** |

🏁 **PHASE 7 IS COMPLETE — 14/14 at every tier. 15 files, 3,131 lines, 0 over the
300-line cap, 0 broken internal links (link-checked against the filesystem, NOT built).**
🏁 **CHUNK B IS FINISHED — 26 of 26 topics.** Nobody holds phases 6 or 7 now.
Tier spread in phase 7: Master 3 (01–03) · Understand 8 · Know 2 · When Needed 1.

🔴 **CORRECTION MADE 2026-08-15 — do not re-introduce it.** Pages 01 and 02 asserted
that **Podman's DEFAULT network resolves container names**. It does not. Upstream
(podman/docs/tutorials/basic_networking.md): *"The default network `podman` with netavark
is memory-only. It does not support dns resolution because of backwards compatibility with
Docker."* Confirmed separately by the default network's `dns_enabled: false`. The right
statement: **both engines' default networks have no name resolution; a network you CREATE
has DNS on by default under Podman** (hence `podman network create --disable-dns`). Fixed
in a table row, a warning, a gotcha and two interview answers across pages 01 and 02, and
carried correctly into page 12. ⚠️ Also fixed two **stale `(not written yet)` footers**
(page 01 → 02, page 05 → 08) — when a page lands, its predecessor's `Next →` must be
re-pointed, which is easy to miss because nothing warns.

🔴 **Cadence tightened to PER FILE from here (user instruction, ~90% usage, 2026-08-15).**

## Decisions made, so they are not re-argued

- **The phase README lists all 12 rows from the start**, with unwritten ones as
  **bold plain text + *(not written yet)*** rather than links, and each row is
  converted to a link as its page lands. Reason: per-file commits mean `main`
  must never carry a broken link for another session's build.
- **The spine of phase 6 is one contrast** — *an empty volume is pre-populated
  from the image; a bind mount obscures it.* Topic 02 states it as a table, and
  topics 04 (`node_modules`), 06 ("my volume isn't empty") and 08 all refer back
  to it rather than re-deriving it.
- **Ownership is deferred to page 05 and Podman's `keep-id` to page 09.** Pages
  01–04 flag UID mismatch inline and link forward; they do not explain subuid
  ranges.
- **`Prev phase:` in the phase 6 README points at Phase 3**, because phases 4
  and 5 belong to chunk A and do not exist yet. Repoint it when chunk A lands.

## Claims worth reusing (validated, with the source)

- **Pre-populate vs obscure** — volumes doc: *"if you mount an empty volume into a
  directory in the container in which files or directories exist, these files or
  directories are propagated (copied) into the volume by default"*; bind-mounts doc:
  *"the directory's existing contents are obscured by the bind mount"*.
- **`-v` creates a missing bind source, `--mount` errors** — bind-mounts doc, and
  *"It's always created as a directory"*, which is why a mistyped config-file path
  produces a directory where a file was expected. ⚠️ **Podman's `podman run` page does
  not state the create-on-missing behaviour either way** — the pages say so rather than
  guessing (rule 8).
- **`-v` type inference**: a source containing `/` is a bind mount, otherwise a named
  volume — which is why a typo'd volume name silently becomes a new empty volume.
- **`ps -s`** — *"the amount of data (on disk) that is used for the writable layer"* vs
  *"virtual size … read-only image data … and the writable layer"*. **`diff`** — `A`
  added, `C` changed, `D` deleted.
- **`tmpfs`** — Linux only, not shareable, default max **50% of host RAM**, default mode
  **1777**.
- **Podman-only `-v` suffixes**: `U`/`chown`, `idmap`, `O`, `copy`/`nocopy`. Podman
  `--mount` types: *"artifact, bind, devpts, glob, image, ramfs, tmpfs and volume"*;
  source *"Mandatory for artifact, bind, glob, and image. Optional for volume"*.
- **`develop.watch`** — actions `sync`, `rebuild`, `sync+restart`; fields `path`,
  `target`, `ignore`, `initial_sync`; run with `docker compose watch` or `up --watch`;
  the target must be writable by the container's user (`COPY --chown`).
- **`podman compose`** — *"a thin wrapper around an external compose provider such as
  docker-compose or podman-compose"*, chosen by `compose_providers` in `containers.conf`
  or `PODMAN_COMPOSE_PROVIDER`, **docker-compose winning when both are installed**. So
  `watch` works under Podman exactly when the provider is docker-compose.
- **Rootless UID mapping** — `podman unshare` doc: *"the invoking user's UID and primary
  GID appear to be UID 0 and GID 0"*, and subuid/subgid ranges *"mapped in as themselves
  with the help of the newuidmap(1) and newgidmap(1) helpers"*. Formula used on the page:
  container `0` → your host UID; container `n ≥ 1` → `subuid_start + (n − 1)`. The manual's
  own example maps container 1–65536 to host 10000–75535, so the page presents 165536 as
  *an example* range start, not a fact about every machine.
- **Podman troubleshooting** gives the three fixes verbatim: `podman unshare chown 0:0 …`,
  `podman unshare less …`, and `podman run --userns keep-id:uid=$uid,gid=$gid`. Also the
  SELinux entries: `:z`/`:Z`, `--security-opt label=disable`,
  `sudo chcon -R system_u:object_r:container_file_t:s0 …`, and `-v /path:/dir:O` — **reuse
  these for page 07**, they are already fetched.
- **`:U` / `chown` suffix** — *"Recursively change the owner and group of the source volume
  based on the UID and GID of the container"* (podman-run).
- **`volume prune`** — *"By default, it only removes anonymous volumes"*; *"Unused local
  volumes are those which are not referenced by any containers"*; `--all` extends it to
  named ones (API 1.42+); **`--filter` supports `label` only** (no `until`). `volume ls`
  filters: `dangling`, `driver`, `label`, `name`; *"The dangling filter matches on all
  volumes not referenced by any containers"*.
- **SELinux** — Docker bind-mounts doc: `z` = *"the bind mount content is shared among
  multiple containers"*, `Z` = *"the bind mount content is private and unshared"*; the
  warning that bind-mounting `/home` or `/usr` with `Z` *"renders your host machine
  inoperable"*; *"It is not possible to modify the SELinux label using the `--mount`
  flag"*; and for Swarm services *"SELinux labels (`:Z` and `:z`), as well as `:ro` are
  ignored"*. **Podman's `--mount` DOES support it** — `relabel=shared` / `relabel=private`.
- **`--read-only-tmpfs` defaults to TRUE on Podman** and, with `--read-only`, mounts a
  tmpfs on **`/dev`, `/dev/shm`, `/run`, `/tmp`, `/var/tmp`**; Docker mounts nothing. With
  `=false`, *"the directories are exposed from the underlying image, meaning they are
  read-only by default"*. 🔴 **This is a real portability trap both ways** — the pages tell
  readers to declare the tmpfs mounts explicitly.
- **`--userns` modes** (podman-run): `keep-id` — *"The user is mapped to a non-root UID and
  GID on the host. The rest of the UIDs and GIDs range from 0 to the maximum UID and GID
  values used by the kernel (typically 65536)"*, and it is *"only supported in rootless
  mode"*; plus `auto` (with `size`, `uidmapping`, `gidmapping`), `nomap` (rootless only),
  `host`/`""` — *"Use the host's user namespace inside the container"*, `container:id`,
  `ns:namespace`.
- **Bridge networking** — docs.docker.com/engine/network/drivers/bridge: *"User-defined
  bridges provide automatic DNS resolution between containers"*; *"provide better
  isolation"*; *"can be attached and detached from user-defined networks on the fly"*;
  *"Each user-defined network creates a configurable bridge"*; and 🔴 *"The default
  `bridge` network is considered a legacy detail of Docker and is not recommended for
  production use."*
- **DNS** — *"The embedded DNS server address is `127.0.0.11`"*, which *"forwards external
  DNS lookups to the DNS servers configured on the host"*; default-bridge containers
  instead *"receive a copy of"* the host `/etc/resolv.conf`. Flags `--dns`, `--dns-search`,
  `--dns-opt`; `--alias` / `--network-alias` on `network connect`. On a user-defined
  network *"containers can communicate with each other using container IP addresses or
  container names"* — **no publishing needed**.
- **Port publishing** — *"Publishing container ports is insecure by default. Meaning, when
  you publish a container's ports it becomes available not only to the Docker host, but to
  the outside world as well."* · *"By default, when a container's ports are mapped without
  any specific host address, the Docker daemon publishes ports to all host addresses
  (`0.0.0.0` and `[::]`)."* · *"If you include the localhost IP address (`127.0.0.1`, or
  `::1`) with the publish flag, only the Docker host can access the published container
  port."* ⚠️ **Before engine 28.0.0** such ports *"remained accessible to hosts on the same
  L2 network segment"*.
- **Firewalls** — *"Docker routes container traffic in the `nat` table, which means that
  packets are diverted before it reaches the `INPUT` and `OUTPUT` chains that ufw uses."*
  So `ufw deny` does not protect a published port; the seams are `127.0.0.1:` publishing,
  the `DOCKER-USER` chain, or upstream filtering.

## Rules being followed here

- **No sandbox, no console blocks.** Every claim is validated against
  docs.docker.com / docs.podman.io and the source is named on the `> Verified:`
  line, which ends "**No sandbox** — no console output on this page."
  Direct quotes from the docs are used where the wording is load-bearing
  (pre-population, obscuring, `tmpfs` defaults, the `ps -s` size definitions).
- **300-line cap is a file-size rule.** Topic 02 was written in full first and
  then split; nothing was trimmed to fit.
- **Per-file cadence**: page → four boards → commit → memory.
- **Never `git add -A`** — four Docker chunks plus other languages share the
  checkout. `docs/docker/pages/README.md`'s **Total** cell is incremented by all
  four chunks, so it is re-read immediately before each edit (it moved 63 → 69
  during the first two topics).
- **No build, no dev server.** Registered in
  [[session-build-devserver-registry]] as running neither; verification is
  link-checking against the filesystem. Say so plainly in any report.

## Traps found

- **A "not written yet" note next to a real link still breaks the build.** Caught
  in the topic-02 README, where a *(not written yet)* marker had been left on a
  live `../04-…md` link. If the marker is there, the link must go.
- The phase-6 `_category_.json` position is **7** (phase 3 is 4, so phase N is
  N+1).

Related: [[devbible-docker-split-4way]] · [[devbible-docker-podman-progress]] ·
[[session-build-devserver-registry]]
