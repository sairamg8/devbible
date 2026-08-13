---
title: "bytea"
sidebar_label: "13 · bytea"
sidebar_position: 13
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex34-types-more.mjs`.

**Binary data, round-tripping cleanly to a Node `Buffer`, automatically compressed and moved
out of line by TOAST. It works well and you should still put large files in object storage —
for reasons that are about backups and memory, not correctness.**

## The round trip

```console
$ node ex34-types-more.mjs
=== 13. bytea ===
sent 102400 bytes -> length 102400, pg_column_size 1185 (TOAST compressed), back as Buffer of 102400 bytes, round trip identical: true
storage strategy: {"attstorage":"x"}
```

100 KB in, **100 KB out, byte-identical, as a Node `Buffer`** with no encoding work on either
side. `pg` handles `bytea` natively in both directions:

```js
const buf = await fs.readFile('logo.png');
await pool.query('INSERT INTO assets (id, data) VALUES ($1, $2)', [id, buf]);

const {rows} = await pool.query('SELECT data FROM assets WHERE id = $1', [id]);
Buffer.isBuffer(rows[0].data);   // true
```

**`pg_column_size` reported 1185 bytes for 100 KB of data** — that is `attstorage = 'x'`
(extended): TOAST compressed it, and this particular buffer was highly compressible. Real
images and video are already compressed and will not shrink; text-like payloads often will.

TOAST kicks in above roughly 2 KB per row: the value moves to a side table and only a pointer
stays in the main row, so `SELECT id, name FROM assets` does not read the blob at all. That is
why a `bytea` column does not slow down queries that ignore it.

## The hex representation, and the 2× wire cost

```console
hex format: {"hex":"48690a","b64":"SGkK","decoded":"\\x4869","as_text":"\\x4869"}
text over the wire is ~2x: {"text_len":6,"real_len":2}
```

**`bytea` renders as hex — two characters per byte, so the text form is twice the size.**
That is what psql shows, what `::text` produces, and what a client using the *text* protocol
transfers. `pg` uses the binary protocol for `bytea` results, so this cost does not apply to
the `Buffer` path — but it does apply to `\copy`, to `::text` in a query, and to any value you
embed in SQL as a literal.

```sql
encode(data, 'hex')      -- to a hex string
encode(data, 'base64')   -- to base64
decode('4869', 'hex')    -- back to bytea
'\x4869'::bytea          -- a bytea literal
octet_length(data)       -- real byte count  ← not length()
md5(data), sha256(data)  -- checksums, server-side
```

Use `octet_length()`, not `length()` — for `bytea` they agree, but the habit matters when the
column is text.

## When to store binary in PostgreSQL

**Reasonable:** small values that are genuinely part of the row and want its transactional
guarantees — password hashes, encryption keys and nonces, TOTP secrets, signatures, small
thumbnails, protocol blobs. Anything where "the file exists but the row does not" would be a
bug worth preventing.

**Not reasonable:** user uploads, images, video, documents at scale. The problems are
operational rather than technical:

- **Backups.** `pg_dump` and physical backups grow with your blobs. A 50 GB database of
  which 45 GB is images makes every restore, every replica rebuild and every major-version
  upgrade slower.
- **Memory.** A `bytea` value is materialised whole in the server's memory and again in the
  client's. There is no streaming read of part of a value through the normal protocol.
- **Replication and WAL.** Every write ships the full value to replicas.
- **Caching and delivery.** Object storage plus a CDN does range requests, resumable uploads
  and signed URLs; a database column does none of that.

The usual shape is metadata in PostgreSQL, bytes in object storage:

```sql
CREATE TABLE attachments (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  owner_id     bigint NOT NULL REFERENCES users(id),
  storage_key  text   NOT NULL UNIQUE,     -- s3://bucket/path
  content_type text   NOT NULL,
  byte_size    bigint NOT NULL CHECK (byte_size >= 0),
  sha256       bytea  NOT NULL,            -- a small bytea: entirely appropriate
  created_at   timestamptz NOT NULL DEFAULT now()
);
```

That keeps the transactional metadata where constraints and joins work, and the bytes where
they are cheap to serve. The cost is that deleting a row and deleting the object are no
longer one transaction — handle it with a deletion queue rather than pretending it is atomic.

## `bytea` versus large objects

PostgreSQL also has **large objects** (`lo_*` functions, `oid` columns), which support seek
and partial read up to 4 TB. They are rarely the right answer: they live outside the table in
`pg_largeobject`, they are not removed when the referencing row is deleted (you need
`lo_unlink` or `vacuumlo`), and permissions work differently. Use `bytea` unless you
specifically need server-side random access into a huge value.

## Trade-off

**`bytea` gives binary data full transactional guarantees and takes on every operational
cost of the database.** Correctness is not the issue — the round trip is exact and TOAST keeps
unrelated queries fast. What you are really deciding is whether these bytes should be in your
backups, your WAL stream, your replica bandwidth and your memory. For a 32-byte hash the
answer is obviously yes. For a 4 MB upload it is almost always no, and the price of moving it
out is losing atomicity between the row and the object.

## Gotchas

**Symptom:** Database size grows far faster than the row count
**Cause:** Blobs stored in `bytea`
**Fix:** Move large payloads to object storage; keep metadata in the database

**Symptom:** Backups and restores take hours
**Cause:** `pg_dump` includes every byte of every blob
**Fix:** As above; also consider excluding the table from logical dumps

**Symptom:** Memory spikes reading a few rows
**Cause:** `bytea` values are materialised whole, server-side and client-side
**Fix:** Do not `SELECT *` on tables with blobs; select the blob only when needed

**Symptom:** The value is twice the expected size in psql or a CSV export
**Cause:** The text representation is hex — two characters per byte
**Fix:** Expected; `pg` uses the binary protocol so `Buffer`s are unaffected

**Symptom:** A large object still occupies space after its row was deleted
**Cause:** Large objects are not removed by deleting the referencing row
**Fix:** `lo_unlink`, or `vacuumlo`; prefer `bytea`

**Symptom:** Deleting a row left an orphaned file in object storage
**Cause:** The row and the object are not in one transaction
**Fix:** A deletion queue or outbox, reconciled asynchronously

## Interview questions

**★ Does binary data round-trip exactly through `bytea`?**
Yes. Measured: 102 400 bytes in, 102 400 bytes out as a Node `Buffer`, byte-identical.

**★ What does TOAST do with a `bytea` column?**
Above about 2 KB it compresses the value and moves it to a side table, leaving a pointer in
the row. Measured `pg_column_size` of 1185 for a compressible 100 KB buffer, with
`attstorage = 'x'`. Queries that do not select the column never read it.

**★ Why not store uploads in the database?**
Backups, WAL and replication all grow with the blobs; values are materialised whole in
memory; and object storage plus a CDN provides range requests, resumable uploads and signed
URLs that a column cannot.

**★ What is the cost of the text representation?**
Hex is two characters per byte — measured `text_len` 6 for 2 real bytes. It affects `::text`,
`\copy` and literals, but not `pg`'s binary `Buffer` path.

**★ `bytea` or large objects?**
`bytea` almost always. Large objects allow seek and 4 TB values but are not deleted with the
referencing row and have separate permission handling.

**What is the usual production shape?**
Metadata in PostgreSQL (`storage_key`, `content_type`, `byte_size`, `sha256`) and bytes in
object storage, with a deletion queue to reconcile the two.

**Which function gives the byte length?**
`octet_length()`. It matches `length()` for `bytea`, but the habit matters for text columns
where they differ.

---

← [Casting](12-casting.md) · Next → [Network, geometric, citext](14-network-geo-citext.md)
