---
title: "The YAML that bites"
sidebar_label: "02 · The YAML that bites"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against
> [services](https://docs.docker.com/reference/compose-file/services/),
> [fragments](https://docs.docker.com/reference/compose-file/fragments/),
> [extensions](https://docs.docker.com/reference/compose-file/extension/) and
> [the `docker compose` CLI reference](https://docs.docker.com/reference/cli/docker/compose/).
> **No sandbox** — no console output on this page.

**A Compose file is YAML before it is Compose, and YAML will happily turn your
port mapping into a number and your `true` into a boolean without raising an
error.** Both failures are silent, which is why they belong in the Master tier
rather than in a style guide.

## Quote your ports

```yaml
ports:
  - "3000:3000"     # ✅ quoted
  - 3000:3000       # ⚠️ unquoted — a YAML sexagesimal hazard
```

The documentation is explicit: "HOST:CONTAINER should always be specified as a
(quoted) string, to avoid conflicts with YAML base-60 float." YAML's legacy
base-60 number syntax means a bare `HH:MM`-shaped value can be parsed as a number
rather than a string. The failure is not a syntax error — it is a port mapping that
is silently the wrong number.

**Always quote the whole mapping.** It costs two characters and removes the class
of bug entirely.

## Quote your boolean-looking values

```yaml
environment:
  DEBUG: "true"          # ✅ the string "true"
  FEATURE_X: "no"        # ✅ the string "no"
  LEGACY: true           # ⚠️ a YAML boolean
```

Again from the documentation: "Any boolean values; true, false, yes, no, should be
enclosed in quotes to ensure they are not converted to True or False by the YAML
parser." An environment variable is a string by definition, so the parser
converting `true` to a boolean and back hands your process `True` — capital T —
which an `=== 'true'` check will not match.

The same hazard covers `yes`, `no`, `on`, `off`, and version-like values such as
`1.10`, which loses its trailing zero as a float.

## Two shapes for the same thing

`environment` accepts a map or a list, and they are equivalent:

```yaml
environment:
  NODE_ENV: production
  PORT: "3000"

environment:
  - NODE_ENV=production
  - PORT=3000
```

Pick the **map** form and stay with it. It quotes naturally, it is what the merge
key needs (below), and it makes overrides in a second file behave predictably
rather than concatenating lists ([page 11](../11-override-files.md)).

## Fragments: anchors, aliases and merge

YAML's own reuse mechanism, supported fully — "Compose follows the rule outlined by
YAML merge type".

**Anchors and aliases.** "Anchors are created using the `&` sign. The sign is
followed by an alias name. You can use this alias with the `*` sign later to
reference the value following the anchor."

```yaml
volumes:
  db-data: &default-volume
    driver: default
  metrics: *default-volume
```

**The merge key** takes the anchored mapping and lets you override parts of it:

```yaml
volumes:
  db-data: &default-volume
    driver: default
    name: "data"
  metrics:
    <<: *default-volume
    name: "metrics"
```

🔴 **The limitation that decides your house style:** "YAML merge only applies to
mappings, and can't be used with sequences." So `environment` written as a list of
`- FOO=BAR` strings **cannot** be merged, and `environment` written as a map can.
That is the concrete reason to prefer the map form everywhere.

## `x-` extension fields

The place to put the reusable block that anchors need a home for:

```yaml
x-env: &env
  environment:
    CONFIG_KEY: value
    EXAMPLE_KEY: value

services:
  first:
    <<: *env
    image: my-image:latest
  second:
    <<: *env
    image: another-image:latest
```

Use "the prefix `x-` as a top-level element to modularize configurations that you
want to reuse", and note the guarantee that makes it safe: "Compose ignores any
fields that start with `x-`, this is the sole exception where Compose silently
ignores unrecognized fields."

Read that twice, because the corollary is the useful half: **every other
unrecognised key is an error, not a silent no-op.** A typo like `enviroment:` is
caught. That is a good property, and it is exactly why `x-` needs its own explicit
exemption.

Extensions are not limited to the top level — they "can be used within any
structure in a Compose file where user-defined keys are not expected", so a
per-service `x-` note is legal too.

## `docker compose config` is the arbiter

The file you wrote is not the file Compose runs. Interpolation, override merging,
profiles, `include` and defaults all happen first. One command shows the result:

```bash
docker compose config                 # the fully resolved file
docker compose config --services      # just the service names
docker compose config --volumes       # just the volume names
docker compose --profile debug config # resolved with a profile enabled
```

Make this the first command you run whenever the answer to "why is it doing that"
is not obvious. It settles interpolation, merge and profile questions in one step,
and it starts nothing. It is the same role `docker inspect` plays for a running
container
([Phase 1, page 03](../../phase-1-running-containers/03-ps-inspect-logs-stats.md)):
the arbiter when the file and your belief disagree.

## Podman

Identical, because none of this is Compose's doing — it is the YAML parser, and
both providers parse YAML the same way. The quoting rules, the merge-key limitation
and the `x-` exemption apply whichever provider `podman compose` delegates to.
`docker compose config` has no direct `podman compose` equivalent beyond whatever
the provider offers, so with `podman-compose` you may be reading the provider's own
rendering rather than Compose's canonical form.

## Gotchas

**Symptom:** A service is published on a port nobody asked for, and the file
clearly says otherwise.
**Cause:** An unquoted `HOST:CONTAINER` mapping parsed as a YAML base-60 float.
**Fix:** Quote the whole mapping — `"8000:8000"`. Confirm with
`docker compose config`, which shows the value after parsing.

**Symptom:** The application sees the string `True` where the file says `true`.
**Cause:** The YAML parser converted the unquoted boolean, and it was stringified
on the way into the environment.
**Fix:** Quote boolean-looking environment values, and the same for
`yes`/`no`/`on`/`off` and version numbers like `1.10`.

**Symptom:** `<<: *env` fails, or quietly produces nothing.
**Cause:** The anchored value is a sequence, and YAML merge only applies to
mappings.
**Fix:** Rewrite `environment` — and anything else you intend to merge — in the
`KEY: value` map form. Sequences cannot be merged, only replaced.

**Symptom:** A key you added is having no effect and Compose reports no error.
**Cause:** Almost certainly a typo — but check whether it begins with `x-`, because
that is the one prefix Compose ignores silently.
**Fix:** `docker compose config` and look for the key in the rendered output. If it
is absent, it was never understood.

## Interview questions

**★ Why do you quote `"8000:8000"` in `ports:`?**
Because an unquoted `HOST:CONTAINER` can be parsed as a YAML base-60 float. The
documentation says the mapping "should always be specified as a (quoted) string".
The failure mode is the dangerous kind — not a parse error, but a silently wrong
port. The same reflex applies to boolean-looking environment values, which YAML
converts to `True`/`False`.

**★ How do you avoid repeating the same block across several services?**
YAML fragments: define it once under an `x-` extension field, anchor it with `&`,
and pull it in with the merge key `<<: *anchor`, overriding whatever differs.
Compose ignores `x-` keys — the only unrecognised keys it ignores — so the block is
a safe place to keep it. Merge works on mappings only, so write `environment` as a
map rather than a list.

**★ What does `docker compose config` do, and when do you reach for it?**
It parses, resolves and renders the file in canonical form — after interpolation,
override merging, `include` and profile selection. Reach for it any time the
running behaviour and the file you wrote seem to disagree, because it shows the
file Compose actually acts on, and it starts nothing.

**Are unknown keys in a Compose file ignored?**
No, and that is deliberate — a misspelled key is an error. The single exception is
any key beginning with `x-`, which Compose silently ignores so extension fields can
exist. That is why a typo like `enviroment:` gets caught instead of quietly doing
nothing.

**Map form or list form for `environment`?**
Map form, `KEY: value`. It quotes naturally, it merges (sequences cannot be merged
with `<<`), and it overrides predictably across multiple files instead of
concatenating. The list form is not wrong, but it forecloses both of those.

---

← Prev: [The Specification and the file](01-the-spec-and-the-file.md) · Topic index: [compose.yaml and the Spec](README.md) · Next → [up, down and the lifecycle](../03-up-and-down.md)
