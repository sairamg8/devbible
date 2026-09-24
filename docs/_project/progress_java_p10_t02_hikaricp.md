---
name: devbible Java Phase 10 topic 02 — Connection pooling with HikariCP
description: Live progress, sourced claims and traps for docs/java/pages/phase-10-data-access/02-connection-pooling/ (Understand tier, HikariCP 7.0.2 / Boot 4.1 / PG 18)
metadata:
  type: project
---

# devbible · Java · Phase 10 · Topic 02 — Connection pooling with HikariCP

**Scope:** `docs/java/pages/phase-10-data-access/02-connection-pooling/` only.
**Tier:** Understand. **Targets:** JDK 25, Spring Boot 4.1.0, HikariCP 7.0.2,
pgjdbc 42.7.13, PostgreSQL 18. **No sandbox** — nothing measured, no console
blocks anywhere.

## Chunk plan — ✅ COMPLETE, 27 files, 7,125 lines, 0 over 300, 0 broken links

| # | File | lines | gotchas | Qs |
|---|---|---|---|---|
| 1 | `01-what-the-pool-hands-you.md` (earlier agent) | 282 | 6 | 6 |
| 2 | `02-why-a-small-pool-is-faster.md` (earlier agent) | 268 | 7 | 6 |
| 3 | `03-the-connection-budget.md` | 231 | 5 | 6 |
| 4 | `03b-reducing-cm.md` | 263 | 7 | 6 |
| 5 | `03c-the-server-side-ceiling.md` | 268 | 7 | 6 |
| 6 | `03d-the-fleet-budget.md` | 283 | 8 | 7 |
| 7 | `03e-two-pools-not-one-bigger.md` | 257 | 7 | 7 |
| 8 | `03f-wiring-a-second-datasource.md` | 272 | 7 | 5 |
| 9 | `04-the-six-clocks.md` | 297 | 7 | 7 |
| 10 | `04b-maxlifetime-and-keepalive.md` | 235 | 7 | 5 |
| 11 | `04c-keepalive-and-the-reapers.md` | 256 | 8 | 7 |
| 12 | `04d-idletimeout-and-minimumidle.md` | 289 | 8 | 7 |
| 13 | `04e-when-a-clock-is-silently-disabled.md` | 274 | 8 | 6 |
| 14 | `05-connection-is-not-available.md` | 278 | 8 | 7 |
| 15 | `05b-the-exception-underneath.md` | 267 | 8 | 6 |
| 16 | `06-leak-detection.md` | 240 | 7 | 5 |
| 17 | `06b-finding-and-preventing-leaks.md` | 276 | 9 | 7 |
| 18 | `07-session-state.md` | 280 | 8 | 7 |
| 19 | `07b-what-sql-leaves-behind.md` | 278 | 9 | 7 |
| 20 | `07c-scoping-state-correctly.md` | 269 | 8 | 6 |
| 21 | `07d-connection-level-defaults.md` | 272 | 7 | 6 |
| 22 | `08-starting-up-or-failing-fast.md` | 199 | 6 | 5 |
| 23 | `08b-readiness-liveness-and-shutdown.md` | 271 | 8 | 6 |
| 24 | `08c-watching-the-pool.md` | 258 | 9 | 5 |
| 25 | `08d-the-database-side.md` | 243 | 6 | 6 |
| 26 | `08e-pgbouncer-in-front.md` | 259 | 7 | 5 |
| 27 | `08f-operating-two-layers.md` | 260 | 8 | 7 |
| — | `README.md` | ⏳ **coordinator's** |

⚠️ The original 8-chunk plan became 27 because rule 1 forbids trimming: nine
drafts ran past 300 and were split on concept boundaries. The split log lives in
`docs/java/pages/phase-10-data-access/02-connection-pooling/_plan.md`.

🔴 **Renames during the run — do not resurrect the old names:** idleTimeout moved
`04c`→`04d`; validateNumerics `04d`→`04e`; monitoring `08b`→`08c`; PgBouncer
`08c`→`08e`. All inbound links were repointed and re-verified.

## Load-bearing claims and where each came from

### HikariCP 7.0.2 README — https://github.com/brettwooldridge/HikariCP (raw at tag `HikariCP-7.0.2`)
- Defaults: `maximumPoolSize` 10 · `minimumIdle` = maximumPoolSize · `connectionTimeout` 30000
  · `idleTimeout` 600000 · `maxLifetime` 1800000 · `keepaliveTime` 120000
  · `validationTimeout` 5000 · `leakDetectionThreshold` 0 · `initializationFailTimeout` 1
  · `autoCommit` true · `readOnly` false · `registerMbeans` false · `isolateInternalQueries` false.
