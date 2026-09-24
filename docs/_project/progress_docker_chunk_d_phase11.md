---
name: devbible-docker-chunk-d-phase11
description: Docker chunk D · phase 11 Podman in depth — fixed filenames, per-topic record, and the verified Podman/systemd quotes worth not re-fetching.
metadata:
  type: progress
---

🔴 **Evidence and per-topic record for phase 11 only.** The live cursor for chunk D is in the
parent [[devbible-docker-split-4way]] — open that first. This file is what you read once you
are actually writing in phase 11. Same relationship chunk C has with
[[devbible-docker-chunk-c-findings]].

## State

🏁 **PHASE 11 IS COMPLETE — 16 of 16 at every tier** (Master 4/4 · Understand 8/8 · Know 4/4),
closed 2026-08-16 by session `8e7b6e12` (took the claim from `75a196a7`). Working on **`main`**,
no worktree.

| | |
|---|---|
| Files / lines | **25 files, 4,650 lines**, largest **256** — **0 over the 300-line cap** |
| Console blocks | **0** — the no-sandbox rule held for the whole phase |
| Badges | every page carries a tier badge and `> Verified:`; ⚠️ **the phase README correctly has neither** (it carries the phase-level Target blockquote, exactly as phase 10's does) |
| Links | **1,961 internal links under `docs/docker` all resolve** against the filesystem — 🔴 **link-checked, NOT built** (the build/dev-server registry row was never claimed) |
| Placeholders | 🔴 **every stale `(not written yet)` inside phases 10 AND 11 was repointed at the close** — the only ones left are genuine forward references to **phase 12**, which does not exist yet |

🔴 **RESUME AT phase 12 · 01 · Tag strategy.** Chunk D overall: **32 of 44 done, 12 left** —
phase 12 is all that remains, and closing it closes chunk D **and the whole Docker track**.
⚠️ **The phase-12 directory does not exist. Check the slug declared in `src/data/progress.js`
(`phase-12-delivery-and-ci`) before creating it** — phase 11 hit exactly that trap.

⚠️ **The directory is `docs/docker/pages/phase-11-podman-in-depth/`, NOT
`phase-11-podman-depth`.** `src/data/progress.js` already declared the slug
`phase-11-podman-in-depth` before the phase existed; the first attempt used the shorter name
and had to be renamed. **Check the declared slug in `progress.js` before creating any phase
directory** — the same trap is waiting for phase 12 (`phase-12-delivery-and-ci`).

## Fixed filenames — do not rename

`01-daemonless/`, `02-rootless-by-default/`, `03-pods.md`, `04-quadlet/`,
`05-where-podman-bites/`, `06-podman-unshare.md`, `07-userns-modes.md`, `08-pod-commands.md`,
`09-quadlet-vs-generate-systemd.md`, `10-auto-update.md`, `11-kube-play.md`,
`12-buildah-and-skopeo.md`, `13-docker-cli-compatibility.md`,
`14-podman-6-breaking-changes.md`, `15-podman-machine.md`, `16-podman-desktop.md`.

Directories are the four **Master** rows (01, 02, 04, 05); the rest are single pages —
**8 Understand, 4 Know**. Phase 10's shapes are the guide: Master 516–570 across three files,
Understand 194–276 single, Know 194–230. **Match the tier, not the biggest page.**

## Written

| Topic | Files | Lines | Sources named on the page |
|---|---|---|---|
| ✅ **01 · Daemonless** (Master) | `01-daemonless/` — README + 2 chunks | 73 / 246 / 245 | `podman(1)`, `podman-run(1)`, `podman-system-service(1)`, `podman-logs(1)`, `loginctl(1)`, `logind.conf(5)`, `systemd.service(5)`, containers/conmon |
| ✅ **02 · Rootless by default** (Master) | `02-rootless-by-default/` — README + 2 chunks | 74 / 220 / 207 | `user_namespaces(7)`, `subuid(5)`, `podman-unshare(1)`, `podman(1)`, `podman-run(1)`, [Shortcomings of Rootless Podman](https://github.com/containers/podman/blob/main/rootless.md) |
| ✅ **03 · Pods** (Understand) | `03-pods.md` — **single page** | 206 | `podman-pod(1)`, `podman-pod-create(1)`, `podman-run(1)` |
| ✅ **04 · Quadlet** (Master) | `04-quadlet/` — README + 2 chunks | 74 / 203 / 256 | `podman-systemd.unit(5)`, `systemd.service(5)`, `podman-run(1)`, `loginctl(1)` |
| ✅ **05 · Where Podman will bite you** (Master) | `05-where-podman-bites/` — README + 2 chunks | 116 / 232 / 208 | `podman-run(1)`, `podman-healthcheck-run(1)`, `podman-system-service(1)`, `containers-registries.conf(5)`, `loginctl(1)`, `logind.conf(5)`, Shortcomings of Rootless Podman |
| ✅ **06 · `podman unshare`** (Understand) | `06-podman-unshare.md` — **single page** | 235 | `podman-unshare(1)`, `podman-mount(1)`, `user_namespaces(7)`, `chown(2)`, Docker rootless mode |
| ✅ **07 · `--userns` modes** (Understand) | `07-userns-modes.md` — **single page** | 252 | `podman-run(1) --userns` + its source `options/userns.container.md`, `user_namespaces(7)`, Docker userns-remap, Docker rootless mode |
| ✅ **08 · Pod commands** (Understand) | `08-pod-commands.md` — **single page** | 220 | `podman-pod-create(1)`, `podman-pod-ps(1)`, `podman-pod-rm(1)`, `podman-pod-stats(1)`, `podman-ps(1)`, `podman-run(1)` |
| ✅ **09 · Quadlet vs `generate systemd`** (Understand) | `09-quadlet-vs-generate-systemd.md` — **single page** | 210 | `podman-generate-systemd(1)`, `podman-systemd.unit(5)`, `systemd.service(5)`, Podman v4.4.0 release notes |
| ✅ **10 · `podman auto-update`** (Know) | `10-auto-update.md` — **single page** | 195 | `podman-auto-update(1)`, `podman-systemd.unit(5)`, `podman-run(1)` |
| ✅ **11 · `kube play` / `generate kube`** (Understand) | `11-kube-play.md` — **single page** | 196 | `podman-kube(1)`, `podman-kube-play(1)`, `podman-kube-generate(1)`, `podman-systemd.unit(5)` |
| ✅ **12 · Buildah and Skopeo** (Know) | `12-buildah-and-skopeo.md` — **single page** | 205 | `skopeo(1)`, Skopeo README, buildah.io, `podman(1)` |
| ✅ **13 · Docker CLI compatibility** (Understand) | `13-docker-cli-compatibility.md` — **single page** | 202 | `podman-system-service(1)`, `podman(1)`, the `podman-docker` wrapper `docker/docker.in` |
| ✅ **14 · Podman 6 breaking changes** (Understand) | `14-podman-6-breaking-changes.md` — **single page** | 199 | Podman **v6.0.0 release notes**, `podman-run(1)`, `podman-volume-prune(1)` |
| ✅ **15 · `podman machine`** (Know) | `15-podman-machine.md` — **single page** | 196 | `podman-machine(1)`, `podman-machine-init(1)`, `podman-unshare(1)`, `podman(1)` |
| ✅ **16 · Podman Desktop** (Know) | `16-podman-desktop.md` — **single page** | 195 | podman-desktop.io + its intro, `podman-machine(1)`, **Docker Desktop license agreement** |

**The split boundaries, both taken from the syllabus row itself** — the cleanest kind.
Topic 01: *what runs instead of a daemon* (ownership, `conmon`, state on disk and therefore
per user, the opt-in API socket) then *what that changes* — restart, logs, `systemctl`.
Topic 02: *the mechanism and the arithmetic* then *what it costs*.

🔴 **Topic 02 had a real duplication risk and the resolution is the pattern to reuse.**
`phase-6-storage/05-uid-mismatch/` is a 723-line Master topic whose chunk 02 is already
"user namespaces, `/etc/subuid`, the mapping formula" and whose chunk 03 ranks the fixes.
Phase 11 · 02 therefore takes the **engine-level** argument — the kernel rule, the map as
three numbers, the delegation, and the shortcomings list — and **links** to phase 6 for the
bind-mount fixes instead of repeating them. Same move phase 9 makes against phase 8.

## 🔴 Verified quotes from topic 01 — do not re-fetch

**`podman(1)`** — "Podman (Pod Manager) is a fully featured container engine that is a simple
daemonless tool"; fork-exec rather than a daemon. Rootless: "a user namespace is automatically
created for the user, defined in `/etc/subuid` and `/etc/subgid`". Storage paths — root
`/var/lib/containers/storage` + `/run/containers/storage`; rootless
`$HOME/.local/share/containers/storage`, runtime `$XDG_RUNTIME_DIR/libpod/tmp`, config
`$HOME/.config/containers`. "When Podman runs in rootless mode, the file
`$HOME/.config/containers/storage.conf` is used instead of the system defaults."
`--remote`: "when true, access to the Podman service is remote. Defaults to false."

**`podman-system-service(1)`** — "creates a listening service that answers API calls for
Podman"; sockets `unix:///run/podman/podman.sock` (root) and
`unix://$XDG_RUNTIME_DIR/podman/podman.sock` (rootless); `--time` default **5 seconds**,
"a value of `0` means no timeout"; the API "is split into two parts: a compatibility layer
offering support for the **Docker v1.40 API**, and a Podman-native Libpod layer".

**`podman-run(1)`** —
🔴 **`--log-driver` default is `journald`**, options "k8s-file, journald, none, passthrough
and passthrough-tty, with **json-file aliased to k8s-file** for scripting compatibility" —
so a ported Docker script is *accepted* and does something else. ⚠️ The run reference names
`passthrough`/`passthrough-tty` **without describing their behaviour**, so the page does not
claim what they do.
`--restart`: "Restart policy does not take effect if a container is stopped via the
**podman kill** or **podman stop** commands." Policies `no` / `never` (synonym) /
`on-failure[:max_retries]` / `always` ("retrying indefinitely") / `unless-stopped`.
🔴 **The reboot distinction is real and Docker has no equivalent of it:** `unless-stopped`
containers "will be restarted by podman-restart.service only if they were not explicitly
stopped by the user before the reboot. This differs from **always**, which restarts containers
after a system reboot regardless of whether they were user-stopped". "Podman provides a systemd
unit file, **podman-restart.service**, which restarts containers after a system reboot", and
the docs recommend systemd's own restart functionality when running under systemd.
`--cgroups` "determines whether the container creates cgroups. Default is **enabled**".
`--conmon-pidfile`: "As conmon runs in a separate process than Podman, this is necessary when
using systemd to restart Podman containers." `--sdnotify` default **`container`**.
`--detach` default `false`.

**`podman-logs(1)`** — "batch-retrieves whatever logs are present for one or more containers
at the time of execution". ⚠️ **It says nothing about which drivers it can read from** — the
page therefore does not make Docker's "reads natively only from local/json-file/journald"
claim for Podman.

**`logind.conf(5)`** — `KillUserProcesses=`: "Configures whether the processes of a user
should be killed when the user logs out. If true, the scope unit corresponding to the session
and all processes inside that scope will be terminated… **Defaults to `yes`**, but see the
options KillOnlyUsers= and KillExcludeUsers=". Also names "the user manager unit
`user@.service`" as running independently of login sessions. ⚠️ **Distributions override this
in `/etc/systemd/logind.conf`**, so the page tells the reader to check their host rather than
asserting the behaviour — do not tighten that into a flat claim.

**`loginctl(1)`** — `enable-linger`: "If enabled for a specific user, a user manager is
spawned for the user at boot and kept around after logouts. This allows users who are not
logged in to run long-running services."

## 🔴 Verified quotes from topic 02 — do not re-fetch

**`user_namespaces(7)`** — 🔴 **the sentence the whole topic hangs on:** "A process can have a
normal unprivileged user ID outside a user namespace while at the same time having a user ID
of 0 inside the namespace; in other words, the process has full privileges for operations
inside the user namespace, but is unprivileged for operations outside the namespace."
A user namespace "isolate[s] security-related identifiers and attributes, in particular, user
IDs and group IDs …, the root directory, keys …, and **capabilities**". `uid_map`/`gid_map`
fields are (1) "the start of the range of user IDs **in** the user namespace", (2) "the start
of the range of user IDs **to which**" field one maps, (3) "the size of the range".
"Since Linux 3.8, unprivileged processes can create user namespaces." Unmapped IDs: "an
unmapped user ID is converted to the overflow user ID (group ID); the default value … is
**65534**" — that is the `nobody` rendering, **not** an ownership change.

**`subuid(5)`** — each line is "a user name and a range of subordinate user ids that user is
allowed to use", "three fields delimited by colons"; purpose: "This file specifies the user IDs
that ordinary users can use, with the **newuidmap** command, to configure uid mapping in a user
namespace." `subgid(5)` is the group twin.

**`podman-unshare(1)`** — 🔴 **the arithmetic's source:** "The user namespace is configured so
that the invoking user's UID and primary GID appear to be **UID 0 and GID 0**, respectively.
Any ranges which match that user and group in `/etc/subuid` and `/etc/subgid` are also mapped
in as themselves with the help of the `newuidmap(1)` and `newgidmap(1)` helpers." → two map
rows, so **container UID 0 → your host UID** and **container UID n → `subuid_start + n − 1`**
(with `you:100000:65536`, container 1000 → host 100999, container 65536 → host 165535).

**Shortcomings of Rootless Podman** (containers/podman `rootless.md`) — verbatim: "Podman can
not create containers that bind to ports < 1024"; `rootlessport` "is a userspace proxy that
**does not preserve client source IPs**"; pasta "copies the IP address of the main interface"
so "connections to that IP from containers do not work"; "**No support for setting resource
limits on systems using cgroups v1**"; "Some systemd unit configuration options do not work in
the rootless container"; "Container images cannot easily be shared with other users";
"Difficult to use additional stores for sharing content"; "Does not work on NFS or parallel
filesystem homedirs"; "Requires a writable home directory that is not mounted with noexec or
nodev"; "overlayfs as an unprivileged user is only available for Podman version >= 3.1 on Linux
kernel >= 5.12, otherwise **fuse-overlayfs** will be used"; "Only supported storage drivers are
overlay and VFS"; "images with higher UIDs and GIDs cannot be used"; 🔴 "**Making device nodes
within a container fails, even when using privileged containers**" — the cleanest proof that
`--privileged` is privilege *inside* a namespace you already own; "If /etc/subuid and
/etc/subgid are not set up for a user, then podman commands can easily fail".

## 🔴 Verified quotes from topic 03 — do not re-fetch

**`podman-pod-create(1)`** — "Creates an empty pod, or unit of multiple containers, and
prepares it to have containers added to it." The **infra container** is "a lightweight
container used to coordinate the shared kernel namespace of a pod"; `--infra` "create an infra
container and associate it with the pod", **default true**; `--infra-command` default
**`/pause`**; `--infra-image`, `--infra-name` also exist.
🔴 **`--share` — "a comma-separated list of kernel namespaces to share", DEFAULT `ipc, net,
uts`, allowed values `cgroup, ipc, net, pid, uts`.** So **`pid` is NOT shared by default** —
a sidecar cannot see the main process unless asked. And: "If the option is prefixed with a
'+', the namespace is appended to the default list. **Otherwise, it replaces the default
list**" — so `--share=pid` silently drops the shared network namespace; `--share=+pid` is
almost always what was meant.
`--share-parent`: "determines whether or not all containers entering the pod use the pod as
their cgroup parent", **default true** → the pod is a resource-accounting unit.
🔴 Ports: "You must not publish ports of containers in the pod individually, but only by the
pod itself."

**`podman-pod(1)`** — "podman pod is a set of subcommands that manage pods, or groups of
containers": clone, create, exists, inspect, kill, logs, pause, prune, ps, restart, rm, start,
stats, stop, top, unpause.

**Scope split kept deliberately:** topic 03 is the *concept and mechanism*; **topic 08** is the
CLI plus the pod-vs-user-defined-network decision; **topic 11** is `kube play`. Do not pull
08's decision table forward into 03 — 03 gives the one-line rule and links.

## 🔴 Verified quotes from topic 04 — do not re-fetch

**`podman-systemd.unit(5)` (Quadlet)** — "Podman supports building and starting containers
(and creating volumes) via systemd by using a **systemd generator**. These files are read
during boot (**and when `systemctl daemon-reload` is run**) and generate corresponding regular
systemd service unit files."

🔴 **EIGHT unit types, not seven:** `.artifact`, `.build`, `.container`, `.image`, `.kube`,
`.network`, `.pod`, `.volume`. ⚠️ **Phase 10 topic 14 listed seven and omitted `.image`** —
**corrected in commit `df7e091a`.** If any other page lists the types, check it.
`.image` "pulls and caches a container image" as a one-time service.

**Search paths, root** (precedence): `/run/containers/systemd/` (transient) ·
`/etc/containers/systemd/` (administrator) · `/usr/share/containers/systemd/` (distribution).
**Rootless**: `$XDG_RUNTIME_DIR/containers/systemd/` · `$XDG_CONFIG_HOME/containers/systemd/`
(= `~/.config/containers/systemd/`) · `/etc/containers/systemd/users/${UID}` ·
`/etc/containers/systemd/users/` · `/usr/share/containers/systemd/users/${UID}` ·
`/usr/share/containers/systemd/users/`.

🔴 **Naming: `foo.container` generates `foo.service`** — never `systemctl start foo.container`.
`ContainerName=` **defaults to `systemd-%N`**, deliberately, "to prevent conflicts with
user-managed containers" — hence `podman ps` showing `systemd-foo`.

`[Container]` keys: **`Image=` required**, "it is recommended to use a fully qualified image
name rather than a short name"; `Exec=` "has exactly the same effect as passing more arguments
after a `podman run <image> <arguments>` invocation"; `PublishPort=`, `Volume=`, `Network=`,
`Pod=`, `Environment=`, `EnvironmentFile=`, `Secret=`, `User=`/`UserNS=`, `HealthCmd=`,
`AutoUpdate=`, `Notify=`, `Label=` — most listable multiple times.

🔴 **The dependency trick (the topic's best fact):** referencing another Quadlet unit by name
— `Volume=foo.volume`, `Network=bar.network`, `Pod=x.pod` — means "the generated systemd
service contains a dependency on the" corresponding service unit. ⚠️ **Referencing the plain
resource name (`Volume=foo:/path`) creates NO dependency.** One suffix, entirely different
behaviour.

🔴 **`TimeoutStartSec=900` is the documented example value** — the image pull is why.
`[Install] WantedBy=default.target` in the docs' example (⚠️ `default.target` for USER units,
not `multi-user.target`).

## 🔴 Verified quotes from topic 05 — do not re-fetch

**`containers-registries.conf(5)`** — `unqualified-search-registries` is "an array of
*host*[`:`*port*] registries to try when pulling an unqualified image, in order".
`short-name-mode` takes `enforcing` / `permissive` / `disabled`, and "if `short-name-mode` is
not specified at all or left empty, default to the **`permissive`** mode".
🔴 **The CI failure explained, verbatim (enforcing):** "If there is more than one registry and
the user program is running in a terminal (i.e., stdout & stdin are a TTY), prompt the user to
select one of the specified search registries. **If the program is not running in a terminal,
the ambiguity cannot be resolved which will lead to an error.**" `permissive` "behaves as
enforcing but does not lead to an error if the program is not running in a terminal. Instead,
fallback to using all unqualified-search registries"; `disabled` uses them all "without
prompting". `[aliases]` table: "if a matching alias is found, it will be used without further
consulting the unqualified-search registries list."

**`podman-run(1)` health options** — `--health-interval`: "an *interval* of **disable**
results in no automatic timer setup". `--health-on-failure`: "Do not combine the `restart`
action with the `--restart` flag. When running inside of a systemd unit, consider using the
`kill` or `stop` action instead to make use of systemd's restart policy."
**`podman-healthcheck-run(1)`** — "Runs the healthcheck command defined in a running container
manually."

## 🔴 CORRECTION made in commit `3a67f58b` — do not re-introduce

**Phase 10 topic 09 asserted "Podman schedules healthchecks with *systemd timers*"** in both
the body and an interview answer, with a `> Verified:` line naming `podman-healthcheck-run(1)`.
⛔ **That page says no such thing, and neither does `podman-healthcheck(1)` nor the
`--health-*` options in `podman-run(1)`.** All three were re-fetched 2026-08-15. The only
documented statement is `--health-interval disable` → "no automatic timer setup", with the
**provider unnamed**. The transient-systemd-timer detail exists in the containers/podman issue
tracker and source, **not in the reference** — so under rule 7 it is not asserted. Both pages
now say "a timer, provider unnamed" plus the operational point (a status that never changes is
not evidence of health). ⚠️ **If a later topic needs the mechanism, cite the source that
actually states it and say where it comes from.**

## 🔴 Verified quotes from topic 06 — do not re-fetch

**`podman-unshare(1)`** — "launches a process (by default, `$SHELL`) in a new user namespace";
purposes are "troubleshooting unprivileged operations and manually clearing storage"; and
"`podman mount` fails for unprivileged users unless running inside a `podman unshare`
session". `--rootless-netns` = "join the rootless network namespace used for netavark
networking". 🔴 **"This command is not available with the remote Podman client"** — which
silently covers macOS and Windows, so the fix has to run inside `podman machine ssh`. Sets
**`CONTAINERS_GRAPHROOT`** and **`CONTAINERS_RUNROOT`** inside the session. The mapping
sentence is the one already recorded for topic 02.

**`podman-mount(1)`** — "mounts the specified containers' root file system in a location
which can be accessed from the host", and "rootless mode only supports mounting VFS driver,
unless Podman is run within the user namespace via the `podman unshare` command".

**`chown(2)`** — 🔴 **the reason plain `chown` fails and the page's mechanism:** "Only a
privileged process (Linux: one with the `CAP_CHOWN` capability) may change the owner of a
file." "The owner of a file may change the group of the file to any group of which that owner
is a member." `EPERM` = "the calling process did not have the required permissions (see
above) to change owner and/or group."

⚠️ **Docker's rootless page documents NO equivalent of `podman unshare`** — checked
2026-08-16; it names no `nsenter` recipe and does not state where rootless data is stored.
The page therefore says Docker's answers are the ones that avoid needing it (`--user`, a
named volume, an entrypoint `chown`), and does **not** invent an `nsenter` command.

⚠️ **Scope kept deliberately narrow.** `podman unshare chown` is *already* covered in
[[devbible-docker-podman-progress]]'s phase 0 · 11 and in phase 6 · 05's fix list, so topic 06
is the **command itself** — the four jobs, the map, what it is not — and links out for the
ownership-fix ranking rather than repeating it.

## 🔴 Verified quotes from topic 07 — do not re-fetch

Source is `podman-run(1)`'s `--userns` plus its upstream source file
`docs/source/markdown/options/userns.container.md`. ⚠️ **The first WebFetch of the rendered
man page came back PARAPHRASED and WRONG** — it rendered `nomap` as "turns off user namespace
for the container", which is not what the source says. **Fetching the raw markdown source and
then asking for short exact phrases is what settled it.** Treat a single fetch of a long
option list as unreliable.

**Default resolution order, and rule 1 is the trap:** if `--pod` is set the **pod's** user
namespace is used and **`--userns` is ignored entirely**; else `PODMAN_USERNS`; else `userns`
in `containers.conf`; else **`--userns=host`**. `""` aliases to `host`.

Verbatim fragments confirmed: **host** — "The processes running in the container have the same
privileges on the host as any other process launched by the calling user." **nomap** —
"creates a user namespace where the current rootless user's UID:GID are not mapped into the
container", and it is not permitted for root-created containers. **keep-id** — "For containers
created by root, the current mapping is created into a new user namespace" (so it is not
identity-preserving rootful); options `uid=`, `gid=`, `size=`; it overrides the image's `USER`
for the init process. **auto** — "Podman allocates unique ranges of UIDs and GIDs from the
`containers` subordinate user IDs"; options `size=`, `uidmapping=CONTAINER_UID:HOST_UID:SIZE`,
`gidmapping=`. Also `container:id` and `ns:namespace`. ⚠️ **The word "unshare" does not appear
in that file** — the two topics are genuinely separate features.

