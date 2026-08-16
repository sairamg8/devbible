---
title: "Buildah and Skopeo"
sidebar_label: "12 · Buildah and Skopeo"
sidebar_position: 12
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against [skopeo(1)](https://github.com/containers/skopeo/blob/main/docs/skopeo.1.md),
> the [Skopeo README](https://github.com/containers/skopeo),
> [Buildah](https://buildah.io/) and [podman(1)](https://docs.podman.io/en/latest/markdown/podman.1.html).
> **No sandbox** — no console output on this page.

Docker is one binary that builds, runs, pulls, pushes and inspects. The
containers/ toolset splits those jobs across three, and the split is not
arbitrary — **each job needs different privileges and different dependencies**,
so separating them means you can install only the one a machine actually needs.

| Tool | Job | Needs |
|---|---|---|
| **Podman** | Runs containers | A kernel with namespaces; a runtime |
| **Buildah** | Builds images | A builder; no running container required |
| **Skopeo** | Moves and examines images | Network and credentials — **no daemon, no local storage, no root** |

A CI runner that only pushes an image does not need a container engine at all.
That is the practical payoff, and it is the reason to know these exist.

## Skopeo — the one you have not met

Buildah appears throughout [Phase 4](../phase-4-build-strategy/README.md);
Skopeo does not appear anywhere, and it is the more immediately useful of the
two. It is a "command line utility used to interact with local and remote
container images and container image registries", and it "does not require a
daemon to be running to perform its operations", nor "the user to be running as
root to do most of its operations".

### Transports are the idea

Every Skopeo argument is a **transport plus a location**, and once that clicks
the whole tool follows:

| Transport | What it addresses |
|---|---|
| `docker://` | An image in a registry |
| `containers-storage:` | Podman/Buildah's local storage |
| `docker-daemon:` | An image inside a running Docker daemon |
| `dir:` | A plain directory on disk |
| `oci:` / `oci-archive:` | An OCI layout directory or archive |
| `docker-archive:` | A `docker save` tarball |

`skopeo copy` "copy[ies] an image (manifest, filesystem layers, signatures) from
one location to another" — and because both sides are transports, it moves
between *any* two of the rows above:

```bash
# registry to registry, with nothing stored locally
skopeo copy docker://docker.io/library/nginx:1.29 docker://registry.internal/nginx:1.29

# registry to a directory, for an air-gapped transfer
skopeo copy docker://docker.io/library/redis:8 dir:/tmp/redis

# out of a Docker daemon and into Podman's storage
skopeo copy docker-daemon:myapp:1.0 containers-storage:myapp:1.0
```

🔴 **The first one is the trick worth remembering.** Re-tagging an image into
another registry normally means `pull`, `tag`, `push` — the whole image down to
disk and back up. Skopeo streams it, and the README says the same of privileges:
you can "copy images from one registry to another, without requiring privilege".
That last example is also the cleanest answer to "how do I get this image from
Docker into Podman" ([Phase 2 · 11](../phase-2-images-and-registries/11-save-load-export-import.md)
does it the long way with `save`/`load`).

### Inspecting without pulling

```bash
skopeo inspect docker://docker.io/library/postgres:18
```

It returns "low-level information about image-name in a registry", and the README
is explicit about the point: "inspecting a remote image showing its properties
including its layers, **without requiring you to pull the image to the host**".

That is a genuinely different capability from `docker inspect`, which can only
tell you about images you already have. Checking a tag's digest, its labels or
its architecture before deciding to pull a multi-gigabyte image is a real saving,
and it is how you would verify a digest pin
([Phase 5 · 08](../phase-5-image-quality/08-pinning-by-digest.md)) without
downloading anything.

### The rest of the command surface

- **`sync`** "synchronize[s] images between registry repositories and local
  directories" — the mirroring tool, and the README names air-gapped deployments
  as the case.
- **`delete`** does not delete anything immediately: it "mark[s] the image-name
  for later deletion by the registry's garbage collector". ⚠️ Expect the tag to
  vanish and the disk not to shrink until the registry runs GC.
- **`list-tags`** lists the tags in a repository.
- **`login` / `logout`** share credentials with Podman and Buildah.
- **`manifest-digest`**, **`standalone-sign`** and **`standalone-verify`** — the
  last two are described in the documentation as debugging tools, so treat them
  as such rather than as a signing workflow
  ([Phase 5 · 12](../phase-5-image-quality/12-signing-and-verifying.md) is the
  real one).

## Buildah, briefly

Buildah builds images, and `podman build` is Buildah's code behind Podman's
interface — so on a Podman host you use it every day without typing its name.
Its distinguishing feature is the **step-by-step interface**: `buildah from`,
`run`, `copy`, `config`, `commit`, which lets a shell script construct an image
without a Containerfile at all.

That argument, the Containerfile/Dockerfile relationship and when to reach for the
scripted interface are all in
[Phase 4 · 14](../phase-4-build-strategy/14-docker-vs-podman-vs-buildah.md) —
this page does not repeat it.

## Do you need to install them?

Usually not, and that is worth saying plainly:

- **Podman already contains Buildah's build code** and can push and pull, so a
  developer machine with Podman needs neither.
- **Install Skopeo** when a machine moves images and should not run them — a CI
  runner, a mirroring host, a release script.
- **Install Buildah** when a machine builds images and should not run them, or
  when you want the scripted interface.

The split earns its keep on servers, not laptops. On a laptop it is trivia; in a
pipeline it is a smaller attack surface and a smaller image.

## Gotchas

**Symptom:** `skopeo delete` succeeded and the registry's disk usage did not
change.
**Cause:** It marks the image "for later deletion by the registry's garbage
collector" rather than removing data.
**Fix:** Run the registry's garbage collection. This is registry behaviour, not
a Skopeo failure.

**Symptom:** `skopeo copy myimage:1.0 docker://registry/myimage:1.0` fails to
parse.
**Cause:** Both arguments need a transport. A bare image name is not a valid
Skopeo argument.
**Fix:** Say where it is: `containers-storage:myimage:1.0`,
`docker-daemon:myimage:1.0`, or `docker://…`.

**Symptom:** An image built by Buildah behaves differently under Docker.
**Cause:** Rarely the image — all three tools produce OCI-compliant images that
run anywhere. It is far more often short-name resolution or a builder-specific
default.
**Fix:** Fully qualify image references and pin the builder in CI
([Phase 4 · 14](../phase-4-build-strategy/14-docker-vs-podman-vs-buildah.md)).

**Symptom:** Skopeo cannot authenticate although `podman login` worked.
**Cause:** They share credential files, but not across users or across
root/rootless — the file lives under the invoking user's runtime or config
directory.
**Fix:** `skopeo login` as the same user that will run the command, and check
which `authfile` each is using.

## Interview questions

**★ What is Skopeo for, and what can it do that `docker` cannot?**
It interacts with images and registries without a daemon, without root, and
without local storage. The two capabilities that stand out are inspecting a
remote image "without requiring you to pull the image to the host", and copying
directly between registries without a local pull and push. Everything is
addressed as a transport plus a location, which is why it can also move images
between a Docker daemon, Podman's storage, a directory and an OCI archive.

**★ Why split build, run and move into three tools?**
Because they need different things. Moving an image needs network and
credentials; building needs a builder; running needs namespaces and a runtime. A
CI runner that only pushes images can install Skopeo alone — smaller image,
smaller attack surface, no engine to secure. Podman still bundles Buildah's build
code, so a developer machine does not have to care.

**★ How would you copy an image between two registries efficiently?**
`skopeo copy docker://source/image:tag docker://dest/image:tag`. It transfers the
manifest, layers and signatures directly rather than pulling to disk and pushing
back, and the README notes it does not require privilege. The pull-tag-push
sequence is the version to avoid when the image is large.

**Does `skopeo delete` free disk space?**
No. It marks the image for later deletion by the registry's garbage collector, so
the tag disappears and the blobs stay until GC runs. Surprising the first time,
and it is the registry's design rather than Skopeo's.

**What is Buildah's step-by-step interface for?**
Constructing an image from a shell script — `from`, `run`, `copy`, `config`,
`commit` — when the build genuinely needs to branch, loop or call other tools.
The trade is that you give up the declarative, cacheable Containerfile, so it is
an escape hatch for programmatic image pipelines rather than a default.

**Do Podman, Buildah and Skopeo produce or expect different image formats?**
No — they all work with OCI-compliant images and share the same local storage and
credential files. That is the point of the split: three programs, one set of
artefacts.

---

← Prev: [`podman kube play` / `generate kube`](11-kube-play.md) · Index: [Phase 11](README.md) · Next → **13 · Docker CLI compatibility** *(not written yet)*