- Floors stated in README: connectionTimeout ≥ 250 ms, validationTimeout ≥ 250 ms,
  idleTimeout ≥ 10000 ms, maxLifetime ≥ 30000 ms, keepaliveTime ≥ 30000 ms,
  leakDetectionThreshold ≥ 2000 ms.
- `idleTimeout` **only applies when `minimumIdle` < `maximumPoolSize`**; retirement varies
  by up to +30 s (avg +15 s).
- `maxLifetime`: *"We strongly recommend setting this value, and it should be several seconds
  shorter than any database or infrastructure imposed connection time limit."*
- `minimumIdle`: *"we recommend not setting this value and instead allowing HikariCP to act as a
  fixed size connection pool."*
- `keepaliveTime`: must be less than maxLifetime; only on an idle connection; the connection is
  removed from the pool, pinged (JDBC4 `isValid()` or `connectionTestQuery`) and returned.
- `connectionTestQuery`: *"If your driver supports JDBC4 we strongly recommend not setting this."*
- `initializationFailTimeout`: positive = ms to block acquiring the first connection, applied
  *after* connectionTimeout; 0 = obtain+validate, throw on validation failure but start if a
  connection cannot be obtained; negative = skip the attempt entirely.
- No statement cache at the pool layer, deliberately — *"an anti-pattern"*; driver caches share
  plans across connections.
- Requires **Java 11+**. Secret system properties incl. `com.zaxxer.hikari.blockUntilFilled`,
  `com.zaxxer.hikari.housekeeping.periodMs`.
- README note aimed at Boot: *"Spring Boot auto-configuration users, you need to use
  `jdbcUrl`-based configuration."*

### HikariCP wiki, About Pool Sizing — https://github.com/brettwooldridge/HikariCP/wiki/About-Pool-Sizing
- Formula `connections = ((core_count * 2) + effective_spindle_count)`; HT excluded; spindles 0
  when fully cached; *"no analysis so far regarding how well the formula works with SSDs"*.
- Oracle RWP video: pool 2048 → 96, response ~100ms → ~2ms, *"over 50x improvement"*.
- PG benchmark chart: *"TPS rates start to flatten out at around 50 connections"*; *"even 96 is
  probably too high, unless you're looking at a 16 or 32-core box."*
- 4-core + 1 disk → `9 = ((4*2)+1)`, *"Call it 10"*; *"3000 front-end users running simple queries
  at 6000 TPS"*.
- Axiom: *"You want a small pool, saturated with threads waiting for connections."*
- SSD quote: *"That is exactly 180 degrees backwards."*
- Deadlock floor: `pool size = Tn x (Cm - 1) + 1`; example `8 x (3-1) + 1 = 17`; *"not necessarily
  the optimal pool size, but the minimum required to avoid deadlock"*; JTA note.
- Caveat Lector: mixed long/short workloads → two pool instances.

### HikariCP 7.0.2 SOURCE (read at tag `HikariCP-7.0.2`)
- `pool/HikariPool.java` `createTimeoutException()` — exact message:
  `poolName + " - Connection is not available, request timed out after " + elapsedMillis + "ms " +
   "(total=" + total + ", active=" + active + ", idle=" + idle + ", waiting=" + waiting + ")"`.
  Type is `SQLTransientConnectionException`. **It copies the SQLState and errorCode of the last
  connection failure and chains it via `setNextException()`** — so `getNextException()` often holds
  the real driver error (e.g. PG `53300`).
- `logPoolState()` DEBUG format: `"{} - {}stats (total={}/{}, idle={}/{}, active={}, waiting={})"`.
- `aliveBypassWindowMs` default **500 ms** (`com.zaxxer.hikari.aliveBypassWindowMs`) — borrow skips
  the aliveness check inside that window.
- `housekeepingPeriodMs` default **30 s**.
- `createPoolEntry()`: maxLifetime gets random variance **up to 25%** (`lifeTimeVarianceFactor`
  default 4), keepalive **up to 20%** — effective lifetime is 75–100% of `maxLifetime`.
- Housekeeper warns on retrograde clock change (soft-evicts) and on *"Thread starvation or clock
  leap detected"*.
- `PoolBase.isConnectionDead()` WARN: *"Failed to validate connection {} ({}). Possibly consider
  using a shorter maxLifetime value."*