**Docker contrast (docs.docker.com/engine/security/userns-remap/), verified 2026-08-16:**
`userns-remap` "re-map[s] this user to a less-privileged user on the Docker host" so "UID
231072 is mapped within the namespace as UID 0 (root)" with "no privileges on the host machine
itself"; it is **daemon-wide** — "all containers are started with user namespaces enabled by
default" — and `--userns=host` exists to **disable** it per container, required because
`--privileged` is not allowed "without also specifying `--userns=host`". Incompatible when
enabled: sharing PID or NET namespaces with the host, and unaware volume/storage drivers.
🔴 **So Docker's flag is an opt-OUT of one daemon mapping; Podman's is an opt-IN to one of six
per container.** That table is the page's best section.

⚠️ **`keep-id` depth belongs to phase 6 · 09 (chunk B), not here.** Topic 07 is the map of the
six modes and the choice between them; it links out for the keep-id argument and for the
seven-fix ranking. `nomap` is framed as the **security opposite** of `keep-id` — that framing
is this page's own and is not a documented phrase.

## 🔴 Verified quotes from topic 08 — do not re-fetch

**`podman-pod-ps(1)`** — "lists all pods on the system. By default it lists: pod ID, pod name,
the time the pod was created, number of containers attached to pod, container ID of the pod
infra container, status of pod". 🔴 **Note what is missing — the members' NAMES**, hence
`--ctr-names` "display the container names" and `--ctr-status` "display the container
statuses". `--sort` takes created / ID / name / status / number of containers, default
**created**. `--quiet` = "print the numeric IDs of the pods only".

