---
title: "exec versus run"
sidebar_label: "04 · exec versus run"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against [docker container exec](https://docs.docker.com/reference/cli/docker/container/exec/),
> [docker container run](https://docs.docker.com/reference/cli/docker/container/run/)
> and [podman-exec(1)](https://docs.podman.io/en/latest/markdown/podman-exec.1.html).
> **No sandbox** — no console output on this page.

**`exec` runs a command inside a container that already exists. `run` creates a
brand-new container.** Confusing them produces the single most common false
conclusion in container work: *"my changes disappeared."*

## The distinction

| | `docker exec` | `docker run` |
|---|---|---|
| Acts on | An **existing, running** container | The **image** |
| Creates a container? | No | Yes, a new one every time |
| Shares state with the app? | **Yes** — same filesystem, same network namespace | No — separate everything |
| Container must be running? | Yes | n/a |
| Typical use | Look inside a live service | Start something new |

```bash
# Look inside the API that is running right now
docker exec -it api sh

# Start a SECOND, unrelated container from the same image
docker run -it --rm myorg/api:1.4.2 sh
```

Both give you a shell. Only the first one is inside the container serving your
traffic. If you `exec` in, edit a config file and restart the process, you have
changed the live container. If you `run` a new one, edit the file and exit, you
changed a container that then ceased to exist.

## When you want `exec`

- Inspect the live filesystem: `docker exec api ls -la /app/uploads`
- Check the environment the process actually has:
  `docker exec api env`
- Query the database in its own container:
  `docker exec -it db psql -U postgres appdb`
- See processes *as the container sees them*: `docker exec api ps aux`
- Test DNS and connectivity from inside the container's network namespace:
  `docker exec api getent hosts db`

That last one deserves emphasis. **`exec` runs in the container's network
namespace**, so it is how you answer "can the API reach the database?" honestly —
from where the API actually stands, not from your host.

## When you want `run`

- A one-shot task from the same image: `docker run --rm myorg/api:1.4.2 npm run migrate`
- Trying a different image version alongside the current one
- A throwaway shell to explore an image you have not started yet
- A utility container: `docker run --rm -it --network app-net nicolaka/netshoot`

## The flags

```bash
docker exec -it api sh                    # interactive shell
docker exec api ls /app                   # non-interactive, prints and exits
docker exec -u root api apk add curl      # as root, even if the app runs non-root
docker exec -w /app api pwd               # a different working directory
docker exec -e DEBUG=1 api node script.js # extra env for this command only
```

`-u root` is the one to remember. Well-built images run as a non-root user, so a
debugging shell often cannot install a tool or read a root-owned file. `exec -u
root` gets you in without changing how the service runs.

⚠️ **`exec -u root` will not work if the engine cannot grant it** — under
rootless Podman "root" is still your mapped user, and on a hardened setup the
capability may be gone. The failure is honest; it is not a bug.

## What `exec` does not do

- **It does not restart the application.** Editing a config file with `exec`
  changes the file; the running process still holds the old configuration until
  it re-reads it or restarts.
- **It does not survive the container.** Anything installed or written lands in
  the writable layer and dies with `docker rm`
  ([Phase 0, page 04](../phase-0-what-a-container-is/04-image-vs-container.md)).
- **It does not run if the container is stopped.** For a container that exits
  immediately there is nothing to exec into — use
  `docker run --rm -it --entrypoint sh <image>` to explore the image instead
  (page 11).

## Podman

`podman exec` matches `docker exec` flag for flag. The one thing worth knowing:
in a **pod**, containers share the network namespace, so `podman exec` into any
of them sees the same network view — which is a genuine convenience when
debugging (Phase 11).

## Gotchas

**Symptom:** "I installed a package with `exec` and after a redeploy it was
gone."
**Cause:** It went into the container's writable layer, which is discarded when
the container is replaced.
**Fix:** Put it in the Dockerfile. `exec` is for diagnosis; the image is for
configuration.

**Symptom:** `docker exec` fails with "container not running".
**Cause:** The container exited — often instantly.
**Fix:** `docker ps -a` and `docker logs` to find out why. To poke at the image
itself, `docker run --rm -it --entrypoint sh <image>`.

**Symptom:** `exec -it api sh` fails with "executable file not found".
**Cause:** The image has no `sh` — distroless and `scratch` images have no shell
at all.
**Fix:** Try `bash`; if there is genuinely no shell, debug from outside with
`nsenter` on the host PID, or attach a debug container sharing the target's
namespaces. Phase 10.

**Symptom:** You edited a config file with `exec` and nothing changed.
**Cause:** The process read its configuration at startup.
**Fix:** Restart the container. And then move the change into the image or a
mounted config, because the edit will not survive replacement.

## Interview questions

**★ What is the difference between `docker exec` and `docker run`?**
`exec` runs a command inside an existing running container, sharing its
filesystem and namespaces. `run` creates a new container from an image. Using
`run` when you meant `exec` gives you a shell in a *different* container, which
is why "my change disappeared".

**★ How do you check whether one container can reach another?**
`docker exec` into the source container and resolve or connect from there —
`getent hosts db`, or a request to the service. Testing from the host proves
nothing about the container's network namespace.

**★ Your image runs as a non-root user and you need to install a debug tool.
What do you do?**
`docker exec -u root <container> …` for the moment, understanding that it is
temporary and dies with the container. If it is needed repeatedly, build a debug
image or a debug stage rather than making the production image bigger.

**Can you `exec` into a stopped container?**
No — `exec` needs a running process to join. Use `docker run` against the image
to explore its contents, and `docker logs` plus the exit code to work out why it
stopped.

**How do you get a shell in an image that has no shell?**
You cannot from inside. Debug from the host with `nsenter` against the
container's PID, or start a debug container that shares the target's namespaces.
This is the trade you accept with distroless images.

---

← Prev: [ps, inspect, logs and stats](03-ps-inspect-logs-stats.md) · Index: [Phase 1](README.md) · Next → [Publishing ports](05-publishing-ports.md)
