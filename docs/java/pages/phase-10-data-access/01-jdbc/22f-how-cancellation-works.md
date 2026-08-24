---
title: "A cancel does not travel on the connection running the query — it arrives at the front door on a new one, carrying a password"
sidebar_label: "22f · How cancellation works"
sidebar_position: 22.6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JDK 25 API for `java.sql.Statement`
> (docs.oracle.com/en/java/javase/25/docs/api/java.sql/java/sql/Statement.html),
> the PostgreSQL 18 manual *Frontend/Backend Protocol → Canceling Requests in
> Progress* (postgresql.org/docs/18/protocol-flow.html) and *Message Formats*
> (postgresql.org/docs/18/protocol-message-formats.html), and the pgjdbc source at
> tag `REL42.7.13` — `ConnectionFactoryImpl.java`, `ProtocolVersion.java`,
> `PGProperty.java`, `QueryExecutorBase.java`. JDK 25, JDBC 4.3, PostgreSQL 18,
> pgjdbc 42.7.13.

**Every other chunk in this topic has said "the driver sends a cancel" and moved
on. This is what that sentence hides. PostgreSQL will not accept a cancel on the
connection running your query, because that connection is busy and the backend is
not listening to it. So the driver opens a **brand new TCP connection**, writes
twelve bytes plus a secret key it was handed at login, and the server closes the
socket without answering. No acknowledgement, no success flag, no error. The manual
reduces the whole feature to one sentence: "Issuing a cancel simply improves the
odds that the current query will finish soon." Cancellation is a polite request
delivered through a side door — and that single fact explains almost every strange
thing `setQueryTimeout` does.**

## `cancel()` promises less than its name suggests

The JDK 25 javadoc for `Statement.cancel()` is two sentences long:

> "Cancels this `Statement` object if both the DBMS and driver support aborting an
> SQL statement. This method can be used by one thread to cancel a statement that
> is being executed by another thread."

Read the conditional. **"if both the DBMS and driver support"** — a driver that
does not is entitled to throw `SQLFeatureNotSupportedException`, which the method
declares. And notice what is absent: no promise that the statement stops, no
promise about when, and no way to find out afterwards. The method returns `void`.
It returns once the request has been *sent*, not once the query has died.

The second sentence is the useful one. `cancel()` is the **only** method on
`Statement` designed to be called from a different thread than the one running the
query. Everything else on a JDBC `Statement` is single-threaded by convention;
`cancel()` exists precisely so that somebody outside can call it.

```java
// The thread that runs the query must hand the Statement to whoever might cancel it.
PreparedStatement ps = conn.prepareStatement(REPORT_SQL);
worker.submit(() -> {
    try (ResultSet rs = ps.executeQuery()) {
        drain(rs);
    } catch (SQLException e) {
        // 57014 lands here if the cancel won the race
    }
});

// ... later, on the HTTP thread, when the user clicks "Stop":
ps.cancel();     // returns quickly; says nothing about whether it worked
```

⚠️ **This shape fights the resource rules.** The statement cannot sit inside a
try-with-resources block owned by the worker if another thread needs to call
`cancel()` on it, and the canceller must never `close()` it — the javadoc makes
`cancel()` on a closed `Statement` an error. Ownership has to be written down,
which is what [chunk 17](17-resource-handling.md) is about.

## The cancel goes down a different connection, and it has to

The PostgreSQL 18 manual explains the design in its first paragraph, and the reason
is performance, not security:

> "The cancel request is not sent directly on the open connection to the backend
> for reasons of implementation efficiency: we don't want to have the backend
> constantly checking for new input from the frontend during query processing.
> Cancel requests should be relatively infrequent, so we make them slightly
> cumbersome in order to avoid a penalty in the normal case."

A backend running your query is executing a plan. It is not asking "has the client
said anything?" between rows — that check would cost something on every query,
forever, to serve a case that almost never happens. So the protocol pushes the cost
onto the rare path. **The connection running the query is deaf until it produces
output.** Anything you want to say to that backend while it works must arrive by
another route:

> "To issue a cancel request, the frontend opens a new connection to the server and
> sends a CancelRequest message, rather than the StartupMessage message that would
> ordinarily be sent across a new connection. The server will process this request
> and then close the connection."

The same design decision explains a related oddity that
[chunk 22](22-timeouts-cancellation-metadata.md) leans on: a backend does not
notice that its client has hung up until it next tries to *write* output. A query
producing no rows for twenty minutes writes nothing for twenty minutes, so closing
your socket tells it nothing.

## What is actually in the packet

`CancelRequest` is the smallest message in the protocol. Four fields, no
authentication handshake, no startup message:

| Field | Type | Value |
|---|---|---|
| Length | `Int32` | length of the message contents in bytes, **including itself** |
| Cancel request code | `Int32` | `80877102` — "`1234` in the most significant 16 bits" and "`5678` in the least significant 16 bits" |
| Process ID | `Int32` | the PID of the backend to cancel |
| Secret key | `Byte`*n* | "extends to the end of the message as indicated by the length field" — maximum 256 bytes |

The PID and the key both arrive in a `BackendKeyData` message during login, which
the manual describes as the message that "identifies the message as cancellation key
data", adding that "the frontend must save these values to issue CancelRequest
messages later". Every JDBC connection therefore carries two values it will probably
never use.

## The key is the only credential, and it just got longer

There is no login on the cancel connection. No user, no password, no `pg_hba.conf`
role check. The secret key **is** the authorisation:

> "A CancelRequest message will be ignored unless it contains the same key data
> (PID and secret key) passed to the frontend during connection start-up."

The manual states the trade openly. Because the cancel arrives on a new connection,
"it is possible for the cancel request to be issued by any process, not just the
frontend whose query is to be canceled. This might provide additional flexibility
when building multiple-process applications. It also introduces a security risk, in
that unauthorized persons might try to cancel queries. The security risk is
addressed by requiring a dynamically generated secret key to be supplied in cancel
requests."

🔴 **The key length changed in PostgreSQL 18's protocol 3.2.** The manual is
explicit: "Before protocol version 3.2, the secret key was always 4 bytes long."
From 3.2 on, "the minimum and maximum key length are 4 and 256 bytes, respectively.
The PostgreSQL server only sends keys up to 32 bytes, but the larger maximum size
allows for future server versions, as well as connection poolers and other
middleware, to use longer keys." Four bytes is 32 bits of secret, guessable by
anyone who can open connections and keep trying; that is why it changed.

⚠️ **pgJDBC 42.7.13 still asks for 3.0 by default, so it still gets a 4-byte key.**
Reading `ConnectionFactoryImpl.java` at `REL42.7.13`, the driver reads the
`protocolVersion` property, whose declared default in `PGProperty.java` is the
string `"3"`; with no decimal point in it the code sets `protocolMajor = 3` and
`protocolMinor = 0`. The `ProtocolVersion` enum does know `v3_2`, and passing
`protocolVersion=3.2` requests it — the property's own description string
("currently only version 3 is supported") has simply not been updated to match. If
you want PostgreSQL 18's longer cancel keys through JDBC you have to ask for the
newer protocol explicitly, and test that login still behaves.

What the driver then does with all this — the state machine, the socket, and one
unpleasant surprise about encryption — is
[chunk 22f2](22f2-what-pgjdbc-actually-does.md).

## Gotchas

**⚠️ Treating a 4-byte cancel key as a meaningful secret**
**Symptom:** a security review asks how a cancel request is authorised, and the
honest answer is "32 bits, from anywhere that can reach port 5432".
**Cause:** protocol 3.0 fixes the key at four bytes, and pgjdbc 42.7.13 negotiates
3.0 unless told otherwise. There is no authentication step on that connection at
all.
**Fix:** treat network reachability as the real control — keep the database port
unreachable from anywhere that has no business cancelling queries — and consider
`protocolVersion=3.2` against a PostgreSQL 18 server for a longer key, after
testing, because it changes what gets negotiated at login.

**⚠️ Firewalls, proxies and NAT rules that only understand normal sessions**
**Symptom:** cancels work on a laptop and are silently ignored in production.
**Cause:** a cancel is a *new inbound connection* that never sends a
StartupMessage. Anything in the path that expects a normal session — a proxy, a NAT
rule with a session table, a security group that permits established connections but
throttles new ones — can drop it, and nothing in the protocol will tell you.
**Fix:** if cancels matter, test them through the whole production path rather than
against a local database, and treat "works locally" as no evidence at all.

**⚠️ Cancelling through a connection pooler and reaching the wrong backend**
**Symptom:** a cancel that does nothing, or — worse — stops a query that was not
yours.
**Cause:** the PID and key the driver holds are whatever it was given by the thing
it connected to. If that was a pooler rather than PostgreSQL itself, the pooler owns
the mapping from that key to a real backend, and a pooler that multiplexes client
sessions onto shared server connections may have moved yours since.
**Fix:** confirm your pooler documents cancel handling for the pooling mode you
actually run, and prefer a server-side `statement_timeout`
([chunk 22d](22d-server-side-timeouts.md)), which needs no side channel at all.

**⚠️ Assuming the second connection is free because the message is tiny**
**Symptom:** a burst of timeouts producing a burst of connection attempts, tipping
a `max_connections` limit or a firewall's connection-tracking table over during an
incident.
**Cause:** twelve bytes of payload still needs a DNS lookup and a TCP handshake, and
one is spent per timed-out statement at exactly the moment the system is already
unhealthy.
**Fix:** set the client timeout *above* the server's `statement_timeout` so the
server usually wins the race and no cancel is ever sent — the ordering rule in
[chunk 22e](22e-setting-the-timeouts.md).