- `pool/ProxyConnection.java` — six dirty bits: READONLY, AUTOCOMMIT, ISOLATION, CATALOG,
  NETTIMEOUT, SCHEMA. `close()` order: closeStatements → leakTask.cancel → rollback if
  `isCommitStateDirty && !isAutoCommit` (DEBUG *"Executed rollback on connection ... due to dirty
  commit state on close()"*) → `resetConnectionState(dirtyBits)` → `clearWarnings()` → delegate =
  `ClosedConnection` → `poolEntry.recycle()`.
- `PoolBase.resetConnectionState()` resets ONLY those six, and only when the value differs from the
  pool's configured value. **Nothing set by SQL (`SET search_path`, `SET TIME ZONE`, temp tables,
  advisory locks, `LISTEN`, session-level `PREPARE`) is reset.** Logs DEBUG *"Reset ({}) on
  connection {}"*.
- `pool/ProxyLeakTask.java` — WARN *"Connection leak detection triggered for {} on thread {}, stack
  trace follows"*; on return INFO *"Previously reported leaked connection {} on thread {} was
  returned to the pool (unleaked)"*. It **never reclaims** the connection. The captured exception
  is `new Exception("Apparent connection leak detected")` with the first 5 frames stripped.
- `HikariConfig.validateNumerics()` — 🔴 the silent-disable traps:
  * maxLifetime < 30 s → reset to default 30 min (WARN)
  * keepaliveTime < 30 s → **disabled**; keepaliveTime ≥ maxLifetime → **disabled**
  * leakDetectionThreshold < 2 s **or > maxLifetime** → **disabled** (WARN)
  * connectionTimeout / validationTimeout < 250 ms (`SOFT_TIMEOUT_FLOOR`) → reset to default
  * minIdle < 0 or > maxPoolSize → set to maxPoolSize
  * idleTimeout + 1 s > maxLifetime (and minIdle < max) → idleTimeout **disabled**
  * idleTimeout < 10 s (and minIdle < max) → reset to default 10 min
  * idleTimeout set while minIdle == maxPoolSize → WARN *"has no effect because the pool is
    operating as a fixed size pool"*
- `metrics/micrometer/MicrometerMetricsTracker.java` — exact metric names, prefix `hikaricp`:
  `.connections` (total gauge), `.connections.idle`, `.connections.active`, `.connections.pending`,
  `.connections.max`, `.connections.min`, `.connections.acquire` (Timer, "Connection acquire time"),
  `.connections.usage` (Timer), `.connections.creation` (Timer), `.connections.timeout` (Counter).

### HikariCP wiki, MBean (JMX) Monitoring
- `registerMbeans=true`. ObjectNames `com.zaxxer.hikari:type=Pool (poolName)` and
  `com.zaxxer.hikari:type=PoolConfig (poolName)`. `HikariPoolMXBean`: getIdleConnections,
  getActiveConnections, getTotalConnections, getThreadsAwaitingConnection, softEvictConnections,
  suspendPool, resumePool (last two need `allowPoolSuspension=true`).

### Spring Boot reference — https://docs.spring.io/spring-boot/reference/data/sql.html
- *"We prefer HikariCP for its performance and concurrency. If HikariCP is available, we always
  choose it."* → Tomcat → DBCP2 → Oracle UCP. Override with `spring.datasource.type`.
- Prefixes `spring.datasource.hikari.*` etc. JDBC/JPA starters pull HikariCP in automatically.
- Actuator: `jdbc.connections` prefix for all DataSources; *"Hikari-specific metrics are exposed
  with a `hikaricp` prefix. Each metric is tagged by the name of the pool (you can control it with
  `spring.datasource.name`)."*

### JDK 25 API
- `javax.sql.DataSource`: *"A factory for connections to the physical data source…"*; three
  implementation types, the second being the connection-pooling one.
- `javax.sql.PooledConnection`: *"that `Connection` object is actually a handle to a
  `PooledConnection` object, which is a physical connection"*; *"the underlying physical connection
  is recycled rather than being closed"*.

### PostgreSQL 18
- `max_connections` default *"typically 100"*, *"can only be set at server start"*; *"PostgreSQL
  sizes certain resources based directly on the value of `max_connections`. Increasing its value
  leads to higher allocation of those resources, including shared memory."*
- `superuser_reserved_connections` default **3**; `reserved_connections` default **0**.
- SQLSTATE **53300** = `too_many_connections` (Class 53). Class 08 = connection exception
  (08000/08001/08003/08004/08006/08007/08P01).
- `idle_in_transaction_session_timeout` default 0; `idle_session_timeout` default 0 with an explicit
  warning: *"Be wary of enforcing this timeout on connections made through connection-pooling
  software or other middleware, as such a layer may not react well to unexpected connection
  closure."*
