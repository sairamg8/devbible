---
title: "Configuration and secrets at run time"
sidebar_label: "05 · Configuration and secrets at run time"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against [docker container run — environment](https://docs.docker.com/reference/cli/docker/container/run/),
> the [Compose file reference — secrets](https://docs.docker.com/reference/compose-file/secrets/),
> [Compose — how to use secrets](https://docs.docker.com/compose/how-tos/use-secrets/)
> (*"Secrets are mounted as a file in `/run/secrets/<secret_name>` inside the container"*),
> [Compose — environment variables precedence](https://docs.docker.com/compose/how-tos/environment-variables/envvars-precedence/)
> and [podman-run(1) — `--secret`](https://docs.podman.io/en/latest/markdown/podman-run.1.html)
> (`type=mount` default target `/run/secrets/secretname`, `mode` defaults to `0444`; `type=env`).
> **No sandbox** — no console output on this page.

**"It is not in the image" and "it is not in the process list" are two different
claims, and most secret handling only makes the first one.** Keeping a password
out of a layer is the easy half; keeping it out of `docker inspect`, `/proc`,
child processes and your error tracker is the half that decides whether the
secret is actually secret.

## Two problems wearing one name

| | Configuration | Secrets |
|---|---|---|
| Examples | log level, feature flags, the database **host** | the database **password**, API keys, signing keys |
| Changes per | environment | environment, **and on rotation** |
| Acceptable in the environment? | **Yes** | Only when nothing better exists |
| Acceptable in the image? | Only as a default | **Never** |

The same image must run in dev, staging and production without a rebuild — that
is Phase 12's "one image, three environments", and it is why configuration comes
from outside. The mistake is treating both halves of this table identically
because they arrive by the same mechanism.

## Environment variables: how they get in

```bash
docker run -e LOG_LEVEL=debug -e DB_HOST=db myimage
docker run --env-file ./prod.env myimage          # line-delimited KEY=VALUE
docker run -e DB_HOST myimage                     # pass through from the host's env
```

```yaml
services:
  api:
    environment:
      LOG_LEVEL: debug
      DB_HOST: db
    env_file:
      - ./prod.env
```

Later sources win over earlier ones, and the image's own `ENV` is the weakest —
it is a default, not a setting
([Phase 3 — ENV versus ARG](../phase-3-dockerfile/07-env-vs-arg.md)).

### The `.env` confusion, which everyone hits once

Compose has two unrelated things that both look like "the env file":

| | `.env` in the project directory | `env_file:` in a service |
|---|---|---|
| Read by | **Compose itself** | The **container** |
| Used for | interpolating `${VAR}` **into `compose.yaml`** | setting variables **inside the process** |
| Visible to the app? | Only if you also pass it through | Yes |

So `${DB_HOST}` inside `compose.yaml` comes from `.env`; `DB_HOST` inside your
application comes from `environment:` or `env_file:`. `docker compose config`
renders the file with interpolation applied — which is the fastest way to see
what Compose actually thinks it is running, and ⚠️ **it prints secrets in the
clear**, so it is not a command to paste into a ticket.

## Why the environment is a poor place for a secret

Compose's own documentation is blunt about it: *"If you're injecting passwords
and API keys as environment variables, you risk unintentional information
exposure"* — they are *"often available to all processes"* and *"can also be
printed in logs when debugging errors without your knowledge."* Concretely, in a
container:

- **`docker inspect` shows them.** `.Config.Env` carries every variable, so
  anyone with access to the daemon — which is root-equivalent access to the host
  — reads them without entering the container.
- **`/proc/<pid>/environ` shows them** to any process running as the same user
  inside the container.
- **Every child process inherits them**, including a shelled-out `curl` whose
  own command line ends up somewhere else.
- **Crash reporters and error trackers attach the environment** to reports by
  default. That is the leak nobody chooses.
- **A startup line that logs the configuration** dumps the lot into the log
  pipeline, where it is copied, indexed and retained
  ([04 · Logs](04-logs-to-stdout/02-logs-a-machine-can-read.md)).

None of these are exotic. They are the default behaviour of ordinary tools.

## Files are the better shape

```yaml
services:
  api:
    secrets: [db_password]
secrets:
  db_password:
    file: ./secrets/db_password.txt     # or: environment: DB_PASSWORD
```

The file lands at **`/run/secrets/db_password`** inside the container. That
single change fixes most of the list above: it is not in `.Config.Env`, not in
`/proc/<pid>/environ`, not inherited by children as a variable, and not swept up
by a crash reporter.

```bash
podman run --secret db_password myimage
podman run --secret db_password,type=env,target=DB_PASSWORD myimage
```

Podman's `--secret` defaults to `type=mount` at `/run/secrets/<name>` with mode
`0444`, and `target=`, `uid=`, `gid=` and `mode=` are available. ⚠️ **The
default `0444` is world-readable inside the container** — set `mode=0400` with a
matching `uid` when the container runs more than one user, and pair it with
running as non-root ([Phase 3 — USER](../phase-3-dockerfile/09-user.md)).

⚠️ **`docker secret` is a Swarm command and needs a swarm.** Compose's
file-based secrets above work with a plain `docker compose up`, which is what
makes them usable on a single host.

### Reading a secret from a file in the application

The convention the official images established is a `_FILE` suffix — Postgres and
MySQL images accept `POSTGRES_PASSWORD_FILE` alongside `POSTGRES_PASSWORD` — and
it is worth copying, because it lets one image serve both worlds:

```js
const read = (name) => {
  const p = process.env[`${name}_FILE`];
  return p ? fs.readFileSync(p, 'utf8').trim() : process.env[name];
};
const dbPassword = read('DB_PASSWORD');
```

The `.trim()` is not decoration: a secret file written by a human almost always
ends with a newline, and the resulting authentication failure gives no hint of
why.

## Rotation is the requirement nobody plans for

**An environment variable cannot change while the container runs.** Rotating a
credential means recreating the container, which is a deploy — so rotation is
coupled to release, which is why it does not happen.

A file can change underneath a running process when its source is a bind mount or
a platform-managed mount. That only helps if the application **re-reads** it:
reading the secret once at startup into a module-level constant gives up the
advantage. Read it when you build the connection, and reconnect when
authentication fails.

🔴 **And the rule that overrides all of this: if a secret has ever been in an
image layer, a build argument, a log line or a git history, rotate it.**
Rebuilding, deleting the line or force-pushing does not unpublish it. That is the
same conclusion Phase 3 reached about `ARG`
([ENV versus ARG](../phase-3-dockerfile/07-env-vs-arg.md)) and Phase 4 reaches
about build secrets — the run-time story here is the third visit.

## Where the values come from before they reach the container

Three shapes, in increasing order of how much they cost to run:

| Shape | How it works | Trade |
|---|---|---|
| Files on the host | A directory the deploy writes, mounted read-only | Simple; the host is now the thing to protect |
| Platform-injected | The orchestrator or systemd credential mechanism materialises a file | No secret in your deploy tooling; ties you to the platform |
| Fetched at start | The container authenticates to a secret manager and pulls | Best rotation story; needs an identity the container can prove, which is the hard part |

All three end with a file the process reads. The interesting difference is what
proves the container is allowed to have it — which is the same question CI has
to answer when it pushes an image, and it is picked up in Phase 12.

## Podman

The mechanics match, with one genuinely different option: `podman secret create`
manages secrets locally without a swarm, and `--secret` consumes them as a mount
or as an environment variable. Under **Quadlet** (Phase 11) the systemd
`LoadCredential=` mechanism is the more idiomatic route on a single host, because
it keeps the secret out of the unit file and out of the environment. The rootless
caveat that matters here is ownership: a mounted secret's `uid`/`gid` are
interpreted inside the container's user namespace, so a `uid=` that looks right
from the host will not be the one the process sees.

## Gotchas

**Symptom:** A password is not in the image, and it is visible in
`docker inspect`.
**Cause:** It was passed with `-e` or `environment:`, and `.Config.Env` records
exactly that.
**Fix:** A mounted secret at `/run/secrets/…`, read from the file. "Not in the
image" was never the same claim as "not visible".

**Symptom:** Authentication fails with a secret file that looks correct.
**Cause:** A trailing newline in the file.
**Fix:** `.trim()` when reading — and prefer generating secret files
programmatically over editing them by hand.

**Symptom:** `${DB_HOST}` is empty in the container although `.env` sets it.
**Cause:** `.env` feeds interpolation **into `compose.yaml`**, not variables into
the container.
**Fix:** Reference it under `environment:` (`DB_HOST: ${DB_HOST}`) or use
`env_file:`. `docker compose config` shows which one you actually got.

**Symptom:** Secrets appear in an error-tracking service that nobody configured
to collect them.
**Cause:** Most crash reporters attach the process environment to reports by
default.
**Fix:** Get the secrets out of the environment, and add an allow-list to the
reporter. Then rotate everything that was already sent.

## Interview questions

**★ Why are environment variables a poor place for secrets in a container?**
Because they are readable from `docker inspect`'s `.Config.Env` by anyone with
daemon access, from `/proc/<pid>/environ` inside the container, and are inherited
by every child process — and crash reporters and startup "log the config" lines
ship them without being asked. Keeping a secret out of the image is a different
claim from keeping it out of the process list.

**★ What does a Compose secret actually do?**
It makes the value available as a **file** inside the container, at
`/run/secrets/<secret_name>`, sourced from a file on the host or from a host
environment variable. The application reads the file, so the value never enters
the container's environment — and unlike `docker secret`, it needs no swarm.

**★ A credential leaked into a built image. What do you do?**
Rotate it. Rebuilding the image, deleting the layer or rewriting git history does
not unpublish anything that was already pulled or cloned; only invalidating the
credential does. Then fix the mechanism — a build secret mount rather than an
`ARG`, a mounted file rather than an environment variable.

**What is the difference between Compose's `.env` and a service's `env_file:`?**
`.env` is read by Compose to interpolate `${VAR}` into `compose.yaml`;
`env_file:` sets variables inside the container's process. They are unrelated,
and `docker compose config` renders the first so you can see what was actually
substituted — while printing every secret in the clear.

**How do you rotate a secret without redeploying?**
Deliver it as a file and re-read it when you use it, rather than caching it at
startup. An environment variable cannot change for a running process at all, so
rotation becomes a deploy — which is the practical reason environment-delivered
secrets do not get rotated.

**Why does a secret file often fail authentication when a variable with the same
value works?**
A trailing newline. Editors add one, and the value read from the file is one
character longer than the value that was typed. Trim on read.

---

← Prev: [Logs go to stdout and stderr](04-logs-to-stdout/README.md) · Index: [Phase 10](README.md) · Next → **The production failure catalogue** *(not written yet)*