**⚠️ Expecting the protocol to tell you anything back**
**Symptom:** someone looks for a return value, a status byte, or a log line saying
the cancel was accepted, and finds none.
**Cause:** "For security reasons, no direct reply is made to the cancel request
message." The server processes the request and closes the socket, and that closure
is the entire response.
**Fix:** stop looking on the cancel connection. The only evidence a cancel worked
appears on the *original* connection, as an error thrown at the thread still waiting
in `executeQuery` — see [chunk 22f3](22f3-when-a-cancel-lands.md).

**⚠️ Reading `1234` and `5678` as a version number**
**Symptom:** confusion when a packet capture shows those two numbers where a
protocol version normally sits.
**Cause:** the cancel request code deliberately occupies the same position as the
protocol version in a StartupMessage, and the manual says it "must not be the same
as any protocol version number" — the two halves are `1234` and `5678` so that no
real version can collide with it.
**Fix:** none needed; recognise `80877102` at the head of a connection as "this is
a cancel, not a login".

## Interview questions

**★ Why can't PostgreSQL accept a cancel on the connection that is running the
query?**
Because the backend is not reading that connection while it works. The manual gives
the reason as implementation efficiency: "we don't want to have the backend
constantly checking for new input from the frontend during query processing. Cancel
requests should be relatively infrequent, so we make them slightly cumbersome in
order to avoid a penalty in the normal case." A check for pending frontend input
would have to live somewhere in the executor's hot path, costing every query a
little to serve a case that almost never arises. So the protocol trades convenience
away on the rare path, and that one decision produces the entire shape of
cancellation: a separate connection, a shared secret, no reply and no guarantee. It
also explains the related oddity that a backend does not notice a dead client until
it next tries to write output, which for a long aggregate can be many minutes away.

**★ How does the server know a cancel request is legitimate, given there is no
login?**
By the pair of values it handed out at startup. During connection setup the server
sends a `BackendKeyData` message containing the backend's process ID and a
dynamically generated secret key, and the manual says the frontend "must save these
values to issue CancelRequest messages later". A `CancelRequest` "will be ignored
unless it contains the same key data (PID and secret key) passed to the frontend
during connection start-up". That key is the entire authorisation — no user, no
password, no role check. The manual is candid about the trade: because the cancel
arrives on a new connection it could come from any process, which is useful when
building multi-process applications and is simultaneously "a security risk, in that
unauthorized persons might try to cancel queries", one "addressed by requiring a
dynamically generated secret key".

**★ Describe the CancelRequest message.**
Four fields and nothing else. An `Int32` length that includes itself; an `Int32`
cancel request code of `80877102`, which the manual describes as `1234` in the most
significant 16 bits and `5678` in the least significant, chosen so it can never
collide with a protocol version number in the same position; an `Int32` process ID
identifying the backend to cancel; and then the secret key as raw bytes, which
"extends to the end of the message as indicated by the length field". No message
type byte, because it is the first thing sent on a fresh connection where a
StartupMessage would normally go. The key was fixed at 4 bytes before protocol 3.2;
from 3.2 it can be 4 to 256 bytes, though PostgreSQL itself sends at most 32 — the
larger ceiling exists so that poolers and middleware can mint longer keys of their
own.

**★ You are running PostgreSQL 18 and want the longer cancel keys through JDBC.
What do you have to do, and what should you check?**
You have to ask for protocol 3.2 explicitly, because pgjdbc 42.7.13 does not
negotiate it by default. Reading `ConnectionFactoryImpl` at that tag, the driver
takes the `protocolVersion` property, whose default in `PGProperty` is the string
`"3"`, and with no decimal point it resolves to major 3, minor 0 — so a default
connection is a 3.0 connection with a 4-byte key. Setting `protocolVersion=3.2`
selects the `v3_2` value that the driver's `ProtocolVersion` enum already knows
about. What to check: the property's own description string still says "currently
only version 3 is supported", which means the documentation is behind the code and
you should verify behaviour rather than trusting either; and because this changes
what is negotiated during login, it needs testing against your real server and any
pooler in the path, not just a local database.

**★ What is the smallest set of things that must be true for a cancel to work at
all?**
Four, and every one is a real failure mode. The client must already hold a PID and
cancel key, which means `BackendKeyData` must have arrived — a cancel racing
connection setup has nothing to send. The statement must genuinely be executing,
because a cancel that arrives after the backend finished "will have no effect". A
brand new TCP connection to the database host must be possible right now from this
process, which is a different reachability question from "we already have a
connection", and is why cancels fail behind some proxies and poolers. And the PID
and key must identify a backend the server still recognises as running that query,
which is not the case if a pooler minted them or the work has moved. Miss any one
and the outcome is identical: nothing happens, silently.

---
<!--FOOTER-->
