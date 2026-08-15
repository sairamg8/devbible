---
title: "Override files"
sidebar_label: "11 · Override files"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against
> [Merge Compose files](https://docs.docker.com/compose/how-tos/multiple-compose-files/merge/),
> [the Compose file merge reference](https://docs.docker.com/reference/compose-file/merge/) and
> [the `docker compose` CLI reference](https://docs.docker.com/reference/cli/docker/compose/).
> **No sandbox** — no console output on this page.

**Two files, one stack — but "merged" means different things for a string, a list
and a map, and the list case surprises everybody exactly once.** Adding a port in an
override does not replace the base's port; it *appends* to it.

## The default pair

Compose reads "a `compose.yaml` and an optional `compose.override.yaml`" file, where
"the `compose.yaml` contains your base configuration". No flags needed — if the
override file exists beside the base, it is applied.

That gives the standard arrangement for a repository:

| File | Contents | Committed? |
|---|---|---|
| `compose.yaml` | Everything true in every environment | ✅ yes |
| `compose.override.yaml` | Development conveniences — bind mounts, published ports, debug env | ✅ usually yes |
| `compose.prod.yaml` | Production differences, applied explicitly with `-f` | ✅ yes |

```bash
docker compose up -d                                    # base + override
docker compose -f compose.yaml -f compose.prod.yaml up -d   # base + prod, no override
```

🔴 **Naming `-f` explicitly disables the automatic override file.** That is the
point: production must not accidentally inherit the development bind mounts. It is
also the commonest confusion — "why did my override stop applying" is almost always
because someone added a `-f`.

Files are applied left to right, so the last `-f` wins on conflicts.

## The merge rules

Three categories, and you need all three.

### Single values replace

"For single-value options like `image`, `command` or `mem_limit`, the new value
replaces the old value."

```yaml
# compose.yaml
services: {api: {image: myapp/api:1.0}}
# compose.override.yaml
services: {api: {image: myapp/api:dev}}
# result: myapp/api:dev
```

Straightforward, and what everyone expects.

### Sequences concatenate

🔴 **This is the one that catches people.** "For the multi-value options `ports`,
`expose`, `external_links`, `dns`, `dns_search`, and `tmpfs`, Compose concatenates
both sets of values." More generally, "a YAML sequence is merged by appending values
from the overriding Compose file to the previous one."

```yaml
# compose.yaml
ports: ["8080:80"]
# compose.override.yaml
ports: ["8443:443"]
# result: BOTH — 8080:80 and 8443:443
```

If you meant "publish 8443 instead of 8080", you did not get it. You now publish
two ports, and on a shared machine the base one may be the one that collides.

### Mappings merge by key

"In the case of `environment`, `labels`, `volumes`, and `devices`, Compose 'merges'
entries together with locally defined values taking precedence." For environment and
labels "the variable or label name determines which value is used"; for volumes and
devices, "entries are merged using the mount path in the container".

```yaml
# compose.yaml
environment: {NODE_ENV: production, LOG_LEVEL: warn}
# compose.override.yaml
environment: {LOG_LEVEL: debug}
# result: NODE_ENV=production, LOG_LEVEL=debug
```

**This is why the map form of `environment` is worth insisting on**
([page 02](02-compose-yaml-and-the-spec/02-yaml-that-bites.md)): as a list of
`- KEY=value` strings it is a sequence, so it concatenates and you end up with the
same variable twice. It happens to work — the later one wins — but you cannot *see*
that from the file, and you cannot merge it with `<<`.

The same logic makes `volumes` merge on the container path, so an override can
replace where `/app` comes from without duplicating the mount.

## Removing and replacing: `!reset` and `!override`

Merging only ever adds. Two YAML tags exist for when you need to take something
away.

**`!override`** "allows you to fully replace an attribute, bypassing the standard
merge rules" — the fix for the concatenating-ports problem:

```yaml
# compose.override.yaml
services:
  api:
    ports: !override ["8443:443"]      # replaces, does not append
```

**`!reset`** removes an element entirely — "an override Compose file can also be
used to remove elements from your application model":

```yaml
services:
  api:
    ports: !reset []                   # publish nothing
    environment:
      FOO: !reset null                 # drop the variable
```

`!reset` is what a production override needs against a base that publishes a
debugging port, and it is far better than maintaining two near-identical full files.

## Relative paths resolve against the base file

> "all relative paths (for build contexts, environment files, bind-mounted volumes,
> and other resources) are resolved relative to the base Compose file"

So `./src` in `compose.prod.yaml` living in a `deploy/` subdirectory still resolves
against the **base** file's directory, not its own. This is the same question
`--project-directory` answers from the CLI side
([page 02](02-compose-yaml-and-the-spec/01-the-spec-and-the-file.md)), and getting it
wrong produces build contexts that are silently empty or wrong.

## Overrides versus the alternatives

| Tool | Use it when |
|---|---|
| **Override files** | The same services differ per environment — this page |
| **Profiles** | Whole services are present or absent ([page 12](12-profiles.md)) |
| **`include`** | A large stack is split into reusable pieces ([page 16](16-include-and-extends.md)) |

They compose, and the failure mode is using an override file to *disable* a service
— which needs `!reset` gymnastics — when a profile expresses it in one word.

**Always check the result rather than reasoning about it:**

```bash
docker compose -f compose.yaml -f compose.prod.yaml config
```

That prints the merged, interpolated file, which settles every question on this page
in one command.

## Podman

Multi-file merging is entirely the compose provider's logic — Podman never sees the
separate files ([page 15](15-podman-compose.md)). With `docker-compose` as the
provider the rules above hold; `!reset` and `!override` are newer Specification
surface and are exactly the kind of thing a different provider may not implement, so
verify with the provider's own `config` output before relying on them.

## Gotchas

**Symptom:** An override added a port and the base's port is still published.
**Cause:** `ports` is a sequence, and sequences concatenate.
**Fix:** `ports: !override [...]` to replace, or `ports: !reset []` to remove. Confirm
with `docker compose config`.

**Symptom:** The override file stopped being applied.
**Cause:** A `-f` was added to the command. Naming files explicitly disables the
automatic `compose.override.yaml`.
**Fix:** Name it too if you want it — `-f compose.yaml -f compose.override.yaml` —
and remember that production deliberately should not.

**Symptom:** An environment variable appears twice in the rendered config.
**Cause:** `environment` was written as a list, so it merged as a sequence.
**Fix:** Use the map form. It merges by key, which is what you meant.

**Symptom:** A build context is empty when using an override in a subdirectory.
**Cause:** Relative paths resolve against the **base** compose file, not the file the
path is written in.
**Fix:** Write the path as the base file sees it, or set `--project-directory`
explicitly.

## Interview questions

**★ How does Compose merge two files?**
Single values replace, sequences concatenate, and mappings merge by key with the
later file winning. The concatenation rule covers `ports`, `expose`,
`external_links`, `dns`, `dns_search` and `tmpfs`; the merge-by-key rule covers
`environment`, `labels`, `volumes` and `devices`, keyed by variable name or by
container mount path.

**★ Your override adds `ports: ["8443:443"]` and the base has `["8080:80"]`. What is
published?**
Both. Sequences append rather than replace. To get only 8443 you need
`ports: !override ["8443:443"]`, and to publish nothing at all,
`ports: !reset []`.

**★ When is `compose.override.yaml` applied, and when is it not?**
Automatically, whenever you run Compose without naming files. The moment you pass any
`-f`, the automatic override is not included — you get exactly the files you named,
merged left to right. That is what keeps production from picking up development bind
mounts.

**What do `!reset` and `!override` do?**
`!override` replaces an attribute wholesale, bypassing the merge rules. `!reset`
removes an element from the model — `ports: !reset []`, or `FOO: !reset null` to drop
a variable. Both exist because merging otherwise only ever adds.

**Where do relative paths in an override file resolve from?**
The base Compose file's directory, not the override's own. Build contexts,
`env_file` paths and bind-mount sources all follow that rule, which is why an
override kept in a subdirectory can end up with a build context that is not what it
looks like.

**Override file or profile?**
An override file when the same services need different settings per environment. A
profile when whole services should be present in one situation and absent in another.
Using an override to disable a service means fighting the merge rules with `!reset`,
where a profile says it in one word.

---

← Prev: [Environment and interpolation](10-environment-and-interpolation.md) · Index: [Phase 8](README.md) · Next → [Profiles](12-profiles.md)
