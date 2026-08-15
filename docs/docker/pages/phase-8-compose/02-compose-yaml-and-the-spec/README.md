---
title: "compose.yaml and the Compose Specification"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against
> [the Compose file reference](https://docs.docker.com/reference/compose-file/),
> [version and name](https://docs.docker.com/reference/compose-file/version-and-name/),
> [the Compose application model](https://docs.docker.com/compose/intro/compose-application-model/),
> [services](https://docs.docker.com/reference/compose-file/services/),
> [fragments](https://docs.docker.com/reference/compose-file/fragments/),
> [extensions](https://docs.docker.com/reference/compose-file/extension/) and
> [the `docker compose` CLI reference](https://docs.docker.com/reference/cli/docker/compose/).
> **No sandbox** — no console output on this page.

**The Compose Specification is the schema, `compose.yaml` is your instance of it,
and the `version:` key at the top of every tutorial you have ever read is
obsolete.** Compose "always uses the most recent schema to validate the Compose
file, regardless of the `version` field" — so the key does nothing except earn you
a warning.

That single fact reorganises how you read every example on the internet, which is
why this is a Master-tier topic rather than a formatting note. The second half is
the other reason: this is YAML, and YAML has opinions about colons and the word
`true` that will cost you an afternoon exactly once.

| Chunk | What it covers |
|---|---|
| **[01 · The Specification and the file](01-the-spec-and-the-file.md)** | What the Specification is, the top-level elements, why `version:` is obsolete and safe to delete, and how Compose finds the file — including the parent-directory search and `--project-directory` |
| **[02 · The YAML that bites](02-yaml-that-bites.md)** | Quoting ports and booleans, fragments (anchors, aliases, the merge key and its mappings-only limit), `x-` extension fields, and `docker compose config` as the arbiter |

## Phase gate

You are done with this topic when you can take an inherited `compose.yaml` from a
five-year-old blog post and, without running anything, say which lines are
obsolete, which are silently mis-parsed, and which relative paths will break when
the file moves.

## Where this connects

- **[01 · What Compose is](../01-what-compose-is.md)** established the file/CLI
  split this topic fills in.
- **[03 · up, down and the lifecycle](../03-up-and-down.md)** is what acts on the
  file once it parses.
- **[11 · Override files](../11-override-files.md)** and
  **[16 · include and extends](../16-include-and-extends.md)** are the two ways one
  logical file becomes several.

---

← Prev: [What Compose is](../01-what-compose-is.md) · Index: [Phase 8](../README.md) · Start → [The Specification and the file](01-the-spec-and-the-file.md)
