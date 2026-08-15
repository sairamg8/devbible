---
title: "The anchor, and why `environment` is a mapping"
sidebar_label: "02 · The anchor"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against
> [fragments](https://docs.docker.com/reference/compose-file/fragments/),
> [extensions](https://docs.docker.com/reference/compose-file/extension/),
> [the `extends` attribute](https://docs.docker.com/reference/compose-file/services/#extends),
> [Merge Compose files](https://docs.docker.com/compose/how-tos/multiple-compose-files/merge/),
> [the Compose file merge reference](https://docs.docker.com/reference/compose-file/merge/) and
> [the `build` section](https://docs.docker.com/reference/compose-file/build/).
> **No sandbox** — no console output on this page.

**Two lines at the top of the file are not Compose features at all — they are YAML,
and they behave in a way that quietly decides what the rest of the file can look
like.** The `x-` prefix is what makes the block legal; the merge key is what makes
it useful; and the merge key's one restriction is why every `environment` in this
track is written as a mapping.

## The block

`migrate` and `api` are **the same image running a different command**, and they
need the same credentials. Repeating twenty lines is how the two drift apart, and
the drift is silent — the migration job connects to the old database long after the
API stopped.

```yaml
x-api-base: &api-base
  build:
    context: ./api
    target: production
  image: acme/api:local
  environment:
    NODE_ENV: production
    PGHOST: db
    PGPORT: "5432"
    PGUSER: acme
    PGDATABASE: acme
    DATABASE_PASSWORD_FILE: /run/secrets/db_password
    REDIS_URL: redis://cache:6379
  secrets:
    - db_password
```

```yaml
  api:
    <<: *api-base
    depends_on: ...
    networks: [edge, backend]

  migrate:
    <<: *api-base
    command: ["node", "dist/migrate.js"]
    networks: [backend]
    restart: "no"
```

## Why `x-` is the prefix

🔴 **`x-` is the one prefix Compose ignores instead of rejecting.** Every other
top-level or service-level key it does not recognise is an **error** — there is no
"extra data is tolerated" mode.

That strictness is the feature, and it is worth being glad about: a mistyped
`enviroment:` fails at `up` with a message, rather than being silently discarded and
surfacing at three in the morning as a missing database password. The cost is that a
shared fragment needs somewhere legal to live, and `x-` is that place.

⚠️ **An `x-` block is not a service.** Nothing starts it, nothing validates its
contents, and a typo *inside* it is not caught — it is inert text until a merge key
pulls it into a service, at which point normal validation applies.

## The merge key, and its one restriction

`<<: *api-base` is YAML's merge key. It copies the anchored mapping's keys into the
service, and the service's own keys win where both define one.

🔴 **YAML merge applies to mappings only, never to sequences.** That single sentence
explains three separate decisions in this file:

| Decision | Because |
|---|---|
| `environment` is written `KEY: value`, not as a `- KEY=value` list | a list is a sequence, so it would not merge at all |
| `networks:` is **not** in the anchor | `api` needs two and `migrate` needs one, and a sequence cannot be merged and then adjusted |
| `depends_on` is per service | same reason, and the conditions genuinely differ |

⚠️ **The failure is silent in both directions.** Put a sequence in the anchor and
either it does not arrive, or the service's own key replaces it wholesale — and
nothing warns you. The rule of thumb that follows: **an anchor holds only the parts
that must be byte-identical across every service that uses it.**

## `environment` as a mapping, for a second reason

The merge key is the first reason. Compose's own merge rules are the second, and
they matter as soon as there is an override file
([Phase 8 · Override files](../../phase-8-compose/11-override-files.md)):

- single values **replace**
- **sequences concatenate** — documented for `ports`, `expose`, `external_links`,
  `dns`, `dns_search` and `tmpfs`
- mappings **merge by key** — `environment`, `labels`, `volumes`, `devices`

🔴 **So a list-form `environment` in an override appends rather than replaces**, and
the same variable appears twice. As a mapping it merges by variable name, which is
what everyone assumes is happening anyway. `!override` replaces a key wholesale and
`!reset` clears it (`ports: !reset []`) when concatenation is genuinely wrong.

## `image:` alongside `build:`

⚠️ **This is not "pull instead of build".** `image:` names what the build
*produces*. It is what lets `api` and `migrate` share one built image rather than
building the same context twice, and it is what makes the result pushable to a
registry later.

Whether the build runs at all is `pull_policy`'s job — `always` / `never` /
`missing` / `build` / `daily` / `weekly` / `every_<duration>`. The time-based values
are the sane middle ground given Docker Hub's documented pull limits, and `build`
is the one that forces a build regardless.

## Anchors versus `extends`

Both share configuration; they are not interchangeable.

| | Anchors + `x-` | `extends` |
|---|---|---|
| Scope | **one file** | across files |
| Mechanism | YAML, before Compose sees it | a Compose attribute |
| Referenced resources | whatever the mapping contains | ⛔ **not imported** |

🔴 **`extends` shares configuration, not referenced resources.** The documentation
is explicit that Compose *"does not automatically import these referenced
resources into the extended model"* — `volumes`, `networks`, `configs`, `secrets`,
`links`, `volumes_from`, `depends_on`, and `service:{name}` references in `ipc`,
`pid` or `network_mode` all have to be re-declared in the extending service.

For this file that would mean re-declaring `secrets: [db_password]` and every
`depends_on` in both services — which is precisely the duplication the anchor
exists to remove. **Within one file, anchors win.** `extends` earns its place when
the shared definition genuinely lives in another file, and its merge follows the
same three categories as above, except that sequences put referenced items first
and the extending service's after, duplicates removed.

⚠️ **`include` and `extends` resolve relative paths from opposite places**, which is
the other reason to keep reuse inside one file where you can
([Phase 8 · `include` and `extends`](../../phase-8-compose/16-include-and-extends.md)).

## Gotchas

**Symptom:** The anchor was merged into `api`, but the service came up on the wrong
network — or on none.
**Cause:** `networks:` was put inside the `x-` block. YAML merge operates on
mappings, and `networks: [edge, backend]` is a **sequence**, so it either does not
arrive or is replaced wholesale — with no warning either way.
**Fix:** Keep sequences out of anchors you intend to merge. Networks, `ports` and
`depends_on` differ per service anyway; the anchor is for what must be identical.

**Symptom:** An override file was supposed to replace `environment`, and instead the
variable appears twice.
**Cause:** `environment` was written as a **list**. Compose merges mappings by key
but concatenates sequences, so a list-form override appends.
**Fix:** Write `environment` as a mapping everywhere — which is also the only form
the `<<: *api-base` merge can act on. Use `!override` when a key genuinely must be
replaced rather than merged.

**Symptom:** Compose rejects the file with an error about an unrecognised key, on a
block that was added deliberately.
**Cause:** Only the `x-` prefix is ignored. Every other unknown key is an error;
there is no tolerant mode.
**Fix:** Prefix shared fragments with `x-`. The strictness is what catches a
mistyped attribute at `up` instead of at runtime, so it is worth keeping.

**Symptom:** `migrate` tries to pull `acme/api:local` from a registry and fails.
**Cause:** It has an `image:` but no `build:` of its own, and nothing had built that
tag yet — `image:` alone means "use this image", not "build it".
**Fix:** Give both services the same `build` **and** `image` through the anchor, so
either one can be the thing that builds it, and the tag always exists locally.

## Interview questions

**★ What is the `x-api-base` block, and why is it not a service?**
It is an extension field. `x-` is the single prefix Compose ignores rather than
rejecting, so the block is legal even though nothing starts it, and the YAML anchor
on it lets `api` and `migrate` merge one definition instead of repeating it. That
matters because the two are the same image with different commands: duplicated
credentials drift apart silently, and the symptom is a migration job talking to a
database the API abandoned weeks ago.

**★ Why is `environment` written as a mapping rather than a list?**
Two independent reasons, both about sequences. YAML's merge key operates on mappings
only, so a list-form `environment` would not merge into the service through
`<<: *api-base` at all. And Compose's own merge rules concatenate sequences while
merging mappings by key, so a list-form override in `compose.override.yaml` appends
rather than replaces and the same variable ends up defined twice. The mapping form
behaves the way everyone already assumes it does.

**★ What does `image:` mean when the service also has `build:`?**
It names the image the build produces — it is not "pull this instead". That is what
lets `api` and `migrate` share one built image without building the same context
twice, and it is what makes the result pushable to a registry later. Whether the
build runs is governed by `pull_policy`, whose value `build` forces one and whose
time-based values (`daily`, `weekly`, `every_<duration>`) are the sane middle ground
given Docker Hub's pull limits.

**When would you use `extends` instead of an anchor?**
When the shared definition lives in a different file — anchors are a YAML feature and
cannot cross file boundaries. Inside one file the anchor is better, because `extends`
shares configuration but, in the documentation's words, does not automatically import
referenced resources: `volumes`, `networks`, `secrets`, `depends_on` and
`service:{name}` references all have to be re-declared in the extending service. For
this stack that would mean repeating the secret and the dependency graph, which is
the duplication the anchor was introduced to remove.

**What are Compose's three merge categories?**
Single values replace; sequences concatenate — documented for `ports`, `expose`,
`external_links`, `dns`, `dns_search` and `tmpfs`; and mappings merge by key, keyed
by variable name for `environment`, label name for `labels`, and container mount path
for `volumes`. The concatenating sequences are the surprise, because an override that
adds a port ends up with both. `!override` replaces a key wholesale and `!reset`
clears it entirely.

**Why is `networks` deliberately kept out of the anchor?**
Because it is a sequence, and YAML merge keys cannot merge sequences — so the value
would either fail to arrive or be replaced wholesale by the service's own, silently
either way. It also should not be shared here on its own merits: `api` sits on both
the edge and backend networks because it is the only path between them, while
`migrate` needs only the backend. The general rule is that an anchor carries what
must be identical, and anything that legitimately differs per service stays out.

---

← Prev: [The file and its shape](01-the-file.md) · Index: [Phase 9](../README.md) · Next → [The wiring](03-the-wiring.md)
