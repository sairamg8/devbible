---
title: "How it is wired: environment, ports, volumes, restart"
sidebar_label: "02 · How it is wired"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against
> [the `services` top-level element](https://docs.docker.com/reference/compose-file/services/)
> — the `environment`, `env_file`, `ports`, `volumes` and `restart` attributes.
> **No sandbox** — no console output on this page.

**Four keys connect a service to the rest of the world, and each has a default that
is more permissive or more surprising than people expect.** Publishing binds every
interface. `restart` does nothing about a wedged process. Volumes come in two
shapes that look alike and are not.

## `environment` and `env_file`

```yaml
services:
  api:
    env_file:
      - .env
      - .env.local
    environment:
      NODE_ENV: production
      DATABASE_URL: postgres://postgres:dev@db:5432/app
```

`env_file` "is used to specify one or more files that contain environment variables
to be passed to the containers", and the precedence rule is simple: **"When both
`env_file` and `environment` are set for a service, values set by `environment` have
precedence."**

Two things to carry from Phase 1 without re-deriving:

- **Environment is not a secret store.** Anyone who can run `inspect` can read it
  ([Phase 1, page 06](../../phase-1-running-containers/06-environment.md)).
- **Quote boolean-looking values.** `DEBUG: true` becomes `True`
  ([page 02](../02-compose-yaml-and-the-spec/02-yaml-that-bites.md)).

⚠️ **`env_file` and the project's `.env` are different mechanisms** and confusing
them is the most common environment bug in Compose. One passes variables *into the
container*; the other supplies values for `${...}` *interpolation in the file
itself*. [Page 10](../10-environment-and-interpolation.md) is the full treatment,
and it is worth reading before you debug an empty variable.

## `ports`

```yaml
ports:
  - "3000"                    # container 3000 → a random host port
  - "8000:8000"               # host 8000 → container 8000
  - "127.0.0.1:8001:8001"     # bound to loopback only
  - "6060:6060/udp"
```

Short syntax is `[HOST:]CONTAINER[/PROTOCOL]`, where `HOST` may be `[IP:]port` or a
range, `CONTAINER` a port or range, and `PROTOCOL` defaults to `tcp`. "`HOST` and
`CONTAINER` must use equivalent ranges."

🔴 **The default binds everything, and the documentation warns about it directly:**
"If you do not specify a host IP (such as `127.0.0.1`), Docker binds to all
interfaces (`0.0.0.0`), bypassing host firewall rules."

That is the same behaviour Phase 1 traced to Docker's nat-table rules being applied
before `ufw`'s INPUT chain
([Phase 1, page 05](../../phase-1-running-containers/05-publishing-ports.md)). On a
laptop on a café network, `"5432:5432"` on a Postgres service is an exposed database.
**Bind development databases to `127.0.0.1` explicitly.**

The long syntax exists when the short one cannot say what you mean:

```yaml
ports:
  - name: web
    target: 3000
    published: "8080"
    host_ip: 127.0.0.1
    protocol: tcp
    app_protocol: http
```

| Field | Meaning |
|---|---|
| `target` | The container port |
| `published` | The publicly exposed port; may be a `start-end` range |
| `host_ip` | Host IP to bind. Defaults to all interfaces (`0.0.0.0`) |
| `protocol` | `tcp` or `udp`, default `tcp` |
| `app_protocol` | Informational — what the port speaks |
| `mode` | `host` or `ingress` for Swarm. Default `ingress` |
| `name` | Human-readable documentation |

⚠️ **"Port mapping must not be used with `network_mode: host`. Doing so causes a
runtime error because `network_mode: host` already exposes container ports directly
to the host network."**

**And the point that saves the most confusion:** services on the same Compose
network reach each other by name on the container port with **no `ports:` at all**
([page 07](../07-networks.md)). Publishing is only for traffic entering from
outside. Most of the `ports:` entries in real compose files are unnecessary, and
each one is a small hole in the host.

## `volumes`

Two syntaxes, and the short one is doing more than it looks.

```yaml
volumes:
  - pgdata:/var/lib/postgresql          # named volume
  - ./src:/app/src                      # bind mount (the leading ./ is the tell)
  - /app/node_modules                   # anonymous volume
  - ./config:/etc/app:ro                # read-only bind mount
```

The short syntax is "a single string with colon-separated values to specify a volume
mount (`VOLUME:CONTAINER_PATH`), or an access mode
(`VOLUME:CONTAINER_PATH:ACCESS_MODE`)". **Whether the first field is a named volume
or a bind mount is decided by whether it looks like a path** — which is exactly the
sort of implicit rule that makes a typo silently create something you did not want.

The long syntax "lets you configure additional fields that can't be expressed in the
short form", including `type`, `source`, `target`, `read_only`, `bind`, `volume`,
`tmpfs` and `consistency`:

```yaml
volumes:
  - type: bind
    source: ./src
    target: /app/src
  - type: volume
    source: pgdata
    target: /var/lib/postgresql
```

**Prefer the long syntax in anything shared or long-lived.** It states the intent
rather than implying it, and it is the Compose equivalent of preferring `--mount`
over `-v` — the short form quietly creates a directory where the long form errors.
Full treatment in [page 08](../08-volumes.md); the storage mechanics themselves are
**Phase 6 · Storage** *(not written yet)*.

Anything you name here must also appear under the top-level `volumes:` key, or
Compose does not know to create it.

## `restart`

Four values, quoted from the documentation:

| Value | Meaning |
|---|---|
| `"no"` | "The default restart policy. It does not restart the container under any circumstances." |
| `always` | "The policy always restarts the container until its removal." |
| `on-failure[:max-retries]` | "The policy restarts the container if the exit code indicates an error. Optionally, limit the number of restart retries." |
| `unless-stopped` | "The policy restarts the container irrespective of the exit code but stops restarting when the service is stopped or removed." |

⚠️ **Quote `"no"`.** Unquoted, YAML reads it as the boolean `false` — the same
class of bug as unquoted ports
([page 02](../02-compose-yaml-and-the-spec/02-yaml-that-bites.md)).

**A restart policy is not a healthcheck.** It reacts to the process *exiting*, and
does nothing at all about a process that is running but wedged — deadlocked, out of
connections, serving 500s. That distinction is the recurring "Docker reports;
something else must act" thread from
[Phase 1, page 12](../../phase-1-running-containers/12-restart-policies.md), and it
is why [page 06](../06-healthchecks/README.md) exists.

`always` and `unless-stopped` differ in exactly one scenario: after you manually
stop a container and then reboot, `always` brings it back and `unless-stopped` does
not. For a development stack `unless-stopped` is usually what you want.

## Podman

Two divergences already established, both relevant here:

- **Rootless privileged ports.** `"80:80"` fails as an ordinary user unless
  `net.ipv4.ip_unprivileged_port_start` has been lowered. Publish 8080 in
  development and terminate 80 somewhere else.
- **No daemon to re-assert restart policies.** `restart: always` does not survive a
  reboot under rootless Podman without `loginctl enable-linger` and a systemd unit
  ([Phase 1, page 12](../../phase-1-running-containers/12-restart-policies.md)).
  Do not read `restart:` in a compose file as "this comes back after a reboot" on
  Podman — **Phase 11 · Podman in depth** *(not written yet)* is where Quadlet
  answers it properly.

Bind mounts on SELinux systems still need `:z` or `:Z`, and that applies to the
Compose short syntax's access-mode field just as it does to `-v`
([Phase 0, page 10](../../phase-0-what-a-container-is/10-seccomp-apparmor-selinux.md)).

## Gotchas

**Symptom:** A development database was reachable from the network.
**Cause:** `"5432:5432"` binds `0.0.0.0`, and the documentation notes this bypasses
host firewall rules.
**Fix:** `"127.0.0.1:5432:5432"`. Better still, delete the mapping — other services
reach it by name without it.

**Symptom:** `restart: no` behaves as though it were not set.
**Cause:** Unquoted, YAML parses `no` as the boolean `false`.
**Fix:** Quote it — `restart: "no"`.

**Symptom:** A container keeps restarting even though the application is broken in a
way restarting cannot fix.
**Cause:** `restart: always` reacts to exit codes, not to correctness.
**Fix:** Cap it with `on-failure:3` while debugging, and read the logs of the failed
container before it disappears. A crash loop shows in `docker compose ps` as
`Restarting (n)`.

**Symptom:** A volume line created an unexpected empty directory instead of mounting
what you meant.
**Cause:** Short-syntax volumes decide "named volume or bind mount" by inspecting the
string.
**Fix:** Use the long syntax with an explicit `type:`, and declare named volumes
under the top-level `volumes:` key.

**Symptom:** `ports:` with `network_mode: host` errors at runtime.
**Cause:** They are mutually exclusive — host networking already exposes the ports.
**Fix:** Remove the `ports:` block. With host networking there is nothing to publish.

## Interview questions

**★ What does `"8000:8000"` bind to, and why is that a problem?**
Host `0.0.0.0` port 8000 — every interface. The documentation warns that without an
explicit host IP, Docker binds all interfaces and bypasses host firewall rules, so a
published development database is reachable from any network the machine is on. The
fix is `"127.0.0.1:8000:8000"`, or removing the mapping entirely, since services on
the same Compose network do not need it.

**★ Do two services in the same compose file need `ports:` to talk to each other?**
No. They share the project's default network and reach each other by service name on
the container port. `ports:` is only for traffic entering from outside the container
network — so most published ports in a typical compose file are there for a human
with a browser or a `psql`, not for the application.

**★ What is the difference between `restart: always` and `restart: unless-stopped`?**
Only one scenario separates them: after a manual stop followed by a reboot, `always`
starts the container again and `unless-stopped` respects that you stopped it.
Neither does anything about a container that is running but wedged — a restart
policy reacts to exit, never to health.

**Which wins, `environment` or `env_file`?**
`environment`. The documentation is explicit that when both are set, values in
`environment` take precedence. And neither is a secret mechanism — both are readable
with `inspect`.

**What is the difference between the short and long `volumes` syntax?**
The short form is one colon-separated string and infers whether the source is a
named volume or a bind mount from how it looks. The long form states `type`,
`source`, `target` and options explicitly. Prefer the long form for anything shared,
for the same reason `--mount` is preferred over `-v`.

**Why does `restart: no` sometimes appear to be ignored?**
Because unquoted `no` is a YAML boolean, not the string `"no"`. Quote it. It is the
same parsing hazard as unquoted port mappings.

---

← Prev: [What runs](01-what-runs.md) · Topic index: [The services block](README.md) · Next → [depends_on and readiness](../05-depends-on.md)