**`podman-ps(1)`** — `--pod` = "display the pods the containers are associated with"; the
filter list includes `pod` = "name or full or partial ID of pod". ⚠️ **`podman ps` and
`podman pod ps` answer different questions** — a container that looks orphaned is usually the
wrong list.

**`podman-pod-rm(1)`** — 🔴 **"removes one or more stopped pods AND THEIR CONTAINERS from the
host"** — a pod is not a dissolvable grouping. Without `--force`, "if all containers added by
the user are in an exited state, the pod is removed". `--force` = "stop running containers and
delete all stopped containers before removal of pod"; `--time` = "seconds to wait before
forcibly stopping running containers within the pod" and **requires `--force`**; `--all` "can
be used in conjunction with -f as well"; `--ignore` = "ignore errors when specified pods are
not in the container store" (the flag that makes teardown idempotent). ⚠️ **`pod rm -a -f` has
no project scoping** — unlike `compose down` it takes every pod you own.

**`podman-pod-stats(1)`** — "display a live stream of containers in one or more pods resource
usage statistics"; `--no-stream`, `--no-reset`; 🔴 **"running rootless is only supported on
cgroups v2"**.

**`podman-run(1)` `--pod`** — "run container in an existing pod. Podman makes the pod
automatically if the pod name is prefixed with **new:**", and "when a container is run with a
pod with an infra-container, the infra-container is started first". ⚠️ **`--pod new:x` creates
a pod with NO published ports and ports cannot be added later** — fine interactively, wrong in
a script.