- `transaction_timeout`, `statement_timeout` default 0.
- `pg_stat_activity.state` values: starting, active, idle, idle in transaction,
  idle in transaction (aborted), fastpath function call, disabled. Columns backend_start,
  xact_start, query_start, state_change, wait_event_type, wait_event, application_name,
  backend_type.

### PgBouncer — https://www.pgbouncer.org/config.html
- pool_mode: session (*"Server is released back to pool after client disconnects. Default."*),
  transaction (*"…after transaction finishes."*), statement (*"…after query finishes. Transactions
  spanning multiple statements are disallowed in this mode."*).
- `max_client_conn` default 100; `default_pool_size` default 20; `min_pool_size` default 0;
  `reserve_pool_size` default 0; `max_db_connections` default 0 (unlimited).
- *"When transaction pooling is used, the `server_reset_query` is not used, because in that mode,
  clients must not use any session-based features, since each transaction ends up in a different
  connection and thus gets a different session state."*

## Traps found
1. **`leakDetectionThreshold > maxLifetime` silently disables leak detection.** Not in the README —
   only in `validateNumerics()`. A 30-minute threshold against the default 30-minute maxLifetime is
   the realistic way to hit it.
2. **`idleTimeout` does nothing by default**, because `minimumIdle` defaults to `maximumPoolSize`
   and the pool is fixed-size. Boot users who set only `idle-timeout` get a WARN and no behaviour.
3. **Effective `maxLifetime` is 75–100% of the configured value** (random variance up to 25%), so
   the margin against an infra idle-timeout is always on the safe side — but the *configured* value
   is the ceiling, not the observed one.
4. `keepaliveTime >= maxLifetime` disables keepalive silently.
5. The timeout exception's `getNextException()` carries the real driver error; people read only
   `getMessage()` and miss `53300` / an auth failure / a DNS failure underneath.

## Nothing contradicts topic 01
Topic 01 chunk 4 already says "HikariCP applies its configured `autoCommit`,
`transactionIsolation` and `readOnly` to connections it hands out" — the source confirms it and adds
three more (catalog, schema, network timeout), and confirms the important negative: **SQL-set
session state is not reset.** Chunk 20's `leakDetectionThreshold` default `0` and its "20–60 seconds
is usual" advice are both consistent.




## Additions from the 2026-08-25 authoring session (fetched, verbatim)

### PostgreSQL 18 — runtime-config-connection.html (re-fetched in full)
- `max_connections`: *"Determines the maximum number of concurrent connections to the database
  server. The default is typically 100 connections, but might be less if your kernel settings will
  not support it (as determined during initdb). This parameter can only be set at server start."*
  + *"PostgreSQL sizes certain resources based directly on the value of max_connections. Increasing
  its value leads to higher allocation of those resources, including shared memory."*
  + 🔴 *"When running a standby server, you must set this parameter to the same or higher value than
  on the primary server. Otherwise, queries will not be allowed in the standby server."*
- `reserved_connections` (default **0**): *"Determines the number of connection \"slots\" that are
  reserved for connections by roles with privileges of the pg_use_reserved_connections role.
  Whenever the number of free connection slots is greater than superuser_reserved_connections but
  less than or equal to the sum of superuser_reserved_connections and reserved_connections, new
  connections will be accepted only for superusers and roles with privileges of
  pg_use_reserved_connections. If superuser_reserved_connections or fewer connection slots are
  available, new connections will be accepted only for superusers."* Must be < max_connections −
  superuser_reserved_connections; server start only.
- `superuser_reserved_connections` (default **3**): reserved for superusers; *"intended as final
  reserve for emergency use after the slots reserved by reserved_connections have been exhausted."*
- ⇒ `usable = max_connections − superuser_reserved_connections − reserved_connections`
  (97 on a default install).

### PgBouncer — https://www.pgbouncer.org/config.html (re-fetched)
- 🔴 `max_prepared_statements` **default 200** (non-zero by default in current PgBouncer):
  *"When this is set to a non-zero value PgBouncer tracks protocol-level named prepared statements
  related commands sent by the client in transaction and statement pooling mode."* PgBouncer
  rewrites the names internally before forwarding. **This largely retires the old
  `prepareThreshold=0` workaround.**
- `server_reset_query` default **`DISCARD ALL`**: *"Query sent to server on connection release,
  before making it available to other clients. At that moment no transaction is in progress, so the
  value should not include ABORT or ROLLBACK."*
- `server_reset_query_always` default **0**: *"Whether server_reset_query should be run in all
  pooling modes. When this setting is off (default), the server_reset_query will be run only in
  pools that are in sessions-pooling mode."* Docs call it a fix for *"broken setups that run
  applications that use session features over a transaction-pooled PgBouncer."*
- *"Connections in transaction-pooling mode should not have any need for a reset query"* because
  *"clients must not use any session-based features, since each transaction ends up in a different
  connection and thus gets a different session state."*

### pgjdbc — https://jdbc.postgresql.org/documentation/use/ (re-fetched)
- `prepareThreshold` default **5**: *"Determine the number of PreparedStatement executions required
  before switching over to use server side prepared statements. The default is five... A value of
  -1 activates server side prepared statements and forces binary transfer for enabled types."*
- `preparedStatementCacheQueries` default **256**; `preparedStatementCacheSizeMiB` default **5**.
- ⚠️ **UNCONFIRMED:** the parameter reference documents only the default 5 and the special value -1.
  It does **not** document what `0` does. `PGProperty.PREPARE_THRESHOLD`'s javadoc is only
  *"Statement prepare threshold. A value of -1 stands for forceBinary"*. So `prepareThreshold=0`
  (the widely-repeated PgBouncer workaround) is stated as convention, not as documented behaviour —
  do not assert it flatly on a page.

### Spring Boot 4.1 how-to — Configure Two DataSources (fetched verbatim)
🔴 **The recipe CHANGED and every pre-Boot-3.5 sample is wrong.** Verbatim:
*"A key difference is that the DataSource @Bean must be declared with
`defaultCandidate=false`. This prevents the auto-configured DataSource from backing off."*
Shape:
```java
@Configuration(proxyBeanMethods = false)
public class MyCompleteAdditionalDataSourceConfiguration {
  @Qualifier("second") @Bean(defaultCandidate = false)
  @ConfigurationProperties("app.datasource")
  public DataSourceProperties secondDataSourceProperties() { return new DataSourceProperties(); }

  @Qualifier("second") @Bean(defaultCandidate = false)
  @ConfigurationProperties("app.datasource.configuration")
  public HikariDataSource secondDataSource(@Qualifier("second") DataSourceProperties p) {
    return p.initializeDataSourceBuilder().type(HikariDataSource.class).build();
  }
}
```
- Implementation-specific properties live under the **`configuration`** sub-namespace:
  *"More advanced, implementation-specific, configuration of the auto-configured DataSource is
  available through the `spring.datasource.configuration.*` properties."* Same for the additional
  one (`app.datasource.configuration.*`). NOT `spring.datasource.hikari.*` under this recipe.
- Import is `org.springframework.boot.jdbc.autoconfigure.DataSourceProperties` (moved package in
  Boot 4) and `org.springframework.boot.jdbc.DataSourceBuilder`.

### HikariCP wiki — Caveat Lector / Pool-locking (re-fetched)
- Verbatim: *"Pool sizing is ultimately very specific to deployments."* The page singles out
  systems mixing long-running and short transactions as hardest to tune and **recommends separate
  pool instances per workload type**.
- Pool-locking gives **two** worked examples: 3 threads x 4 connections → **10**; 8 threads x 3
  connections → **17**. Both are minimums to avoid deadlock, not optimal sizes.

### HikariCP 7.0.2 README — the ten duration/size entries, re-fetched verbatim
- `connectionTimeout`: *"the maximum number of milliseconds that a client (that's you) will wait
  for a connection from the pool"*; *"Lowest acceptable connection timeout is 250 ms."* Default 30000.
- `maximumPoolSize`: *"When the pool reaches this size, and no idle connections are available, calls
  to getConnection() will block for up to connectionTimeout milliseconds before timing out."* Default 10.
- `validationTimeout`: *"the maximum amount of time that a connection will be tested for aliveness.
  This value must be less than the connectionTimeout. Lowest acceptable validation timeout is 250 ms."*
  Default 5000.
- `idleTimeout`: *"the maximum amount of time that a connection is allowed to sit idle in the pool"*;
  requires minimumIdle < maximumPoolSize; *"Idle connections will not be retired once the pool reaches
  minimumIdle connections."* Variance averages ~15 s, max 30 s. 0 = never removed. Min 10000. Default 600000.
- `keepaliveTime`: *"how frequently HikariCP will attempt to keep a connection alive, in order to
  prevent it from being timed out by the database or network infrastructure"*; must be < maxLifetime;
  idle connections only; *"The minimum allowed value is 30000ms (30 seconds), but a value in the range
  of minutes is most desirable."* Default 120000.
- `maxLifetime`: *"An in-use connection will never be retired, only when it is closed will it then be
  removed."* + the strong recommendation. 0 = infinite. Min 30000. Default 1800000.
- `minimumIdle`: *"we recommend not setting this value and instead allowing HikariCP to act as a fixed
  size connection pool."* Default = maximumPoolSize.
- `connectionTestQuery`: *"If your driver supports JDBC4 we strongly recommend not setting this property."*
- `leakDetectionThreshold`: *"the amount of time that a connection can be out of the pool before a
  message is logged indicating a possible connection leak. A value of 0 means leak detection is
  disabled. Lowest acceptable value for enabling leak detection is 2000 (2 seconds)."* Default 0.
- `initializationFailTimeout`: *"If the value is zero (0), HikariCP will attempt to obtain and validate
  a connection. If a connection is obtained, but fails validation, an exception will be thrown and the
  pool not started."* Positive = ms to block, exception raised *following the connectionTimeout period*.
  Negative = bypass the initial attempt. Default 1.

## Traps found in this session (in addition to the five above)
6. **`max_connections` is per SERVER, not per database** — every database in the cluster shares it,
   so per-team budgets that are not per-server budgets are not budgets.
7. **`instances x maximumPoolSize` is the number that hits the ceiling**, and an autoscaler
   multiplies it while nothing multiplies the budget. `maximumPoolSize <= (usable − fixed) /
   (max_replicas x (1 + maxSurge))`. Kubernetes' default maxSurge 25% must be in the denominator.
8. **The exhaustion loop is self-sustaining**: refusals fail health checks → orchestrator adds
   replicas → each opens a full pool. It does not recover without scaling in.
9. **`minimumIdle` defaulting to `maximumPoolSize` means an IDLE service holds its full allocation**
   — budget the maximum, never the average.
10. **The deadlock floor's coefficient is `Cm − 1`**, so Cm 1→2 takes the floor from 1 to `Tn + 1`.
    There is no middle value. Virtual threads make `Tn` unbounded ⇒ **no pool size is safe if
    Cm > 1**; the only fixes are getting Cm to 1 or explicit admission control.
11. **`dataSource.getConnection()` inside `@Transactional` does NOT join the bound transaction** —
    it takes a second pool connection with its own snapshot. `DataSourceUtils.getConnection()`,
    `JdbcTemplate`, `JdbcClient` and the JPA `EntityManager` do join.
13. **A second `DataSource` bean without `defaultCandidate = false` makes Boot's
    auto-configuration back off**, silently removing the PRIMARY pool.
14. **Unqualified `@Transactional` around work on a second pool is a no-op** — the default
    transaction manager binds the auto-configured DataSource, so the second pool runs in
    autocommit while an empty transaction commits on the first.
15. **Pool occupancy = arrival rate x holding time.** 0.2 exports/s at 30 s holding = 6
    connections; 500 req/s at 3 ms = 1.5. The rare workload owns the pool.
16. **`connectionTimeout` does NOT bound query execution.** A long reports `connectionTimeout`
    with no server-side `statement_timeout` just lets a runaway query hold a slot for hours.
53. **Micrometer metric names (prefix `hikaricp`, tagged by pool name):** `.connections` (total),
    `.connections.active`, `.connections.idle`, `.connections.pending`, `.connections.max`,
    `.connections.min`, `.connections.acquire` (Timer), `.connections.usage` (Timer),
    `.connections.creation` (Timer), `.connections.timeout` (Counter).
54. 🔴 **`hikaricp.connections.usage` is the metric that settles "too small vs slower queries"** —
    usage rising while `active` is pinned at max = queries got slower, pool is a symptom.
    `.max`/`.min` report the CONFIGURED values, so they are the cheapest cross-check on
    validateNumerics' silent corrections.
55. **`pending` is the leading indicator; the timeout counter is lagging** (it increments only
    after a thread waited the whole connectionTimeout).
56. 🔴 **Cross-check `sum(hikaricp.connections)` against `pg_stat_activity`:** MORE on the server =
    another consumer of the role (budget wrong); FEWER = something is MULTIPLEXING, i.e. there is
    a pooler in the path and the pool's clocks govern nothing real.
57. **`idle in transaction` is invisible in pool metrics** — HikariCP sees the connection as "in
    use". It holds locks and pins the vacuum horizon.
58. 🔴 **`softEvictConnections()` (HikariPoolMXBean, `registerMbeans=true`) is a DRAIN WITHOUT A
    RESTART** — idle connections at once, in-use ones on return. The right response to a failover,
    a credential rotation or a certificate change. `suspendPool`/`resumePool` need
    `allowPoolSuspension=true` (default false).
48. **`initializationFailTimeout` default is 1 = FAIL FAST**, and "1" is not one millisecond —
    the attempt is bounded by `connectionTimeout` and the init timeout applies after it, so a
    default pool blocks startup for ~connectionTimeout. Zero is the odd one: throws on a
    VALIDATION failure, starts if a connection cannot be OBTAINED at all.
49. 🔴 **Spring Boot's readiness group does NOT include `db` by default** — verbatim: *"By default,
    Spring Boot does not add other health indicators to these groups."* So
    `initialization-fail-timeout: -1` without
    `management.endpoint.health.group.readiness.include: "readinessState,db"` produces a pod that
    is marked READY and fails every request.
50. **Boot documentation forbids external checks in LIVENESS** — verbatim: *"The 'liveness' probe
    should not depend on health checks for external systems... Kubernetes might restart all
    application instances and create cascading failures."* Readiness is *"a choice... must be made
    carefully"*; services with circuit breakers *"definitely should not"* include it.
51. **Boot 4 graceful shutdown is ENABLED BY DEFAULT** for Jetty/Reactor Netty/Tomcat (`server.
    shutdown: immediate` disables it). *"Existing requests will be allowed to complete"* / *"No new
    requests will be permitted"*; grace period is `spring.lifecycle.timeout-per-shutdown-phase`
    (the docs do NOT state its default — do not assert 30s).
52. **`-1` does NOT let an app with Flyway start without a database** — migrations need their own
    connection; the failure just moves from HikariCP to Flyway.
39. 🔴 **pgjdbc implements `setSchema` as `SET SESSION search_path TO '<schema>'`** (verified in
    `PgConnection.java`; null → `SET SESSION search_path TO DEFAULT`). So
    `connection.setSchema()` and `stmt.execute("SET search_path ...")` do the SAME thing on the
    server, and HikariCP resets ONE of them. The pool tracks API CALLS, not session state.
40. **pgjdbc `setReadOnly` throws inside a transaction** — *"Cannot change transaction read-only
    property in the middle of a transaction"* (`PSQLState.ACTIVE_SQL_TRANSACTION`), and whether it
    issues SQL depends on the `readOnlyBehavior` property + autocommit. **This is why HikariCP's
    `close()` rolls back (step 3) BEFORE `resetConnectionState()` (step 4)** — the ordering is
    load-bearing, not incidental.
41. **`PgConnection.getSchema()` costs a round trip** — it runs `select current_schema()`.
42. 🔴 **Every transaction-scoped fix silently no-ops with autocommit ON** (HikariCP's default):
    `SET LOCAL` warns and does nothing; `pg_advisory_xact_lock` releases one statement later;
    `CREATE TEMP TABLE ... ON COMMIT DROP` drops immediately. All three look successful.
43. **`pg_advisory_xact_lock` BLOCKS** — for "only one instance runs this", the right call is
    `pg_try_advisory_xact_lock`, which returns false instead of queueing every instance.
44. **`currval()` returns another request's value** on a pooled connection, because its
    "not yet defined in this session" guard is satisfied by anyone's `nextval()`.
45. **`ALTER ROLE <role> SET <guc>`** is the strongest place for a default — enforced at login for
    every client, survives deploys, and pairs with the role's `CONNECTION LIMIT`. Must live in a
    migration.
46. **`connectionInitSql` runs at connection CREATION, not per borrow** (≈ once per maxLifetime per
    slot). It is not a reset mechanism.
47. **HikariCP's `schema` / `transactionIsolation` / `readOnly` properties are strictly stronger
    than `connectionInitSql`**, because they are applied at creation AND restored on every return.
34. **The leak stack trace is captured at BORROW** (`new Exception("Apparent connection leak
    detected")`, HikariCP frames stripped), so the top frame is the `getConnection()` call site.
    It can NEVER point at the missing `close()` — absent code has no frame.
35. **The "unleaked" INFO is a FALSE POSITIVE report**, i.e. good news, and is routinely misread
    as confirmation of a leak.
36. 🔴 **`DataSourceUtils.getConnection()` must be released with
    `DataSourceUtils.releaseConnection(c, ds)`, never `close()`** — inside a transaction it returns
    the thread-bound connection the transaction manager owns. Outside a transaction the two behave
    identically, which is why the bug passes every test.
37. **A repository `Stream` holds its connection until closed**; terminal operations do NOT close
    it. Highest-rate leak source in a Spring app.
38. **A leak degrades with UPTIME, not load** → fixed request-count to failure → looks like a
    scheduled/cron problem. `active` not falling overnight is the cheap test.
27. 🔴🔴 **`SQLException.getNextException()` is NOT `getCause()`** — `printStackTrace()` and
    SLF4J/Logback follow the CAUSE chain only, so `log.error(msg, e)` does NOT print the chained
    driver exception. "Log the exception, not the message" is necessary but NOT sufficient for
    JDBC. `SQLException implements Iterable<Throwable>` (JDBC 4.0) walks both chains.
28. **Spring's `DataAccessException` keeps the `SQLException` as its CAUSE**, so unwrap once with
    `getCause()` and then iterate.
29. **The diagnostic that matters most in the timeout message: `total` vs `maximumPoolSize`.**
    total BELOW max + threads waiting ⇒ the pool could not CREATE connections ⇒ database/network,
    and raising maximumPoolSize is guaranteed to do nothing.
30. **You can time out with `idle > 0`** — every borrow validates, fails, evicts, retries: all
    connections are dead (failover / firewall flush / DB restart).
31. **"Recovers when traffic stops" is THE discriminator** between an undersized pool and a leak.
32. **Retrying on `SQLTransientConnectionException` unconditionally is harmful** when the chained
    cause is class 28 (`28P01 invalid_password`, `28000`) or `3D000 invalid_catalog_name` — those
    never become true and produce an infinite retry storm.
33. **`logPoolState()` DEBUG shows the LIMITS too** — `total={}/{}` is current/max and
    `idle={}/{}` is current/min — which the exception message does not.
21. 🔴 **`maxLifetime` is the ANCHOR of validateNumerics.** Three settings are validated against
    it — keepaliveTime (< it), idleTimeout (+1 s <= it), leakDetectionThreshold (<= it) — so ONE
    line lowering maxLifetime can silently disable all three at once. Worked example on 04e.
22. **The corrections go in two directions and one is worse than the mistake:** a value below a
    floor is reset to HikariCP's DEFAULT, not to the floor. `connectionTimeout: 200` → 30 s;
    `maxLifetime: 10000` → 30 minutes.
23. **`leakDetectionThreshold: 1800000` is disabled**, because the default maxLifetime is also
    30 min and threshold > maxLifetime turns it off. The careful-looking value is the broken one.
24. **The housekeeper runs every 30 s** (`com.zaxxer.hikari.housekeeping.periodMs`), so idle
    retirement has 30 s granularity plus the documented +0–30 s variance (avg +15 s). A pool does
    not visibly shrink for ~1 minute after traffic stops.
25. **"Thread starvation or clock leap detected" is not a pool bug** — the housekeeping task ran
    far later than scheduled: long GC pause, throttled container, starved host.
26. **`com.zaxxer.hikari.blockUntilFilled`** is a SYSTEM PROPERTY (JVM flag, not YAML) that blocks
    pool startup until minimumIdle is reached.
17. **`connectionTimeout` includes CREATING the connection** when the pool is below max, so a value
    below connect-handshake latency yields a pool that can never fill — 100% failure against a
    healthy database. The 250 ms floor prevents only the extreme case.
18. **The keepalive ping is the same `isValid()` check a borrow does, so `validationTimeout` bounds
    it** — an aggressive validationTimeout discards slow-but-alive connections during an incident.
19. **A connection under a keepalive ping is OUT of the pool** for the round trip: a pool sized with
    zero headroom can transiently block.
20. **Low-traffic environments break and busy ones do not.** Production traffic keeps connections
    warm; staging's idleness is exactly what idle reapers act on. Same clocks everywhere.
12. **PostgreSQL's deadlock detector never reports a pool deadlock** — the cycle is entirely inside
    the JVM and every backend looks idle. `pg_locks` will be empty.


## Owed — nothing from this agent

✅ **All 27 chunks are written and on disk.** Validated: `wc -l` ≤ 300 everywhere,
tier badge + `> Verified:` + `<!--FOOTER-->` on every file, balanced code fences,
unique `sidebar_position` 1..27, and every `.md` link resolved against the
filesystem (0 broken).

**Still the coordinator's:** the topic `README.md` index, every
`← Prev / Next →` footer, the phase README row, `src/data/progress.js`,
`docs/java/pages/README.md` and `docs/README.md`. Nothing was committed in the
devbible repo by this agent.

**Two forward references written as bold plain text, not links** (targets do not
exist yet): **topic 03 · JDBC transactions** and **topic 04 · `@Transactional` in
depth**. `03-jdbc-transactions/` and `04-spring-transactional/` do exist on disk
with a couple of chunks each, but they are in flight by other agents, so no link
was made into them.
