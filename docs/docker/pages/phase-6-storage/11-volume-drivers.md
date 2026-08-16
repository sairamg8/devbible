---
title: "Volume drivers and network storage"
sidebar_label: "11 · Volume drivers"
sidebar_position: 11
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against [docker volume create](https://docs.docker.com/reference/cli/docker/volume/create/),
> [Docker — volumes](https://docs.docker.com/engine/storage/volumes/),
> [Compose file reference — volumes](https://docs.docker.com/reference/compose-file/volumes/) and
> [Podman — podman-volume-create](https://docs.podman.io/en/latest/markdown/podman-volume-create.1.html).
> **No sandbox** — no console output on this page.

**The `local` driver is not "a directory on this host" — it is "whatever
`mount(8)` can do on this host".** That covers far more ground than most people
realise, and knowing where it genuinely runs out is the difference between a
sensible NFS volume and a distributed-storage project you did not need.

## `--driver` and `--opt`

```bash
docker volume create --driver local myvol
```

`--driver` defaults to `"local"`, and options passed with `-o` / `--opt` are
*"passed directly to the volume driver"*. For the built-in `local` driver on
Linux, those options look like `mount` arguments — `type`, `o` and `device`.

Docker's own examples show the range:

```bash
# an NFS export
docker volume create --driver local \
  --opt type=nfs \
  --opt o=addr=192.168.1.1,rw \
  --opt device=:/path/to/dir \
  nfsvol

# a tmpfs, sized and owned
docker volume create --driver local \
  --opt type=tmpfs --opt device=tmpfs --opt o=size=100m,uid=1000 \
  scratch

# a whole block device
docker volume create --driver local \
  --opt type=btrfs --opt device=/dev/sda2 \
  btrfsvol
```

The mount is performed **when the volume is first used**, not when it is
created — so a typo in the NFS address surfaces as a container that will not
start, not as a `volume create` error.

The same thing in Compose:

```yaml
volumes:
  nfsvol:
    driver: local
    driver_opts:
      type: "nfs"
      o: "addr=192.168.1.1,nfsvers=4,rw"
      device: ":/exports/appdata"
```

**This is the answer to "we need shared storage" surprisingly often.** No
plugin, no extra daemon: a named volume that happens to be an NFS or CIFS mount,
declared in the file where everyone can see it.

## What the `local` driver cannot do

It handles the *mounting*. Everything above that is still yours:

- **It does not provision anything.** The export or the share must already
  exist.
- **It has no concept of another host.** Each engine mounts it independently;
  nothing coordinates who is writing.
- **It offers no snapshots, replication or failover.**
- **It does not follow a container.** Move a workload to another node and the
  volume does not go with it — you have to have arranged for the same mount to
  work there.

That last one is the real boundary. **A volume is a host-local object.** The
moment "the same data on several hosts, with something deciding where the
workload runs" is the requirement, you have left what the volume API models.

## Third-party volume drivers

The plugin system lets a driver own the whole lifecycle — provisioning,
attaching to whichever host needs it, snapshotting:

```bash
docker plugin install <plugin>
docker volume create --driver <plugin> --opt size=20G appdata
docker plugin ls
```

```yaml
volumes:
  appdata:
    driver: my-storage-driver
    driver_opts:
      size: "20G"
```

Historically this is how cloud block storage was attached (EBS, Cinder and
friends). ⚠️ **The ecosystem has thinned considerably**: the industry moved to
**CSI** under Kubernetes, and several once-standard Docker volume plugins are
unmaintained. Treat any specific plugin as something to check the health of
before adopting — this page deliberately does not recommend one, because a
recommendation here would age badly.

## Databases on network storage — the honest warning

The tempting move is a Postgres or MySQL volume backed by NFS. Be careful:

- **Locking semantics differ.** Databases rely on `fsync` and file locking
  behaving exactly as they do locally; over NFS these depend on the protocol
  version, the server's export options and the mount options.
- **Latency multiplies.** A database issues many small synchronous writes, which
  is the access pattern network filesystems are worst at.
- **Vendors say so.** PostgreSQL's documentation is explicit that NFS
  configuration must guarantee the required durability semantics; managed
  offerings and cloud block storage exist precisely because getting this right
  is specialist work.

**Rule of thumb: block storage (a device attached to one host) for databases;
network filesystems for shared files — uploads, media, static assets.** If a
database genuinely must live on NFS, that is a decision made with the storage
team and the vendor's documentation open, not a `driver_opts` block copied from
a blog.

## Podman

`podman volume create` takes the same `--driver` and `--opt`, and the `local`
driver behaves the same way. Three additions:

- **Volume plugins are configured in `containers.conf`** under
  `[engine.volume_plugins]`, mapping a plugin name to its socket, rather than
  being installed through the CLI.
- **`--opt o=noquota`** is a Podman-specific option, useful on XFS where project
  quotas would otherwise be applied.
- **Image-backed volumes** — Podman can create a volume whose content comes from
  an image, which has no Docker equivalent and pairs with its `--mount
  type=image`.

Rootless adds a practical limit worth stating plainly: **mounting an NFS or CIFS
share generally needs privileges a rootless user does not have.** The volume is
created happily and the first container to use it fails to mount. Either mount
the share on the host and bind-mount it in, or run that particular workload
rootful.

## When the answer is not a volume driver

Two alternatives that are usually better than reaching for a plugin:

- **Object storage in the application.** Uploads and media in S3-compatible
  storage, addressed by the application over HTTP, removes the shared-filesystem
  requirement entirely. It is the reason most modern stacks need far less shared
  storage than they used to.
- **An orchestrator with CSI.** If you need "volume follows workload across
  hosts, with provisioning and snapshots", that is Kubernetes' storage model,
  and it is where the ecosystem's effort now goes. Phase 12 places this in
  context.

## Gotchas

**Symptom:** `docker volume create` with NFS options succeeded, and the
container will not start.
**Cause:** The mount happens on first use, not at creation, so an unreachable
server or a wrong export path surfaces then.
**Fix:** Test the mount on the host with `mount -t nfs` and the same options
before wiring it into a volume.

**Symptom:** A shared NFS volume works from one host and behaves oddly with two.
**Cause:** Nothing coordinates concurrent writers — the `local` driver mounts,
it does not arbitrate.
**Fix:** Use it for read-mostly or partitioned data, or move to storage designed
for concurrent access. Do not put a database behind it.

**Symptom:** A rootless Podman container cannot mount an NFS-backed volume.
**Cause:** Mounting network filesystems needs privileges the rootless user does
not have.
**Fix:** Mount the share on the host and bind-mount the path, or run that
workload rootful.

**Symptom:** A volume plugin the project depends on stopped working after an
engine upgrade.
**Cause:** The plugin is unmaintained — much of the ecosystem moved to CSI.
**Fix:** Check the plugin's activity before adopting it, and prefer the `local`
driver with `mount` options where it suffices.

## Interview questions

**★ What can the built-in `local` driver actually do?**
Far more than a directory on disk: options passed with `--opt` go straight to
the driver, and on Linux the `local` driver takes `mount`-like `type`, `o` and
`device` arguments. So an NFS export, a CIFS share, a `tmpfs` or a whole block
device can all be a named volume, declared in Compose with `driver_opts` and
mounted on first use.

**★ Where does it stop being enough?**
It mounts, it does not manage. It cannot provision storage, coordinate writers,
snapshot, replicate, or follow a workload to another host. Once the requirement
is "the same data wherever this service is scheduled", you are in orchestrator
territory — Kubernetes and CSI — rather than the Docker volume API.

**★ Would you put a database on an NFS volume?**
Not by default. Databases depend on `fsync` and file-locking semantics that vary
with NFS version, export options and mount options, and their many small
synchronous writes are the worst case for a network filesystem. Block storage
attached to one host for databases; network filesystems for shared files like
uploads and media.

**How does the plugin story look today?**
Thinner than it was. Third-party volume drivers were how cloud block storage got
attached, and much of that effort moved to CSI under Kubernetes, leaving several
formerly standard plugins unmaintained. Check a plugin's health before depending
on it, and prefer the `local` driver plus mount options when it will do.

**Anything different under Podman?**
The `local` driver and `--opt` are the same. Plugins are configured in
`containers.conf` under `[engine.volume_plugins]` rather than installed through
the CLI, there are Podman-only options such as `o=noquota` and image-backed
volumes, and — the practical one — a rootless user usually cannot mount an NFS
or CIFS share at all, so the volume creates fine and the first container fails.

---

← Prev: [Backing up and restoring a volume](10-backup-and-restore.md) · Index: [Phase 6](README.md) · Next → [Bind-mount performance on macOS and Windows](12-bind-mount-performance.md)
