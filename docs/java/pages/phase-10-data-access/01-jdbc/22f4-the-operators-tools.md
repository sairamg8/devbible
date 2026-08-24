---
title: "Cancel first, terminate second — and `pg_terminate_backend` returning true does not mean the backend died"
sidebar_label: "22f4 · The operator's tools"
sidebar_position: 47
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the PostgreSQL 18 manual *Server Signaling Functions*
> (postgresql.org/docs/18/functions-admin.html), the *Error Codes* appendix
> (postgresql.org/docs/18/errcodes-appendix.html), *Canceling Requests in Progress*
> (postgresql.org/docs/18/protocol-flow.html), and the pgjdbc source at tag
> `REL42.7.13` — `org/postgresql/PGConnection.java`. JDK 25, JDBC 4.3, PostgreSQL 18,
> pgjdbc 42.7.13.

**Sometimes the application cannot cancel: nobody kept a reference to the
`Statement`, the JVM that started the query is gone, or a pooler owns the cancel key.
PostgreSQL then offers the same two outcomes as ordinary SQL, callable by anyone with
a connection and the right role. `pg_cancel_backend` sends SIGINT and stops the
current query, leaving the session alive. `pg_terminate_backend` sends SIGTERM and
ends the session. **Always try the cancel first**, because a terminated session
becomes a dead connection sitting in somebody's pool. And read the return value
carefully — a bare `pg_terminate_backend(pid)` returns `true` when the *signal* was
sent, whether or not anything died.**

## Two functions, one signal each

| Function | Signal | Effect | Client sees |
|---|---|---|---|
| `pg_cancel_backend(pid integer)` | **SIGINT** | "Cancels the current query of the session whose backend process has the specified process ID" — the session survives | `57014` |
| `pg_terminate_backend(pid integer, timeout bigint DEFAULT 0)` | **SIGTERM** | "Terminates the session whose backend process has the specified process ID" | `57P01`, connection gone |

Both return `boolean`, and the two booleans mean different things — see below.

```sql
-- find the offender first; never guess a PID
SELECT pid, state, wait_event_type, now() - query_start AS runtime, left(query, 80)
FROM pg_stat_activity
WHERE state = 'active' AND now() - query_start > interval '5 minutes'
ORDER BY runtime DESC;

SELECT pg_cancel_backend(12345);          -- try this first, always
SELECT pg_terminate_backend(12345, 5000); -- only if the cancel did not take
```

**A cancel leaves the session usable.** The client gets `57014` on the connection it
already had, its transaction is aborted, and after a rollback that connection is
healthy — exactly the outcome
[chunk 22f3](22f3-when-a-cancel-lands.md) describes for `Statement.cancel()`, because
it is the same event. **A terminate destroys the connection.** The pool holding it
does not find out until it hands it to the next request.

## The return value of `pg_terminate_backend` is a trap

The manual is precise, and the precision is the point:

> "If `timeout` is not specified or zero, this function returns `true` whether the
> process actually terminates or not, indicating only that the sending of the signal
> was successful. If the `timeout` is specified (in milliseconds) and greater than
> zero, the function waits until the process is actually terminated or until the
> given time has passed. If the process is terminated, the function returns `true`.
> On timeout, a warning is emitted and `false` is returned."

So `SELECT pg_terminate_backend(12345)` returning `true` is not evidence of anything
except that a signal was delivered to a process. If you need to know it worked, pass
a timeout — `pg_terminate_backend(12345, 5000)` — and believe the boolean, or query
`pg_stat_activity` again.

⚠️ **A backend can survive a SIGTERM for a while.** Like a cancel, the signal is
noticed at the backend's next interrupt check. A process deep inside a long
uninterruptible operation does not stop the instant you ask.

## Permissions are role-based, not superuser-only

This surprises people who assume killing queries is a DBA-only act. Both functions
carry the same rule:

> "This is also allowed if the calling role is a member of the role whose backend is
> being canceled or the calling role has privileges of `pg_signal_backend`, however
> only superusers can cancel superuser backends. As an exception, roles with
> privileges of `pg_signal_autovacuum_worker` are permitted to cancel autovacuum
> worker processes, which are otherwise considered superuser backends."