**The decision table (pod vs user-defined network) is this page's deliverable** and the reason
topic 03 deliberately stops at a one-line rule. Compose builds a **network**, never a pod.

## 🔴 Verified quotes from topic 09 — do not re-fetch

**`podman-generate-systemd(1)`** — 🔴 verbatim deprecation: **"podman generate systemd is
deprecated. We recommend using Quadlet files when running Podman containers or pods under
systemd."** ⚠️ **There are no plans for removal** — say deprecated, not removed. Purpose:
"creates a systemd unit file that can be used to control a container or pod".
🔴 **`--new` is the load-bearing flag:** "generate systemd unit files that create and remove
containers at service start and stop commands", with "new containers and pods are created
based on their configuration files". **Without `--new` the unit only starts/stops a container
that must already exist** — `podman rm` or a prune breaks it. Default `--restart-policy` is
**`on-failure`** (systemd's, not the engine's; `systemd.service(5)`'s own default is `no`).
`--no-header` = "do not generate the header including meta data such as the Podman version and
the timestamp".
**Generated-unit tells, from the page's own examples:** an "autogenerated by Podman <version>"
header with a timestamp, `--cidfile %t/%n-cid`, `--conmon-pidfile %t/%n-pid`,
`Restart=on-failure`, `WantedBy=default.target`. ⚠️ **`Type=notify`, `NotifyAccess=all`,
`TimeoutStopSec` and `--sdnotify=conmon` are NOT in those examples** — checked, and the page
does not claim them.
**Quadlet arrived in Podman 4.4** — sourced to the [v4.4.0 release
notes](https://github.com/containers/podman/releases/tag/v4.4.0), not to the man page.
⚠️ **No converter is endorsed.** Podman's docs name none, so the page calls third-party
converters a first draft to read, and does not name one as recommended.
🔴 **The page's own argument (not a quote):** a generated unit is *derived data* that drifts
from the container it describes; Quadlet inverts the direction so the committed file is the
input. And the migration step everyone skips is **disabling the old unit** — otherwise two
supervisors, which is phase 10 · 14's failure.

## 🔴 Verified quotes from topic 10 — do not re-fetch

**`podman-auto-update(1)`** — "auto update containers according to their auto-update policy".
🔴 **Three conditions must ALL hold:** the `io.containers.autoupdate` label (or Quadlet's
`AutoUpdate=`); **"container or Kubernetes workloads must run inside a systemd unit"**; and for
`registry`, **"the registry policy requires a fully-qualified image reference (e.g.,
quay.io/podman/stable:latest) to be used to create the container"** — a short name simply
cannot be checked. `local` policy: "Podman compares the image digest of the container to the
one in the local container storage" — **never touches the network**.
**The timer:** "this unit is triggered daily at midnight by the `podman-auto-update.timer`
systemd timer".
🔴 **THE headline fact, and it is the page's thesis:** rollback defaults to **true**, but
**"detecting if a systemd unit has failed is best done by the container sending the READY
message via SDNOTIFY"** — otherwise systemd's bar is only *the process did not exit*, so a
container that starts broken looks healthy and rollback never fires. Ties to `--sdnotify`
(default `container`, recorded under topic 01) and Quadlet's `Notify=`.
`--dry-run`: "the `UPDATED` field indicates the availability of a new image with 'pending'".
`--authfile` default `${XDG_RUNTIME_DIR}/containers/auth.json`; `--tls-verify` default true.
⚠️ **Docker ships no engine equivalent** — the page says the answers there are external (a CI
job, a third-party watcher) and deliberately does **not** name or endorse one.

## 🔴 Verified quotes from topic 11 — do not re-fetch

**`podman-kube(1)`** — "the kube command recreates containers, pods or volumes based on the
input from a structured (like YAML) file input". Four subcommands: **apply** "apply Kubernetes
YAML … **to a Kubernetes cluster**" (🔴 the ONLY one that leaves the machine), **down** "remove
containers and pods based on Kubernetes YAML", **generate**, **play**.

**`podman-kube-play(1)`** — "reads in a structured file of Kubernetes YAML. It recreates
containers, pods, or volumes described in the YAML". Kinds: **Pod, Deployment, DaemonSet, Job,
PersistentVolumeClaim, ConfigMap, Secret**. `--replace` "tears down existing pods from a
previous run and recreates them"; `--down` "tears down the pods created by a previous run",
⚠️ `--force` takes the volumes (the `compose down -v` trap again); `--build` "build images even
if found in local storage"; `--configmap` "use Kubernetes ConfigMap YAML files to provide
environment variable values within pod containers"; `--publish`/`--network`/`--userns` override
the YAML and **command line takes precedence**.
🔴 **The unsupported-field tables are the page's second thesis:** `nodeSelector`, `affinity`,
`tolerations`, `schedulerName`, `imagePullSecrets` and various lifecycle/probe features are
marked unsupported or N/A — **they are IGNORED, not rejected**, so a manifest with a mistake in
them runs cleanly locally and fails on a cluster. There is **no scheduler**.

**`podman-kube-generate(1)`** — "generates Kubernetes YAML (v1 specification) from Podman
containers, pods or volumes". `--type` = pod (default) / deployment / daemonset / job;
`--service` "generate a Kubernetes service object in addition to the Pods"; `--filename`
"output to the given file instead of STDOUT" and refuses to overwrite. 🔴 **`--podman-only` =
"add podman-only reserved annotations in generated YAML file (Cannot be used by Kubernetes)"**
— the flag name is the warning.

⚠️ **`.kube` is a Quadlet unit type** (recorded under topic 04) — that is the production shape
of `kube play` on one host; running it by hand is for iterating.

## 🔴 Verified quotes from topic 12 — do not re-fetch

**`skopeo(1)`** — "command line utility used to interact with local and remote container images
and container image registries". Commands: **copy** "copy an image (manifest, filesystem
layers, signatures) from one location to another"; **delete** 🔴 "mark the image-name for later
deletion by the registry's **garbage collector**" (so the disk does NOT shrink); **inspect**
"return low-level information about image-name in a registry"; **list-tags**; **login/logout**;
**manifest-digest**; **standalone-sign** / **standalone-verify**, both described as "debugging
tool" — do not present them as a signing workflow. 🔴 **Every argument is a `transport:details`
pair** — `containers-storage`, `dir`, `docker`, `docker-archive`, `docker-daemon`, `oci`,
`oci-archive`.

**Skopeo README** — "does not require a daemon to be running to perform its operations" and
"does not require the user to be running as root to do most of its operations". 🔴 The two
selling sentences: **"inspecting a remote image showing its properties including its layers,
without requiring you to pull the image to the host"** and **"copy images from one registry to
another, without requiring privilege"**. Sync is named for air-gapped deployments.
⚠️ **The README says NOTHING about CI/CD** — the page's "install Skopeo on a CI runner"
framing is the page's own argument, not a quote.

⚠️ **Buildah is already covered at `phase-4-build-strategy/14-docker-vs-podman-vs-buildah.md`**
(the `from`/`run`/`copy`/`commit` scripted interface, Containerfile vs Dockerfile, output
compatibility, choosing). Topic 12 therefore leads with **Skopeo**, which appears nowhere else
in the track, and links back for Buildah rather than repeating it.

## 🔴 Verified quotes from topic 13 — do not re-fetch

**`podman-system-service(1)`** — "configure `DOCKER_HOST` environment variable to point to the
Podman socket so that it can be used via Docker API tools like docker-compose". Units:
`/usr/lib/systemd/user/podman.socket` + `podman.service` (user) and the system pair; enable
with `systemctl --user enable podman.socket` / `sudo systemctl enable podman.socket`.
🔴 **The API split (already recorded under topic 01, reused here):** "a compatibility layer
offering support for the **Docker v1.40 API**, and a Podman-native **Libpod** layer" — so
Podman-native features are deliberately NOT on the compatible half.
🔴 **Security, verbatim:** "We strongly recommend against making the API socket available via
the network without enabling mutual TLS to authenticate the client."
`--time` default **5 seconds** — which is why **socket activation** is the point: systemd holds
the socket and starts the service on demand, so the daemonless model survives Docker tooling.

**The `podman-docker` wrapper (`docker/docker.in` in containers/podman)** — a short script that
ends `exec ${BINDIR}/podman "$@"` and, unless a marker file exists, prints to **stderr**:
🔴 **"Emulate Docker CLI using podman. Create ${ETCDIR}/containers/nodocker to quiet msg."**
It checks **two** paths: `${ETCDIR}/containers/nodocker` **and**
`${XDG_CONFIG_HOME-$HOME/.config}/containers/nodocker` — ⚠️ **the per-user one means you do not
need root to silence it**, which most write-ups miss.
🔴 **The page's own argument (not a quote):** an `alias` is a shell feature, so Makefiles, CI
steps and anything spawning `/bin/sh` never see it — that is why the package installing a real
`/usr/bin/docker` is the correct answer for automation.

## 🔴 Verified quotes from topic 14 — do not re-fetch

**Podman [v6.0.0 release notes](https://github.com/containers/podman/releases/tag/v6.0.0)**,
all verbatim: "Support for running on cgroups v1 systems has been removed. Please update your
system to use cgroups v2." · "Support for BoltDB databases has been dropped. Starting Podman 6
when the BoltDB database is in use will have Podman attempt an automatic migration from BoltDB
to SQLite." · "Support for CNI networking has been removed. Please use Netavark instead." ·
"Support for the slirp4netns rootless network stack has been removed. Please use Pasta
instead." · "Support for running on iptables has been removed. Please use nftables instead." ·
"Support for running on Intel Macs has been removed. Support for running on Windows 10 has been
removed." · "The `podman volume prune` command now matches Docker's behavior by only pruning
unused anonymous volumes." Also: **`--network-cmd-path` removed**; import path moved to
`go.podman.io/podman/v6`; Quadlet tracking moved from `.app` files to subdirectories;
`--all-providers` gone from `machine list`; minimum Go 1.25.

**`podman-volume-prune(1)`** (current) — "remove unused volumes. By default only **anonymous**
(unnamed) unused volumes are removed"; `--all` = "remove all unused volumes (anonymous and
named)". ⚠️ **This is a DIFFERENT command from `podman system prune --volumes`** — phase 10 ·
13's warning about how much `--volumes` deletes is about the latter and still stands. Do not
merge the two.

⛔ **DELIBERATELY LEFT OUT:** a bullet the fetches rendered as "network isolation now defaults
to enabled, improving Docker compatibility and security". It names no surface, and I could not
settle what it applies to — so under rule 8 it is **not on the page**. If a later topic needs
it, verify it against the notes directly.

🔴 **The page's own arguments, not quotes:** cgroups v1 is the *hard blocker* (a start-up
requirement, not a per-feature one) and it retires the "not supported on cgroups V1 rootless
systems" caveat that follows `--memory`/`--cpus`/`--pids-limit` around the track; the automatic
BoltDB→SQLite migration is a **one-way door** for rollback; and iptables→nftables is a **host**
migration because Podman is rarely the only thing writing firewall rules.
⚠️ **Phase 7 · 08 (chunk B) names slirp4netns as a possible throughput improvement.** On
Podman 6 it is removed. Their page was **left alone** (one-language/one-chunk rule); topic 14
notes the change instead.

## 🔴 Verified quotes from topic 15 — do not re-fetch

**`podman-machine(1)`** — "podman machine is a set of subcommands that manage Podman's virtual
machine"; 🔴 **"Podman on MacOS and Windows requires a virtual machine"** and it "can be
optionally used on Linux"; ⚠️ **"All `podman machine` commands are rootless only."**
Subcommands: init, inspect, list, os ("manage a Podman virtual machine's OS"), reset ("reset
Podman machines and environment"), rm, set, ssh, start, stop, info ("display machine host
info"). ⚠️ The page says **nothing** about Fedora CoreOS, about system connections, or about
rootful/rootless *inside* the machine — none of that is claimed.

**`podman-machine-init(1)`** — "initialize a new virtual machine for Podman"; default name
**`podman-machine-default`**; `--now` "start the virtual machine immediately after it has been
initialized"; `--rootful` "whether this machine prefers rootful (`true`) or rootless (`false`)
container execution"; 🔴 **"Default volume mounts are defined in _containers.conf_. Unless
changed, the default values is `$HOME:$HOME`"** — which is the source of every "my bind mount
is empty on a Mac" report. ⚠️ **Default CPU/memory/disk sizes and the per-OS VM provider are
NOT documented on that page** — do not state them.

🔴 **The page's thesis (its own):** on macOS/Windows **the CLI is a remote client**, and all
four consequences follow from that — the `$HOME`-only share, commands refused by the remote
client (`podman unshare`, `--latest`), rootful being a machine-level choice, and the file-I/O
cost that [[devbible-docker-podman-progress]]'s phase 6 · 12 measures the effects of.
⚠️ **The first draft came in at 160 lines, short of the phase's 194–230 Know band.** It was
extended with *real* sections (diagnosing via `info`/`inspect`/`os`, Docker-API tools needing
the machine's socket, the Podman 6 host removals) — **not padded**. Adding content is the right
fix for a thin page; stretching prose is not.

## 🔴 Verified quotes from topic 16 — do not re-fetch

**podman-desktop.io** — "innovative desktop tool that brings the power of containers and
Kubernetes to your computer, making it easy to create, manage, and run containerized
applications visually"; "free and open source"; "vendor-neutral"; **CNCF sandbox**; "available
on Linux, macOS, and Windows"; a "general extension mechanism"; deploys to **Kind, Lima,
Minikube and OpenShift**. ⚠️ **The docs say NOTHING about managing a Docker engine** and
nothing about whether it bundles Podman — neither is claimed on the page.

🔴 **Docker Desktop licence (docs.docker.com/subscription/desktop-license/), and the
distinction is the point:** free for personal use, education, non-commercial open source and
small businesses — "fewer than 250 employees AND less than $10 million in annual revenue" —
and a paid Pro/Team/Business subscription for professional use in larger organisations and for
government entities. ⚠️ **The terms are about the DESKTOP APP only** — not Docker Engine on a
Linux server, not images, not registries. The page says so explicitly, because "Docker is not
free any more" is the usual mis-statement.

🔴 **The page's own arguments:** a GUI is a *view*, not a source of truth — clicking is not
reproducible, so the artefact must be a Quadlet unit or a `compose.yaml`; and a green
"Running" badge is the *visual* version of the mistake phase 10 · 09 already warns about.
The page ends with a **"Phase 11 in one paragraph"** recap linking all sixteen topics — that
recap is what makes 16 the right closing page.

## Claims deliberately NOT made

- Nothing about `passthrough`/`passthrough-tty` behaviour (listed, not described).
- No SQLite/BoltDB or locking claim from `podman(1)` — that page does not cover it; the
  Podman 6 database change belongs to **topic 14**, sourced from the release notes.
- No "systemd drives healthchecks" claim — see the correction above.
- No "Podman socket is safe" claim — the page says a *rootless* socket runs as you, and that a
  *rootful* one is back in Docker's risk class.

## Cross-link rules that bit

- **Everything unwritten in phase 11 is bold plain text with *(not written yet)***, including
  pages in this same phase. Only 01 is a link.
- ✅ **Phase 10's two phase-level footers were repointed** the moment the phase index existed
  (`phase-10-production/README.md` ×2 and `16-zero-downtime-restarts.md`). The *topic*-level
  placeholders pointing at **Quadlet** and **`podman auto-update`** are still correct and must
  be repointed when topics 04 and 10 land — grep `Phase 11` across `phase-10-production/`.
- ⚠️ Phase 10's README still says "Prev phase: **Phase 9 — The MERN/PERN stack** *(not written
  yet)*" although phase 9's index exists. **Left alone deliberately** — phase 9 is chunk C's
  live work and another session holds it.

## Known board defect, not mine to fix

`src/data/progress.js` has **Docker phase 7 at `pages: 11, pagesPlanned: 14`** while the phase
is closed 14/14, so the site under-reports it. Chunk B is finished and unheld, but the row is
not chunk D's, so it was left. Recorded in [[devbible-overall-snapshot]] too.

## ✅ UI wiring audit — 2026-08-15, session `75a196a7`

Run on the user's *"make sure the UI is wired completely"*. **Every surface that renders
Docker is derived from ONE row per phase in `src/data/progress.js`** — the homepage card
(`src/pages/index.js` calls `summarise('docker')` and hand-writes nothing), the `<Progress
lang="docker" />` block in the pages index, and the phase bars. 🔴 **So a wrong number in
`progress.js` is wrong in three places at once, and fixing the row fixes all three.** There is
no separate homepage list to update.

**Two real defects were found and fixed in commit `f8c0d3c9`:**
1. 🔴 **Phase 7 read `pages: 11, pagesPlanned: 14`** although chunk B closed it **14/14** —
   the site rendered a finished phase as in flight. It had been recorded as a known defect in
   [[devbible-overall-snapshot]] and left because "it is not my row"; the explicit wiring
   instruction made it in scope. Now `pages: 14` with `pagesPlanned` removed (the convention
   for a closed phase).
2. 🔴 **The pages-index `Total` drifted low** — 162 against a Written column summing to 164.
   **Two sessions each correctly bumped their own phase row and neither recomputed the shared
   total.** ⚠️ **Recompute the Total from the column; never increment it** — with chunks C and
   D both live it is stale the moment you read it.

**Checked and found correct — do not re-investigate:**
- Sidebar `_category_.json` positions 1–12, no collision; phase 11 is **position 12**.
- Phase 3's **18 syllabus topics across 17 pages** is a *documented deliberate merge* (its
  README says so), not a miscount. `progress.js` counts topics covered, not files.
- Phase 12's directory is absent because it is not started — expected, not a break.
- Every phase-11 page carries a tier badge and a `> Verified:` line. ⚠️ **The phase README
  correctly has no `> Verified:` line** — phase indexes carry the phase-level Target /
  documentation-validated blockquote instead, exactly as phase 10's does. A checker will flag
  it; it is not a defect.
- **0 console blocks** in phase 11 (the no-sandbox rule holds), **0 files over the 300-line
  cap**, **0 broken links in phases 10 and 11** out of 1,749 under `docs/docker`.
- **11 inbound links from phase 10 and the pages index into phase 11** — the phase is
  reachable, not an island.
- ⚠️ The only 5 broken links under `docs/docker` are **chunk C's** in-flight forward
  references in phase 9 (to their unwritten topics 10 and 14). Not chunk D's, left alone.

## 🔴 There is no worktree, and there never was one

Confirmed 2026-08-15: `git worktree list` returns **one entry, the main checkout**;
`git branch` shows **only `main`**; `git branch -r` shows only `origin/main`. **Nothing to
merge and nothing to delete** — the 2026-08-15 consolidation deleted every worktree and
branch, and chunk D has worked directly on `main` since. Every chunk-D commit is on `main`.
⚠️ **`main` has unpushed commits** (chunk D's and chunk C's interleaved). **Do not push
without being asked** — it would publish another live session's in-progress phase-9 work
alongside yours.

## Standing rules for this chunk

**No sandbox** — documentation-validated only, no console blocks, sources named in the
`> Verified:` line. **Never `git add -A`** (chunk C is live in the same checkout; phase 9
untracked files are theirs). Commit with
`git -c user.name=sairamgudiputi -c user.email=sairamgudiputi8@gmail.com commit`.
**Link-checked against the filesystem, NOT built** — no build/dev-server row was claimed.
