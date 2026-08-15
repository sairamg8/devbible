---
title: "Redis in a container"
sidebar_label: "09 · Redis in a container"
sidebar_position: 9
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against
> [the official `redis` image documentation](https://hub.docker.com/_/redis),
> [Redis persistence](https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/),
> [key eviction](https://redis.io/docs/latest/develop/reference/eviction/),
> [Redis `PING`](https://redis.io/docs/latest/commands/ping/) and
> [`docker container run`](https://docs.docker.com/reference/cli/docker/container/run/).
> **No sandbox** — no console output on this page.

**Running Redis is four lines. Deciding whether it should persist is the topic,
and a container makes the wrong answer more expensive than it looks.** Two
questions, in this order: does losing this data make the application *wrong* or
merely *slow*, and does Redis know about the memory limit the container is under.

## The service

```yaml
  cache:
    image: redis:8-alpine
    command:
      - redis-server
      - --save
      - "60"
      - "1"
      - --maxmemory
      - 256mb
      - --maxmemory-policy
      - allkeys-lru
    volumes:
      - cache-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
    networks: [backend]
    restart: unless-stopped
```

The image documentation gives the two facts the file depends on: *"If persistence
is enabled, data is stored in the `VOLUME /data`"*, and `redis-cli` is inside the
image — its own "Connecting via `redis-cli`" example runs
`docker run … redis redis-cli -h some-redis`, so the healthcheck installs nothing.

⚠️ **The `command:` is a list, one token per element.** `--save 60 1` is three
arguments, and writing it as a single string makes it one argument that
`redis-server` cannot parse. This is the same `CMD` versus `CMD-SHELL` distinction
as [phase 8's healthchecks](../phase-8-compose/06-healthchecks/01-the-keys.md), in
a different key.

## Three choices, and the documentation is direct about them

| Mode | How | What you lose |
|---|---|---|
| **None** | `--save ""` and no `appendonly` | everything, on every restart |
| **RDB** (snapshots) | `--save 60 1` | *"the latest minutes of data"* |
| **AOF** (log) | `--appendonly yes` | one second, on the default `appendfsync everysec` |
| **Both** | both of the above | least — and the docs recommend it if you want *"a degree of data safety comparable to what PostgreSQL can provide you"* |

**RDB** *"performs point-in-time snapshots of your dataset at specified
intervals"*. `save 60 1000` means *"automatically dump the dataset to disk every 60
seconds if at least 1000 keys changed"*, into a single `dump.rdb`. It is cheap —
*"the only work the Redis parent process needs to do in order to persist is forking
a child"* — and it is explicitly **not** for minimising loss: *"you should be
prepared to lose the latest minutes of data"*.

**AOF** *"logs every write operation received by the server"*. Its durability knob
is `appendfsync`, with three documented values:

| `appendfsync` | Documented behaviour |
|---|---|
| `always` | *"`fsync` every time new commands are appended to the AOF. Very very slow, very safe"* |
| `everysec` | *"`fsync` every second. Fast enough … and you may lose 1 second of data if there is a disaster"* — *"the suggested (and default) policy"* |
| `no` | *"Never `fsync`, just put your data in the hands of the Operating System"* |

🔴 **With both enabled, AOF wins on restart:** *"In the case both AOF and RDB
persistence are enabled and Redis restarts the AOF file will be used to reconstruct
the original dataset since it is guaranteed to be the most complete."* The docs
also discourage AOF *alone*, *"since to have an RDB snapshot from time to time is a
great idea for doing database backups, for faster restarts, and in the event of
bugs in the AOF engine"*.

⚠️ **Since Redis 7.0 the AOF is a directory, not a file.** *"the original single
AOF file is split into base file (at most one) and incremental files"*, all *"put
in a separate directory"* named by `appenddirname` and tracked by a manifest. That
matters here because a volume or backup script written against a single
`appendonly.aof` will silently capture nothing useful.

🔴 **Switching an existing instance from RDB to AOF is a procedure, not a config
edit.** The documentation's own warning: *"not following this procedure (e.g. just
changing the config and restarting the server) can result in data loss!"* — enable
it with `CONFIG SET appendonly yes` on the live server first, then persist the
configuration.

## The container-specific part: `maxmemory`

🔴 **This is the bit that only bites in a container.** `maxmemory` is *"the maximum
amount of memory to use for the cache data"*, and *"set `maxmemory` to zero to
specify that you don't want to limit the memory for the dataset. **This is the
default behavior for 64-bit systems**"*.

So an unconfigured Redis will happily grow past whatever
[`--memory` limit](../phase-10-production/03-resource-limits/README.md) the
container has, and the kernel kills it — exit 137, `.State.OOMKilled` true, no
Redis log explaining anything. **Redis evicting is graceful; the cgroup killing it
is not.** Set `maxmemory` below the container limit and let Redis do the work.

`maxmemory-policy` decides what it evicts when the limit is reached:

- **`noeviction`** — *"Keys are not evicted but the server will return an error
  when you try to execute commands that cache new data"*. Correct for a datastore,
  wrong for a cache.
- **`allkeys-lru`** — the documentation's rule of thumb: *"a good default option if
  you have no reason to prefer any others"*, for when *"a subset of elements will
  be accessed far more often than the rest"*.
- **`volatile-*`** variants only consider keys with a TTL, and *"behave like
  `noeviction` if no keys have an associated expiration"* — a genuinely surprising
  failure if nothing in the cache sets one.

⚠️ **Set both explicitly.** The eviction reference states the `maxmemory` default
but does not state a default for `maxmemory-policy`, so this page does not name
one — write the policy you want rather than inheriting whatever the image ships.

⚠️ **Leave headroom.** With persistence or replication on, buffered updates are
*"not included in the total that is compared to `maxmemory`"*, and the docs
recommend setting it *"to leave a little RAM free to store the buffers"*. The
container limit therefore has to be comfortably above `maxmemory`, not equal to it.

## A configuration file instead

For anything past two or three flags, mount a file:

```yaml
    volumes:
      - ./redis/redis.conf:/usr/local/etc/redis/redis.conf:ro
      - cache-data:/data
    command: ["redis-server", "/usr/local/etc/redis/redis.conf"]
```

That path is the image's documented location. ⚠️ One caveat straight from the image
docs: *"The mapped directory should be writable, as depending on the configuration
and mode of operation, Redis may need to create additional configuration files or
rewrite existing ones"* — so mounting the **directory** read-only breaks
`CONFIG REWRITE`. Mounting the single file `:ro` and leaving `/data` writable is the
usual compromise.

## The healthcheck

`PING` is the right probe and the reason is documented: it is useful for
*"verifying the server's ability to serve data - an error is returned when this
isn't the case (for example, during load from persistence data or accessing a stale
replica)"*. **A Redis replaying a large AOF accepts the TCP connection and fails
`PING`** — which is exactly the window `condition: service_healthy` covers, and
exactly the window a port check misses.

## So should the cache persist?

The test is one question: **delete the volume and see whether the application is
*wrong* or merely *slow*.**

- **Slow** → it is a cache. Persistence is a warm-start optimisation; `--save 60 1`
  is plenty and losing minutes costs nothing.
- **Wrong** → it is not cache-shaped. Sessions, queues, rate-limit counters and
  idempotency keys all fail this test regularly. Either move them to Postgres, or
  accept that this Redis is a database and configure AOF, backups and a memory
  limit you actually monitor.

🔴 **The dangerous middle is a Redis holding both.** The `volatile-*` policies exist
for it — *"mainly useful when you want to use a single Redis instance for both
caching and for a set of persistent keys"* — and the documentation's own advice is
to avoid the situation: *"you should consider running two separate Redis instances
in a case like this, if possible."*

## Gotchas

**Symptom:** The cache container exits with 137 and no Redis log explains it.
**Cause:** `maxmemory` is unset — zero, the documented 64-bit default — so Redis
grew past the container's memory limit and the kernel killed it.
**Fix:** Set `maxmemory` below the container limit, with headroom for the
persistence buffers that are not counted against it, plus an explicit
`maxmemory-policy`.

**Symptom:** Writes start failing with an error once the cache fills, instead of
old keys disappearing.
**Cause:** The eviction policy is `noeviction`, or a `volatile-*` policy with no
keys carrying a TTL — the docs say those *"behave like `noeviction` if no keys have
an associated expiration"*.
**Fix:** `allkeys-lru` for a genuine cache. If some keys really must not be
evicted, that is a second Redis, which is the documentation's own suggestion.

**Symptom:** The backup script produces an AOF backup that restores nothing.
**Cause:** Redis 7.0+ splits the AOF into a base file plus incremental files in a
directory named by `appenddirname`, tracked by a manifest. A script copying a
single `appendonly.aof` copies a file that no longer exists.
**Fix:** Back up the whole `appenddirname` directory, and disable automatic
rewrites while you do — copying it mid-rewrite *"might end up with an invalid
backup"*.

**Symptom:** AOF was enabled in the compose file and data was lost on the next
restart.
**Cause:** Enabling `appendonly` by editing the configuration and restarting.
The documentation warns that *"not following this procedure … can result in data
loss!"* — the server starts, finds no AOF, and loads an empty one.
**Fix:** On a live instance, `CONFIG SET appendonly yes` first, wait for the
rewrite to finish, then persist the configuration. On a fresh volume in
development, none of this applies — which is why it is only ever discovered in
production.

## Interview questions

**★ Should a Redis cache have a volume?**
Ask what deleting it costs. If the application is merely slow for a minute, the
volume is a warm-start optimisation and RDB snapshots are plenty — the docs are
explicit that with RDB you *"should be prepared to lose the latest minutes of
data"*, and for a cache that is free. If the application is *wrong* — sessions
gone, rate limits reset, a queue dropped — then the data is not cache-shaped, and
the honest options are to move it to the database or to treat this Redis as a
database with AOF, backups and monitoring. The mistake is a Redis quietly holding
both kinds of data, which the documentation itself suggests splitting into two
instances.

**★ What is the difference between RDB and AOF, in one answer?**
RDB takes point-in-time snapshots at configured save points — compact, cheap
(the parent only forks), fast to restart from, and lossy by minutes. AOF logs every
write and replays it at startup, with durability set by `appendfsync`: `always` is
*"very very slow, very safe"*, `everysec` is the suggested default and loses at most
a second, `no` hands it to the kernel. They are commonly used together, and on
restart the AOF wins because it *"is guaranteed to be the most complete"*. The docs
discourage AOF alone, since an RDB snapshot is still the thing you back up.

**★ Why does a Redis container get OOM-killed when Redis has an eviction policy?**
Because `maxmemory` defaults to zero on 64-bit systems — no limit — so the eviction
policy never engages. Redis grows until the container's cgroup limit is hit and the
kernel kills the process; there is no Redis-side warning, just exit 137. The fix is
to tell Redis about the limit: `maxmemory` set below the container limit, with
headroom, because replication and persistence buffers are explicitly not counted
against it. Redis evicting is graceful degradation; the kernel killing it is not.

**Why is `redis-cli ping` a better healthcheck than a TCP port check?**
Because Redis accepts connections before it can serve data. `PING` is documented as
verifying *"the server's ability to serve data"*, returning an error *"during load
from persistence data or accessing a stale replica"* — so an instance replaying a
large AOF fails it while a port check already reports success. It also costs
nothing, since `redis-cli` ships in the official image.

**What changed about the AOF in Redis 7.0 that affects containers?**
It became a directory. The single AOF was split into one base file plus incremental
files, placed in a directory named by `appenddirname` and tracked by a manifest.
Anything written against the old single-file layout — a backup script, a volume
mount aimed at one path, a health assertion — quietly stops doing what it was
written to do.

**When would you deliberately run Redis with no persistence at all?**
When the data is genuinely disposable and you want the failure mode to be obvious.
`--save ""` turns snapshotting off, and a restart gives you an empty cache — which
is precisely the behaviour you want to test against, because it is what happens on
every deploy anyway. It also removes fork pauses and disk I/O from a service whose
whole job is latency.

---

← Prev: [MongoDB in a container](08-mongodb-in-a-container/README.md) · Index: [Phase 9](README.md) · Next → **Migrations and seeds** *(not written yet)*