Three practical readings:

- **Your application role can already cancel its own sessions.** No grant needed —
  all the sessions belong to the same role. That makes a "cancel my own long query"
  admin endpoint entirely buildable without handing out privileges.
- **`pg_signal_backend` is the grant for cross-role cancelling**, and it is a
  predefined role you `GRANT` like any other. It deliberately stops short of
  superuser backends.
- **Autovacuum workers got their own escape hatch.** `pg_signal_autovacuum_worker`
  exists so an operator can stop a runaway autovacuum without being superuser.

## Getting the PID from the Java side

`pg_stat_activity` is the general answer, but the application can name its own
backend directly. pgjdbc's `PGConnection` documents `getBackendPID()` as returning
"the process ID (PID) of the backend server process handling this connection":

```java
int pid = conn.unwrap(org.postgresql.PGConnection.class).getBackendPID();
log.info("request={} backendPid={}", requestId, pid);
```

Logging that alongside a request id turns "which backend is stuck?" from an
investigation into a lookup — and it is the one piece of state that outlives the JVM
that created it, which is exactly when the operator's tools are needed.

⚠️ **Behind a pooler this may not be a PostgreSQL PID at all.** The value is whatever
the thing you connected to announced at startup, and a pooler is free to mint its own.

## Gotchas

**⚠️ Reaching for `pg_terminate_backend` first**
**Symptom:** connection-pool errors spreading well past the query you meant to stop.
**Cause:** SIGTERM ends the session. The pool still believes that connection is
healthy and will hand it to the next request.
**Fix:** `pg_cancel_backend` first — it leaves the session usable — and terminate
only when the cancel demonstrably did not take.

**⚠️ Reading `pg_terminate_backend(pid) → true` as "it died"**
**Symptom:** an operator reports the backend killed and `pg_stat_activity` still
shows it.
**Cause:** with no timeout the function "returns `true` whether the process actually
terminates or not, indicating only that the sending of the signal was successful".
**Fix:** pass a timeout in milliseconds and check the boolean, or re-query
`pg_stat_activity` instead of trusting the return.

**⚠️ Building "cancel by PID" and letting a pooler mint the PID**
**Symptom:** `pg_cancel_backend` on a PID that is not the backend you think.
**Cause:** `getBackendPID()` reports whatever the thing you connected to announced at
startup. Behind a pooler that may be a pooler-side identifier.
**Fix:** verify against `pg_stat_activity` on the server itself before wiring the PID
into anything automatic.

**⚠️ Cancelling a backend that is `idle in transaction`**
**Symptom:** `pg_cancel_backend` returns `true` and the session keeps holding its
locks and its snapshot.
**Cause:** the function cancels "the current query". A session sitting idle inside an
open transaction has no current query to cancel — the problem is the open
transaction, not a running statement.
**Fix:** that is what `idle_in_transaction_session_timeout` is for
([chunk 22d](22d-server-side-timeouts.md)). Terminating works, but fixing the client
that left the transaction open works better.

**⚠️ Assuming a superuser is needed, and building an approval process around it**
**Symptom:** an on-call runbook that escalates to a DBA for something the service
account could already do.
**Cause:** the permission rule is role membership, and every connection from one
application role belongs to that role.
**Fix:** confirm with a test in a non-production database, then let the application
cancel its own sessions.

**⚠️ Scripting a "kill everything slow" loop**
**Symptom:** a cron job that cancels legitimate long work — a nightly report, a
migration, a `VACUUM` — because it only looked at duration.
**Cause:** `pg_stat_activity` filtered on runtime alone cannot tell intentional work
from a runaway query.
**Fix:** filter on `application_name`, `usename` and `backend_type` as well, and set
per-role or per-transaction `statement_timeout` values instead
([chunk 22e](22e-setting-the-timeouts.md)) so the database enforces the policy rather
than a script racing it.

## Interview questions

