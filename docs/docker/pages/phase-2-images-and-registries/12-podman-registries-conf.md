---
title: "Podman's registries.conf"
sidebar_label: "12 · Podman registries.conf"
sidebar_position: 12
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against
> [containers-registries.conf(5)](https://github.com/containers/image/blob/main/docs/containers-registries.conf.5.md)
> and the [Podman documentation](https://docs.podman.io/en/latest/).
> **No sandbox** — Podman 5.8.4 is installed on this machine and was not run.

**Docker hard-codes Docker Hub for short names. Podman asks a config file.**
That single difference explains the prompt you get from `podman run nginx`, and
it is also a capability Docker does not have — mirrors, redirects and blocks,
declared per registry.

## Where it lives

| Scope | Path |
|---|---|
| System | `/etc/containers/registries.conf` |
| System drop-ins | `/etc/containers/registries.conf.d/*.conf` |
| **User (rootless)** | `~/.config/containers/registries.conf` |

Drop-ins are the polite way to add configuration without editing a
distribution-managed file.

## Short-name resolution

```toml
unqualified-search-registries = ["docker.io", "quay.io", "registry.fedoraproject.org"]
short-name-mode = "enforcing"
```

`unqualified-search-registries` is the ordered list to try when you type an
unqualified name. `short-name-mode` decides what happens when more than one could
match:

| Value | Behaviour |
|---|---|
| `enforcing` | **Prompts** you in a terminal; **errors** when there is no terminal |
| `permissive` | Like enforcing, but falls back to trying all registries when non-interactive. **The default** if unset |
| `disabled` | Uses all the search registries without prompting |

`enforcing` is the safe choice for a workstation: it will not silently resolve an
unqualified name to whichever registry answered first. It is also why a script
that works interactively can fail under systemd — no terminal, so it errors
instead of prompting.

> **Either way, the fix for your own files is the same: fully qualify.**
> `docker.io/library/nginx:1.27` needs no resolution and behaves identically in
> both engines ([page 01](01-image-references.md)).

## Per-registry blocks

```toml
[[registry]]
prefix = "docker.io"
location = "docker.io"

  [[registry.mirror]]
  location = "registry.local:5000"

[[registry]]
prefix = "internal.example.com"
location = "internal.example.com"
insecure = true

[[registry]]
prefix = "docker.io/someorg"
blocked = true
```

| Key | Meaning |
|---|---|
| `prefix` | The prefix of the image name this block applies to. Wildcard subdomains such as `*.example.com` are supported |
| `location` | The physical location of the `prefix`-rooted namespace — how you redirect one name to a different server |
| `mirror` | An array of mirrors for that namespace, tried in order |
| `insecure` | Allow plain HTTP and untrusted TLS certificates |
| `blocked` | Forbid pulling images matching this name |

## What this is actually good for

Three real uses, each of which Docker handles less directly:

**A pull-through mirror for the rate-limit problem.** Point `docker.io` at a
local mirror and every Hub pull on the network goes through it once
([page 08](08-registries.md)). The image names in your Dockerfiles do not change,
which is the whole point.

**Redirecting a namespace.** `location` lets `docker.io/myorg/...` resolve to an
internal registry — useful during a migration, or in an air-gapped network where
the public name must keep working.

**Blocking.** `blocked = true` refuses pulls matching a prefix. A blunt but
effective control for keeping a namespace out of a build environment.

## Docker's equivalents, for comparison

Docker has narrower versions of some of this in `/etc/docker/daemon.json`:

```json
{
  "registry-mirrors": ["https://registry.local:5000"],
  "insecure-registries": ["internal.example.com:5000"]
}
```

`registry-mirrors` applies to **Docker Hub only** — it is not a general per-
registry redirect. There is no Docker equivalent of `prefix`/`location`
rewriting or of `blocked`. This is one of the few places where Podman's
configuration is meaningfully more capable, rather than merely different.

## Gotchas

**Symptom:** `podman run nginx` prompts you to choose a registry.
**Cause:** `short-name-mode = "enforcing"` and several search registries.
**Fix:** Fully qualify the name. The prompt is the config doing its job — do not
"fix" it by setting `disabled`, which makes resolution silent instead of correct.

**Symptom:** A Podman command works in a terminal and fails in a systemd unit
with a short-name error.
**Cause:** `enforcing` errors rather than prompting when there is no terminal.
**Fix:** Fully qualify every image reference in units, scripts and Quadlet files.

**Symptom:** Rootless Podman ignores the registry configuration you edited.
**Cause:** You edited `/etc/containers/registries.conf` while rootless reads
`~/.config/containers/registries.conf` if present, which takes precedence.
**Fix:** Check which file is in effect — `podman info` reports the search
registries in use.

**Symptom:** A mirror is configured and pulls still go upstream.
**Cause:** The `prefix` does not match the image reference, or the mirror is
unreachable and Podman fell back.
**Fix:** Verify the prefix matches the name you actually type, and test the
mirror directly.

## Interview questions

**★ Why does `podman run nginx` behave differently from `docker run nginx`?**
Docker hard-codes `docker.io` for unqualified names. Podman consults
`unqualified-search-registries` in `registries.conf` and, under
`short-name-mode = "enforcing"`, prompts when several registries could match —
or errors when there is no terminal.

**★ How would you make every Docker Hub pull go through a local mirror?**
A `[[registry]]` block with `prefix = "docker.io"` and a `[[registry.mirror]]`
location. Image names in Dockerfiles are unchanged. Docker's narrower equivalent
is `registry-mirrors` in `daemon.json`, which applies to Hub only.

**What do `prefix`, `location` and `blocked` do?**
`prefix` selects which image names a block applies to (wildcards allowed);
`location` gives the physical server for that namespace, so one name can be
redirected to another; `blocked = true` refuses pulls matching the prefix.

**Why does a Podman command work interactively and fail under systemd?**
`short-name-mode = "enforcing"` prompts in a terminal and errors without one.
Fully qualify image references in anything automated.

---

← Prev: [save/load versus export/import](11-save-load-export-import.md) · Index: [Phase 2](README.md) · Next → [Where layers live on disk](13-storage-on-disk.md)
