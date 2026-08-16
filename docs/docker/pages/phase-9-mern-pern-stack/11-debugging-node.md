---
title: "Debugging Node inside a container"
sidebar_label: "11 · Debugging Node inside a container"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against
> [the Node.js CLI reference](https://nodejs.org/api/cli.html)
> (`--inspect`, `--inspect-brk`, `--inspect-wait`, `--enable-source-maps`,
> `--disable-sigusr1`, `NODE_OPTIONS`),
> [the Node.js debugging guide](https://nodejs.org/en/learn/getting-started/debugging),
> [the Compose `services` element](https://docs.docker.com/reference/compose-file/services/) and
> [Merge Compose files](https://docs.docker.com/compose/how-tos/multiple-compose-files/merge/).
> **No sandbox** — no console output on this page.

**The debugger port is remote code execution with a nice UI, and Node's own
documentation says so.** Everything on this page follows from that one fact: the
inspector is easy to switch on, and the entire skill is delivering it to your
editor without leaving it reachable by anything else.

## The two facts in tension

**One.** *"By default the inspector listens at 127.0.0.1:9229."* Inside a
container, `127.0.0.1` is *that container* — so a published `9229` reaches nothing
at all. It is the identical trap to Vite's `server.host` in
[topic 05](05-hot-reload/02-making-it-noticed.md) and to
[phase 7's `localhost` page](../phase-7-networking/03-localhost-is-the-container.md).

**Two.** Binding it wider is documented as dangerous, in unusually blunt terms:

> *"Binding the inspector to a public IP (including `0.0.0.0`) with an open port is
> insecure, as it allows external hosts to connect to the inspector and perform a
> remote code execution attack."*

and

> *"Since the debugger has full access to the Node.js execution environment, a
> malicious actor able to connect to this port may be able to execute arbitrary
> code on behalf of the Node.js process."*

🔴 **The resolution is that a container gives you a second boundary the guide's
readers do not have.** Node's own advice for remote debugging is *"we recommend the
use of ssh tunnels instead"* — and the container equivalent is to bind `0.0.0.0`
**inside the container's network namespace** while publishing the port only to the
host's loopback:

```yaml
# compose.override.yaml — development only
services:
  api:
    command: ["node", "--inspect=0.0.0.0:9229", "dist/index.js"]
    ports:
      - "127.0.0.1:9229:9229"
```

The `0.0.0.0` is scoped to a namespace nothing else is on. The published mapping is
what decides who can reach it, and `127.0.0.1:` there is not decoration — **without
a host IP Docker binds `0.0.0.0`**, which the documentation itself flags as
*"bypassing host firewall rules"*, and you have published a remote-code-execution
endpoint to the café wifi.

The docs' own condition is satisfied either way: *"the host is not accessible from
public networks"*, or *"a firewall disallows unwanted connections on the port"*.

## Which flag

| Flag | Documented behaviour |
|---|---|
| `--inspect[=[host:]port]` | *"Activate inspector on `host:port`. Default is `127.0.0.1:9229`"* — the process runs normally |
| `--inspect-brk` | *"Activate inspector on `host:port` and break at start of user script"* |
| `--inspect-wait` | *"Activate inspector on `host:port` and wait for debugger to be attached"* (v22.2.0 / v20.15.0) |

🔴 **`--inspect-brk` is the one for a container**, when the bug is in startup. The
process pauses before user code runs, which gives you the seconds you need to
attach — otherwise the interesting code has executed before your editor connects.
⚠️ **It also means the container never becomes healthy**, so anything gated on
`condition: service_healthy` will sit and wait. That is expected; it is not a
hung stack.

*"If port `0` is specified, a random available port will be used"* — which is
exactly what you do **not** want here, because a Compose port mapping is fixed.

## Turning it on without restarting

Node starts a debugging session on **`SIGUSR1`** by default — the CLI reference
documents `--disable-sigusr1` as *"Disable the ability of starting a debugging
session by sending a `SIGUSR1` signal to the process"*, which only makes sense
because the ability is there to begin with.

```bash
docker compose exec api kill -SIGUSR1 1
```

That attaches the inspector to the **already running** process, which matters when
the state you want to look at took twenty minutes to reach and a restart would
destroy it.

⚠️ **Two caveats.** The inspector then listens on the default `127.0.0.1:9229` —
inside the container — so a published port still reaches nothing; you need
`--inspect=0.0.0.0` from the start for the port mapping to be useful, or a
namespace-joining sidecar ([Phase 10 · Debugging without a
shell](../phase-10-production/12-debugging-without-a-shell.md)). And the signal goes
to **PID 1**, which is only your Node process if the image uses the exec form
([Phase 10 · PID 1](../phase-10-production/01-pid-1/README.md)).

🔴 **`--disable-sigusr1` is the production hardening**, and it is the reason to know
about the signal at all: without it, anything that can send a signal into the
container can start a debugger in your production process.

## Delivering the flag without changing the command

`NODE_OPTIONS` *"accepts a space-separated list of command-line options"* that
*"appear as if they had been specified on the command line before any command-line
arguments"*, with command-line options taking precedence. So an override can add
the inspector without restating the whole command:

```yaml
services:
  api:
    environment:
      NODE_OPTIONS: --inspect=0.0.0.0:9229 --enable-source-maps
    ports:
      - "127.0.0.1:9229:9229"
```

That is the tidier form when the base file's `command` is long or comes from the
image's `CMD`, and it composes with
[phase 8's override merge rules](../phase-8-compose/11-override-files.md) —
`environment` is a mapping, so it merges by key rather than concatenating.

## Source maps

If anything is transpiled — TypeScript, a bundler — the stack traces point at code
you did not write. `--enable-source-maps` *"enables caching of Source Maps and
makes a best effort to report stack traces relative to the original source file"*.

Two documented caveats worth carrying:

- ⚠️ *"enabling source maps can introduce latency to your application when
  `Error.stack` is accessed"* — so it is not automatically a production default,
  and if your error handler touches `Error.stack` on every request that cost is
  per-request.
- ⚠️ *"Overriding `Error.prepareStackTrace` may prevent `--enable-source-maps` from
  modifying the stack trace"* — some error-reporting libraries do exactly that.

**The other half is a path mapping**, and it is the thing people miss. Your editor
has the source at `/home/you/project` and the process reports `/app`; without a
mapping, breakpoints simply never bind. VS Code names these `localRoot` and
`remoteRoot`:

```json
{
  "type": "node",
  "request": "attach",
  "address": "localhost",
  "port": 9229,
  "localRoot": "${workspaceFolder}",
  "remoteRoot": "/app"
}
```

Other debuggers spell it differently — check your own tool's documentation rather
than assuming these key names. What is universal is that **the mapping has to
exist**, because the container's paths are not your paths.

## This is a development override, and nothing else

The port, the flag and the mapping all belong in `compose.override.yaml`, never in
the base file — the same argument as
[topic 02](02-dev-vs-prod-image.md) and [topic 06](06-secrets-dev-vs-prod.md). The
mechanism that enforces it is documented: **passing any `-f` disables the automatic
`compose.override.yaml`**, so a production `docker compose -f compose.yaml up`
cannot pick up a debug port by accident.

⚠️ **Grep for `9229` before shipping.** An inspector left on in a base file is not
a misconfiguration, it is an unauthenticated remote shell — the debugger has *"full
access to the Node.js execution environment"* and there is no password.

## Podman

Identical. `--inspect` is Node's, the port mapping is the engine's, and both behave
the same. The one thing to remember is
[rootless port publishing](../phase-7-networking/09-privileged-ports-rootless.md):
9229 is above 1024, so nothing special is needed.

## Gotchas

**Symptom:** The debug port is published and the editor cannot connect.
**Cause:** The inspector bound to the default `127.0.0.1`, which inside a container
means that container's own loopback. Nothing outside the namespace can reach it.
**Fix:** `--inspect=0.0.0.0:9229` inside the container, published as
`"127.0.0.1:9229:9229"` — wide inside the namespace, narrow on the host.

**Symptom:** The debugger attaches, but the startup bug has already happened.
**Cause:** `--inspect` does not pause; the process runs while you are still
clicking.
**Fix:** `--inspect-brk`, which breaks at the start of the user script, or
`--inspect-wait`, which waits for an attachment. Expect the container to stay
unhealthy while it is paused, and expect anything gated on `service_healthy` to
wait with it.

**Symptom:** Breakpoints show as unbound and never hit.
**Cause:** No path mapping. The process reports `/app/src/x.js`; the editor has
`/home/you/project/src/x.js` and cannot connect the two.
**Fix:** Configure the local-to-remote root mapping in the attach configuration,
and add `--enable-source-maps` if the code is transpiled.

**Symptom:** A security review finds an open inspector on a production container.
**Cause:** `--inspect` in the base compose file or baked into the image's `CMD`,
rather than in the development override.
**Fix:** Move it to `compose.override.yaml`, which any `-f` invocation ignores, and
set `--disable-sigusr1` in production so the debugger cannot be started by a signal
either.

## Interview questions

**★ Why does `--inspect` need `0.0.0.0` in a container when Node's documentation
tells you not to use it?**
Because the two statements are about different boundaries. Inside a container,
`127.0.0.1` is that container's own loopback, so the inspector's default binding is
unreachable from anywhere — including your editor. Binding `0.0.0.0` makes it
reachable *within the container's network namespace*, which is not the public
internet; what actually decides exposure is the port publication. So you bind wide
inside and publish narrow outside — `"127.0.0.1:9229:9229"` — and the container's
namespace plus the host loopback together do the job Node's docs suggest an SSH
tunnel for.

**★ What is the actual risk of leaving the inspector on?**
Arbitrary code execution, with no authentication. Node's guide states that the
debugger *"has full access to the Node.js execution environment"* and that anyone
able to connect *"may be able to execute arbitrary code on behalf of the Node.js
process"* — and the CLI reference calls `--inspect=0.0.0.0` insecure outright if the
port is not firewall-protected. It is not a debug feature that leaks information;
it is a shell. That is why it belongs in a development override file, which any
`-f` invocation ignores, and why `--disable-sigusr1` exists for production.

**★ How do you start debugging a container that is already running and holding
state you do not want to lose?**
Send it `SIGUSR1` — `docker compose exec api kill -SIGUSR1 1` — which starts a
debugging session in the live process. Two conditions have to hold: PID 1 must
actually be Node, which requires the exec form of `CMD`, and the inspector will
listen on the container's own loopback, so either the process was started with
`--inspect=0.0.0.0` or you reach it from a sidecar sharing the network namespace.
The reason to know the signal exists at all is the flag that disables it,
`--disable-sigusr1`, which is what you want set in production.

**Why do breakpoints not bind even though the debugger connected?**
Almost always a missing path mapping. The debugger receives file paths as the
container sees them — `/app/src/index.js` — while the editor has the same files at a
host path, and without a local-to-remote root mapping it cannot match one to the
other. The second cause is transpiled code without source maps, where the running
file genuinely is not the file you are looking at; `--enable-source-maps` makes a
best-effort mapping back to the original.

**What does `NODE_OPTIONS` buy you here?**
It lets an override add inspector and source-map flags without restating the
service's whole command, since the options *"appear as if they had been specified on
the command line before any command-line arguments"* and the command line still
takes precedence. That keeps the override small and keeps the base file's `command`
as the single description of how the service really runs.

**Is `--enable-source-maps` safe to leave on in production?**
It is safe but not free. The documentation warns it *"can introduce latency to your
application when `Error.stack` is accessed"*, so the cost scales with how often your
code reads a stack — an error handler that formats stacks on every request pays it
every request. It also interacts badly with libraries that override
`Error.prepareStackTrace`. Turning it on is usually worth it for readable
production stack traces; turning it on without knowing either caveat is not.

---

← Prev: [Migrations and seeds](10-migrations-and-seeds.md) · Index: [Phase 9](README.md) · Next → [A React/Vite frontend](12-react-vite-frontend.md)