**★ When would you use `pg_cancel_backend` instead of `Statement.cancel()`?**
When the application cannot do it. The JDBC route needs a live reference to the
executing `Statement` in a process that is still running, and a new TCP connection to
the database from that process. None of that holds when the client has crashed or
been redeployed, when a batch job's JVM is gone but its backend is still grinding,
when a pooler between you and PostgreSQL owns the cancel key, or when you are an
operator with psql and an incident in front of you. `pg_cancel_backend(pid)` sends
SIGINT to that backend and produces the identical `57014` on whatever client is still
attached, because it is the same mechanism arriving by a different route. It also
needs no special privilege in the common case — the manual allows it "if the calling
role is a member of the role whose backend is being canceled or the calling role has
privileges of `pg_signal_backend`" — so an application role can cancel its own
sessions. The PID comes from `pg_stat_activity`, or from `PGConnection.getBackendPID()`
if you logged it.

**★ What is the difference between `pg_cancel_backend` and `pg_terminate_backend`?**
One signal each, and two very different blast radii. `pg_cancel_backend` sends SIGINT
and "cancels the current query of the session" — the session survives, the client sees
`57014`, the transaction is aborted, and after a rollback that connection is usable
again. `pg_terminate_backend` sends SIGTERM and "terminates the session": the backend
exits, the client's connection dies, and a pool that was holding it will hand the dead
connection to somebody else before discovering the problem. So the order is always
cancel first, terminate only if the cancel did not take. There is also a trap in the
return value: with no timeout, `pg_terminate_backend` "returns `true` whether the
process actually terminates or not, indicating only that the sending of the signal was
successful". Pass a positive millisecond timeout and it waits and returns honestly,
emitting a warning and `false` if the process outlives it.

**★ Who is allowed to cancel a backend, and why does that matter for design?**
Not just superusers, which is the assumption worth correcting. The manual permits it
"if the calling role is a member of the role whose backend is being canceled or the
calling role has privileges of `pg_signal_backend`", with only superuser backends
reserved for superusers, plus a carve-out letting `pg_signal_autovacuum_worker` stop
autovacuum workers. The design consequence is large: because every connection your
service opens belongs to the same application role, that role can already cancel any
of its own sessions with no grant at all. So a self-service "stop my report" feature
does not require handing out elevated privileges, and an on-call runbook does not need
to escalate to a DBA for it. Cross-role cancelling — a platform team stopping another
team's queries — is what `pg_signal_backend` exists for, and it is granted like any
other predefined role.

**★ A session is `idle in transaction` and holding locks. Will `pg_cancel_backend`
help?**
No, and understanding why is the useful part. `pg_cancel_backend` cancels "the current
query", and a session that is idle inside an open transaction has no current query —
it is waiting for the client to send something. The signal arrives and there is
nothing to interrupt. What is causing the damage is the open transaction: it holds a
snapshot, which blocks vacuum from reclaiming rows, and it holds any locks the
transaction already took. `pg_terminate_backend` does end it, at the cost of killing
the connection. The right fix is upstream: set
`idle_in_transaction_session_timeout` so the server ends these itself
([chunk 22d](22d-server-side-timeouts.md)), and find the client code that opened a
transaction and then went off to do something slow — usually an HTTP call inside a
transaction, which is its own kind of bug.

**★ You are given a script that cancels every query running longer than five minutes.
What do you say about it?**
That duration alone is not a policy. `pg_stat_activity` filtered only on runtime
cannot distinguish a runaway query from a nightly report, a schema migration, a
long-running `VACUUM` or a replication process — and cancelling those is worse than
the problem the script was written for. If it must exist, it should filter on
`application_name`, `usename` and `backend_type` so it only touches work it is
entitled to touch, and it should log what it killed rather than acting silently. But
the better answer is that this policy belongs in the database, not in a script racing
it: a `statement_timeout` set per role or per transaction bounds the same work with no
race, no PID lookup, no privileges and no window in which the query has already
started doing harm ([chunk 22e](22e-setting-the-timeouts.md)). A cancelling cron job is
a symptom of missing server-side timeouts.

---
← Prev: [22f3 · When a cancel lands](22f3-when-a-cancel-lands.md) · Index: [JDBC](README.md) · Next → [22g · ResultSetMetaData: names](22g-metadata.md)
