---
title: "The Specification and the file"
sidebar_label: "01 · The Spec and the file"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against
> [the Compose file reference](https://docs.docker.com/reference/compose-file/),
> [version and name](https://docs.docker.com/reference/compose-file/version-and-name/),
> [the Compose application model](https://docs.docker.com/compose/intro/compose-application-model/)
> and [the `docker compose` CLI reference](https://docs.docker.com/reference/cli/docker/compose/).
> **No sandbox** — no console output on this page.

**One schema, always the newest one, and a `version:` key that has not selected
anything for years.** Everything on this page follows from that.

## The Specification

The Compose Specification defines the configuration for an application's
"services, networks, volumes, and more". It is the schema; `docker compose` is one
implementation of it. Separating the two matters for a practical reason: a Compose
file is not "a Docker thing" the way a Dockerfile is, and other tools read the same
format.

The whole file is built from a small set of top-level elements:

| Top-level key | What it declares |
|---|---|
| `services` | The computing components — one entry per service |
| `networks` | Networks the services attach to |
| `volumes` | Named volumes the services mount |
| `configs` | Configuration data mounted into containers as files |
| `secrets` | Sensitive configuration, handled separately from `configs` |
| `name` | The project name, if you do not want it derived |
| `include` | Other Compose files pulled into this one ([page 16](../16-include-and-extends.md)) |
| `x-*` | Your own keys, which Compose ignores ([chunk 02](02-yaml-that-bites.md)) |

Everything else lives inside a service. There is no `version`, no top-level
`build`, and no place to put "global" settings — a fact people trip over when they
want one `restart:` policy for every service. The answer to that is fragments, in
the next chunk.

## `version:` is obsolete — delete it

You will see this at the top of thousands of examples:

```yaml
version: "3.8"          # ⛔ obsolete — delete this line
services:
  api:
    image: myapp/api
```

Per the documentation, Compose "always uses the most recent schema to validate the
Compose file, regardless of the `version` field", and you "receive a warning
message that it is obsolete if used". The property is informative and no longer
functionally relevant.

**The history, because it explains why the myth is so persistent.** The original
Compose had genuinely different file formats — v1, v2, v3 — with different features
and different behaviour, and `version: "3.8"` really did select one. Answers from
that era say things like "you need version 3.4 or later for that key", and they
were correct when written. The Compose Specification replaced the scheme entirely:
there is one schema, it is the newest one, and whether a key is supported is a
property of your Compose **binary**, not of a number in the file.

Three consequences worth stating plainly:

1. **Bumping the number never enables anything.** If a key is unsupported, upgrade
   Compose.
2. **Lowering the number never protects anything.** It does not pin behaviour and
   it does not make the file readable by an older tool.
3. **Deleting the line is always safe.** It is the first edit to make on any file
   you inherit.

## How Compose finds the file

Two mechanisms, and the search one surprises people.

**Default names, in precedence order:**

| Name | Status |
|---|---|
| `compose.yaml` | ✅ Preferred and canonical — "if both files exist, Compose prefers the canonical `compose.yaml`" |
| `compose.yml` | Accepted |
| `docker-compose.yaml` | Backward compatibility |
| `docker-compose.yml` | Backward compatibility |

**And it walks up the tree.** When `-f` is not given, Compose "will search the
working directory and parent directories for `compose.yaml` or
`docker-compose.yaml`". So `docker compose up` run from
`myapp/services/api/src/` can find and act on `myapp/compose.yaml` — convenient
right up until it is not, because the *project directory* travels with the file,
not with you.

**Overriding it:**

```bash
docker compose -f compose.yaml -f compose.prod.yaml up -d
COMPOSE_FILE=compose.yaml:compose.prod.yaml docker compose up -d
docker compose -f ./stack/compose.yaml --project-directory . up -d
```

| Flag | Environment variable | What it changes |
|---|---|---|
| `-f`, `--file` | `COMPOSE_FILE` | Which files are read, and the order they merge in ([page 11](../11-override-files.md)) |
| `--project-directory` | — | The base path for **relative paths inside the file**. Defaults to the directory of the first `-f` file |
| `-p`, `--project-name` | `COMPOSE_PROJECT_NAME` | The project namespace ([page 09](../09-project-name.md)) |
| `--env-file` | — | Which `.env` file is loaded for interpolation ([page 10](../10-environment-and-interpolation.md)) |
| `--profile` | `COMPOSE_PROFILES` | Which optional services are included ([page 12](../12-profiles.md)) |

`--project-directory` is the one to remember. Every relative path in the file — a
bind mount source, a `build.context`, an `env_file` — resolves against it, so
moving a compose file into a subdirectory silently repoints all of them at once.

## Podman

The file format is not Podman's to implement. `podman compose` hands the file to an
external provider ([page 01](../01-what-compose-is.md)), so which parts of the
Specification are honoured depends on the provider rather than on Podman. The
practical rule: **the more Specification surface a file uses — `include`,
`develop.watch`, `configs`, profiles — the more it matters which provider is
installed.** [Page 15](../15-podman-compose.md) makes that specific.

## Gotchas

**Symptom:** `the attribute 'version' is obsolete, it will be ignored` on every
command.
**Cause:** A `version:` key inherited from a pre-Specification example.
**Fix:** Delete the line. Do not change the number, and do not go looking for which
version supports your key — support comes from the Compose binary, not the file.

**Symptom:** `docker compose up` in a fresh directory brings up an entirely
different application.
**Cause:** With no `-f`, Compose searches the working directory *and its parents*,
and found a compose file further up the tree.
**Fix:** `docker compose config` to see what it resolved, and pass `-f` explicitly
in scripts rather than relying on the search.

**Symptom:** Bind mounts and build contexts break after moving the compose file
into a subdirectory.
**Cause:** Relative paths resolve against the project directory, which defaults to
the directory of the first `-f` file.
**Fix:** Pass `--project-directory` explicitly, or keep the compose file at the
root of the paths it references.

**Symptom:** An edit to `docker-compose.yml` has no effect.
**Cause:** A `compose.yaml` also exists, and Compose prefers the canonical name.
**Fix:** Keep exactly one file. Migrating to `compose.yaml` means deleting the old
one, not leaving it beside the new one as a backup.

## Interview questions

**★ What does the `version:` key at the top of a Compose file do?**
Nothing useful. Compose always validates against the most recent schema regardless
of it, and warns that it is obsolete. It is a leftover from the pre-Specification
era when v1, v2 and v3 were genuinely different formats. Whether a key is supported
now depends on the Compose version installed, not a number in the file — so the
correct action is to delete the line.

**★ Which filename should the file have, and how does Compose find it?**
`compose.yaml` is canonical and wins when several candidates exist; `compose.yml`,
`docker-compose.yaml` and `docker-compose.yml` remain supported for compatibility.
With no `-f`, Compose searches the working directory and then its parents, so a
command run deep inside a repository can pick up the project file at the root.
`-f` or `COMPOSE_FILE` overrides the search, and `--project-directory` controls
what relative paths inside the file resolve against.

**★ What are the top-level elements of a Compose file?**
`services`, `networks`, `volumes`, `configs` and `secrets` are the five that
describe the application; `name` sets the project name and `include` pulls in other
files. Anything starting with `x-` is yours and is ignored. There is no top-level
place for defaults — the way to share settings across services is a YAML fragment.

**Is the Compose Specification the same thing as Docker Compose?**
No. The Specification is the schema for the file; `docker compose` is an
implementation of it. That is why the same file can be read by other tools, and why
Podman can support Compose files without implementing Compose itself.

**What does `--project-directory` do?**
It sets the base path that every relative path inside the file resolves against —
bind mount sources, `build.context`, `env_file`. It defaults to the directory of
the first file passed with `-f`, which is why moving a compose file into a
subdirectory repoints all of them.

---

← Topic index: [compose.yaml and the Spec](README.md) · Next → [The YAML that bites](02-yaml-that-bites.md)
