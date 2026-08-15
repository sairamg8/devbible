---
title: "include and extends"
sidebar_label: "16 · include and extends"
sidebar_position: 16
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against
> [the `include` top-level element](https://docs.docker.com/reference/compose-file/include/),
> [the `extends` attribute](https://docs.docker.com/reference/compose-file/services/#extends),
> [Merge Compose files](https://docs.docker.com/compose/how-tos/multiple-compose-files/merge/) and
> [the `docker compose` CLI reference](https://docs.docker.com/reference/cli/docker/compose/).
> **No sandbox** — no console output on this page.

**Three mechanisms split a large Compose setup, and they answer three different
questions.** Override files layer *variants of one stack*
([page 11](11-override-files.md)); `include` pulls in *whole other stacks*;
`extends` reuses *one service definition*. Reaching for the wrong one is how a
compose directory becomes unmaintainable.

| Mechanism | Unit | Question it answers |
|---|---|---|
| `-f` / `compose.override.yaml` | the whole file | "Same stack, different environment" |
| `include` | another Compose file | "This stack needs that team's stack too" |
| `extends` | one service | "These three services are the same thing with one field changed" |

## `include`

```yaml
include:
  - ../commons/compose.yaml
  - ../another_domain/compose.yaml

services:
  api:
    build: .
    depends_on:
      - db          # declared in ../commons/compose.yaml
```

Long syntax, when the defaults are wrong:

```yaml
include:
  - path: ../commons/compose.yaml
    project_directory: ..
    env_file: ../another/.env
```

| Attribute | Default | What it does |
|---|---|---|
| `path` | — | Required. A string, or a list of files to merge into one included model |
| `project_directory` | the **included file's** directory | The base for resolving that file's relative paths |
| `env_file` | `.env` in the `project_directory` | Where the included file's interpolation defaults come from |

🔴 **The point of `include` is that the included file keeps its own frame of
reference:** *"Relative paths in Compose files being referred by `include` are
resolved relative to their own Compose file path, not based on the local
project's directory."* That is what makes it usable across repositories — the
other team's `build: .` and `./init.sql` still mean what they meant to them.

This is the difference from `-f a.yaml -f b.yaml`, where relative paths resolve
against the **base** file's directory ([page 11](11-override-files.md)). Same
apparent job, opposite path rule.

Three more documented behaviours:

- **It is recursive.** *"An included Compose file which declares its own
  `include` section triggers those other files to be included as well."*
- **It does not merge on conflict.** *"Compose displays a warning if resource
  names conflict and doesn't try to merge them."* Two services called `db` are a
  problem to fix, not a merge to reason about — the opposite of override-file
  behaviour, and the reason `include` scales where stacked `-f` files do not.
- **Your environment still wins.** *"The local project's environment has
  precedence over the values set by the Compose file, so that the local project
  can override values for customization."*

## `extends`

```yaml
services:
  base:
    image: node:24
    working_dir: /app
    env_file: .env.common
    restart: unless-stopped

  api:
    extends:
      service: base
    command: npm start
    ports:
      - "3000:3000"

  worker:
    extends:
      file: ../common/compose.yaml    # optional — same file if omitted
      service: base
    command: npm run worker
```

`extends` takes two keys: `service`, *"the name of the service being referenced
as a base"*, and the optional `file`, *"the location of a Compose configuration
file defining that service"*. A relative `file` is *"relative to the location of
the main Compose file"* — note that this is the **opposite** of `include`'s rule,
and it is the single most confusable pair in this topic.

### The merge rules

The same three categories as override files, which is worth internalising once:

| Category | Rule |
|---|---|
| **Scalars** | *"Keys in the main service definition take precedence over keys in the referenced one"* |
| **Mappings** (`environment`, `labels`, `healthcheck`, `build.args`) | Keys in the main definition override keys of the same name; the rest are inherited |
| **Sequences** (`cap_add`, `cap_drop`, `expose`, `ports`, `secrets`) | *"Items are combined together into a new sequence"* — referenced first, main after, duplicates removed |

So a `ports` entry in the extending service **adds to** the base's ports; it does
not replace them. If you need replacement, do not put the list in the base.

### 🔴 The restriction that catches everyone

**`extends` copies configuration, not the resources that configuration refers
to.** *"Compose does not automatically import these referenced resources into the
extended model"* — you must declare them yourself. That covers:

`volumes` · `networks` · `configs` · `secrets` · `links` · `volumes_from` ·
`depends_on` · and anything referenced by `service:{name}` in `ipc`, `pid` or
`network_mode`.

```yaml
services:
  base:
    image: node:24
    volumes:
      - shared:/data          # names a top-level volume

  api:
    extends:
      service: base           # inherits the mount, NOT the declaration

volumes:
  shared:                     # ← still required, in every file that extends base
```

The failure is loud rather than subtle — an undefined volume or network is an
error — but the cause is not obvious if you expect `extends` to work like
inheritance in a programming language. It is closer to a mixin over the service
mapping only.

### Chaining and cycles

*"Circular references with `extends` are not supported, Compose returns an error
when one is detected."* Chaining is supported: if the referenced service itself
uses `extends`, the merge iterates until no `extends` keys remain. Two levels is
usually plenty; three is a sign the base is doing too much.

## Choosing between them

| You want to… | Use |
|---|---|
| Run the same stack in dev and prod | override files ([page 11](11-override-files.md)) |
| Turn a service on or off per situation | `profiles` ([page 12](12-profiles.md)) |
| Compose your stack with another team's stack | `include` |
| Stop repeating the same eight lines across three services | `extends` |
| Reuse a fragment of YAML *within one file* | a `x-` extension field plus a YAML anchor ([page 02](02-compose-yaml-and-the-spec/README.md)) |

That last row is worth knowing before reaching for `extends`: for reuse inside a
single file, anchors and `x-` fragments are simpler and need no merge rules —
they are resolved by the YAML parser before Compose ever sees them. `extends`
earns its complexity when the base lives in **another file**.

## Podman

Both are file-format features, resolved by the compose provider before anything
reaches the engine, so neither is engine-specific. Under `podman compose` with
`docker-compose` as the provider they behave as documented; with
`podman-compose`, confirm with `config` rather than assume
([page 15](15-podman-compose.md)).

## Gotchas

**Symptom:** An included file's `build: .` builds the wrong directory — or an
extended service's `file:` cannot be found.
**Cause:** The two features resolve relative paths from opposite places.
`include` resolves the included file's paths against **its own** directory;
`extends`'s `file:` is relative to the **main** Compose file.
**Fix:** Learn the pair as a contrast rather than a rule. `include` has
`project_directory:` when you need to override its default.

**Symptom:** `extends` fails with an undefined volume or network.
**Cause:** `extends` shares configuration, not referenced resources. Top-level
`volumes`, `networks`, `configs` and `secrets` are not imported.
**Fix:** Declare them in the extending file too. The same applies to
`depends_on`, `links` and `service:{name}` references in `ipc`, `pid` and
`network_mode`.

**Symptom:** An extending service publishes both its own port and the base's.
**Cause:** Sequences are combined, not replaced — referenced items first, then
yours, duplicates removed.
**Fix:** Keep lists out of the base service, or override the key at the
extending level knowing it appends. Where you must replace a list wholesale, the
override-file mechanism has `!override` and `!reset`; `extends` does not.

**Symptom:** Compose warns about conflicting resource names after adding an
`include`.
**Cause:** `include` deliberately does not merge conflicts — two definitions of
`db` are ambiguous, not mergeable.
**Fix:** Rename one, or use the other team's service instead of redefining it.
Treat the warning as the design feedback it is.

## Interview questions

**★ When would you use `include` rather than another `-f` file?**
When you are composing with a *whole other stack* rather than layering a variant
of your own. `include` keeps the included file's relative paths resolving against
its own directory, so another repository's build contexts and mounts still work,
and it warns rather than merges on a name conflict. Stacked `-f` files resolve
everything against the base file and merge silently — right for dev/prod
variants, wrong for combining independent stacks.

**★ What does `extends` NOT bring along?**
Referenced resources. Compose does not import the top-level `volumes`,
`networks`, `configs` or `secrets` a base service refers to, nor `depends_on`,
`links`, `volumes_from`, or `service:{name}` references in `ipc`, `pid` and
`network_mode`. The configuration is copied; the declarations must exist in the
extending file.

**★ How do `extends` merges treat lists?**
They combine rather than replace — referenced items first, then the main
service's, with duplicates removed. So `ports` in an extending service adds to
the base's. Scalars and mapping keys go the other way: the main definition wins.
This is the same three-category model as override-file merging, which is why it
is worth learning once.

**Can `include` and `extends` be nested?**
`include` is recursive — an included file's own `include` section is followed.
`extends` chains until no `extends` keys remain, but circular references are an
error, not a silent loop.

**Why might YAML anchors be a better answer than `extends`?**
For reuse inside a single file they are simpler: the parser resolves them before
Compose sees the document, so there are no merge rules and no resource-import
restriction to remember. `extends` is for when the base lives in another file,
which anchors cannot reach.

---

← Prev: [`podman compose` and `podman-compose`](15-podman-compose.md) · Index: [Phase 8](README.md) · Next → [`--scale` and the honest limits](17-scale-and-limits.md)
