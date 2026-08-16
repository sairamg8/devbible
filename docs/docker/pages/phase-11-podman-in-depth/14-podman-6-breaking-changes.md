---
title: "Podman 6 breaking changes"
sidebar_label: "14 · Podman 6 breaking changes"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the [Podman v6.0.0 release notes](https://github.com/containers/podman/releases/tag/v6.0.0),
> [podman-run(1)](https://docs.podman.io/en/latest/markdown/podman-run.1.html) and
> [podman-volume-prune(1)](https://docs.podman.io/en/latest/markdown/podman-volume-prune.1.html).
> **No sandbox** — no console output on this page.

**Podman 6 is a removal release.** It is not a list of new features to learn; it
is a list of things that used to work and do not. Every entry is a fallback,
compatibility shim or old platform being retired, and each one strands somebody.

The whole set in one table, then what each actually means:

| Removed | The release note | What replaces it |
|---|---|---|
| **cgroups v1** | "Support for running on cgroups v1 systems has been removed. Please update your system to use cgroups v2." | cgroups v2 |
| **BoltDB** | "Support for BoltDB databases has been dropped." | SQLite, migrated automatically |
| **CNI** | "Support for CNI networking has been removed. Please use Netavark instead." | netavark + aardvark-dns |
| **slirp4netns** | "Support for the slirp4netns rootless network stack has been removed. Please use Pasta instead." | pasta |
| **iptables** | "Support for running on iptables has been removed. Please use nftables instead." | nftables |
| **Intel Macs, Windows 10** | "Support for running on Intel Macs has been removed. Support for running on Windows 10 has been removed." | Apple Silicon, Windows 11 |

## The one that strands hosts: cgroups v1

Everything else on the list has a migration path on the same machine. This one
does not: a host that cannot run cgroups v2 cannot run Podman 6 at all.

The upside is that a caveat which has followed resource limits around the whole
track disappears. `--memory`, `--cpus` and `--pids-limit` were documented as **not
supported on cgroups V1 rootless systems**
([Phase 10 · 03](../phase-10-production/03-resource-limits/README.md)), and
`podman pod stats` carries the same restriction
([Phase 11 · 08](08-pod-commands.md)). On Podman 6 those caveats are moot,
because the unsupported configuration no longer exists.

⚠️ **The failure is at start-up, not at a feature.** Do not expect a helpful
error the first time a limit is applied — an old host simply stops being a Podman
host.

## The one that happens without asking: BoltDB → SQLite

> "Starting Podman 6 when the BoltDB database is in use will have Podman attempt
> an automatic migration from BoltDB to SQLite."

Convenient, and worth thinking about for one minute before you upgrade, because
**an automatic migration is a one-way door**. The state that describes your
containers, pods, volumes and networks is being rewritten by the new version. If
you then need to roll back to Podman 5, the old binary is looking at a database
it does not read.

The mitigation is ordinary care rather than anything Podman-specific: know where
your state lives — `$HOME/.local/share/containers/storage` rootless,
`/var/lib/containers/storage` for root
([Phase 11 · 01](01-daemonless/README.md)) — and treat the upgrade as a change
worth a snapshot on any host you care about.

## The networking removals are two different stories

**CNI is gone in favour of netavark.** If you are on a current Podman this
changed nothing — netavark has been the default for a long time, and
[Phase 7 · 12](../phase-7-networking/12-netavark-and-aardvark.md) explains which
component owns which error. The people affected are those with an inherited
`/etc/cni/net.d` configuration that Podman was still honouring.

**slirp4netns is gone in favour of pasta.** Again pasta was already the default
([Phase 7 · 08](../phase-7-networking/08-rootless-networking.md)), so this hits
anyone who *deliberately chose* the old stack — and there was a real reason to:
slirp4netns is documented as possibly improving throughput in some cases. On
Podman 6 that option no longer exists, so if a system was configured that way for
performance, the tuning has to be redone with pasta.

🔴 **`--network-cmd-path` was removed too**, which is the flag such a setup would
have used. A script carrying it fails on the flag rather than on the behaviour.

## iptables → nftables is a host change, not a Podman change

This one is easy to under-read. It is not about how you write commands; it is
about **what the host's firewall stack must be**. A machine still running the
legacy iptables backend needs migrating before Podman 6 goes on it, and that
touches whatever else on the box writes firewall rules — a VPN client, a
configuration-management rule set, a hand-written script.

⚠️ **Podman is rarely the only thing writing firewall rules.** Plan this as a
host migration with the other rule-writers in scope, not as a container upgrade.

## `podman volume prune` now matches Docker

> "The `podman volume prune` command now matches Docker's behavior by only
> pruning unused anonymous volumes."

The current reference agrees: "remove unused volumes. By default only
**anonymous** (unnamed) unused volumes are removed", with `--all` to "remove all
unused volumes (anonymous and named)".

A behaviour change to a command people have in scripts, and it is in the *safe*
direction: a named volume that would previously have been removed now survives —
and `--all` is the flag that restores the old behaviour, deliberately.

⚠️ **Do not confuse it with `podman system prune --volumes`**, which is a
different command with its own semantics
([Phase 10 · 13](../phase-10-production/13-disk-growth.md)) — that page's warning
about how much `--volumes` deletes still stands.

If a cleanup script relied on `volume prune` clearing named volumes, it now
silently does less. Silent-does-less is the good kind of regression, but it is
still a regression: check the disk-usage assumption that script was making.

## Should you upgrade?

For a developer machine, yes — the removals are of things you almost certainly do
not use, and the migration runs itself.

For a server, treat it as a **host** upgrade with three gates: cgroups v2, an
nftables-capable firewall stack, and a backup of container state before the
database migration runs. If any of the three is not true, the upgrade is a
project rather than a package update.

**Version targets for this track:** Podman **6.1.0**, Docker Engine **29.7.2**,
Compose **v5.4.0**. Where a page names a Podman default that changed here, it is
the Podman 6 behaviour that is described.

## Gotchas

**Symptom:** Podman 6 will not start at all on an older server.
**Cause:** cgroups v1. Support "has been removed", and it is a start-up
requirement rather than a per-feature one.
**Fix:** Migrate the host to cgroups v2, or keep that host on Podman 5. There is
no flag.

**Symptom:** After upgrading, rolling back to Podman 5 leaves an engine that
cannot see its own containers.
**Cause:** The automatic BoltDB → SQLite migration already ran. The old binary
does not read the new database.
**Fix:** Snapshot container state before upgrading a host you may need to roll
back. Recovering afterwards means recreating from your unit files or Compose
files — another argument for declarative definitions
([Phase 11 · 04](04-quadlet/README.md)).

**Symptom:** A script fails on an unrecognised `--network-cmd-path`.
**Cause:** The flag went with slirp4netns.
**Fix:** Remove it and re-test the rootless networking path under pasta,
including source-IP behaviour if anything depends on it.

**Symptom:** A cleanup job stopped reclaiming as much space as it used to.
**Cause:** `podman volume prune` now only prunes anonymous volumes, matching
Docker.
**Fix:** Intentional, and safer. If named volumes genuinely need removing, remove
them by name — deliberately, not by prune.

## Interview questions

**★ What kind of release is Podman 6?**
A removal release. cgroups v1, BoltDB, CNI, slirp4netns and iptables support are
all gone, along with Intel Macs and Windows 10 as host platforms. Almost
everything removed is a fallback or compatibility shim whose replacement was
already the default, so the upgrade is uneventful for most people and impossible
for a few.

**★ Which removal is the hard blocker, and why?**
cgroups v1. Every other item has a migration path on the same machine; a host
that cannot provide cgroups v2 cannot run Podman 6 at all. The compensation is
that the "not supported on cgroups V1 rootless systems" caveat on `--memory`,
`--cpus` and `--pids-limit` stops mattering.

**★ What should you do before upgrading a server?**
Check three things: cgroups v2, an nftables-capable firewall stack, and a backup
of container state — because the BoltDB to SQLite migration runs automatically on
first use and a rollback to Podman 5 then finds a database it cannot read.
Declarative definitions (Quadlet units, Compose files) are what make a rebuild
cheap if it comes to that.

**Does the CNI removal affect you?**
Only if something was still using it. netavark has been the default for a long
time, so the affected systems are those with an inherited CNI configuration
Podman was honouring. The same is true of slirp4netns versus pasta — with the
difference that some people chose slirp4netns deliberately for throughput, and
that option is now gone.

**Why is iptables removal a bigger deal than it looks?**
Because it is a property of the host, not of Podman. Podman is rarely the only
thing writing firewall rules, so migrating to nftables has to account for VPN
clients, configuration management and anything else that manipulates the rule
set. It is a host migration wearing a container upgrade's clothes.

**What changed about pruning volumes?**
`podman volume prune` now only prunes unused **anonymous** volumes, matching
Docker. Named volumes survive where they previously would not, so a cleanup
script reclaims less than it used to. That is the safe direction, but it is still
a changed assumption worth checking.

---

← Prev: [Docker CLI compatibility](13-docker-cli-compatibility.md) · Index: [Phase 11](README.md) · Next → [15 · `podman machine`](15-podman-machine.md)
