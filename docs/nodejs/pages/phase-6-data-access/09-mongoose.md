---
title: "Mongoose: schemas, models, middleware"
sidebar_label: "09 · Mongoose"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** — `mongoose` 9.9.1 on top of `mongodb` 7.5.0,
> against **MongoDB 8.2.12** (single-node replica set).

**Mongoose adds the schema MongoDB does not have.** Genuinely useful — and every one
of its conveniences has an edge where it does something you did not ask for. The
shape of the tool, then the four places its magic hurts.

## The three objects

```js
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: {type: String, required: true, unique: true, lowercase: true, trim: true},
  name:  {type: String, maxlength: 30},
  age:   Number,
  createdAt: {type: Date, default: Date.now},
});

const User = mongoose.model('User', userSchema);

await mongoose.connect('mongodb://127.0.0.1:57017/shop');
const ada = await User.create({email: '  ADA@Example.com ', name: 'Ada', age: '41'});
console.log(ada.email, typeof ada.age);
```

```console
ada@example.com number
```

A **schema** declares fields, types, defaults and validators. A **model** is the
schema bound to a collection — `'User'` becomes `users`, lowercased and pluralised.
A **document** is one hydrated instance, with getters, validators and change
tracking attached.

Note what that one `create` did unasked: trimmed the whitespace, lowercased the
address, and **cast the string `'41'` into the number `41`**.

## Casting and stripping — the part people rely on without knowing

```js
const u = await User.create({
  email: 'grace@example.com', name: 'Grace', age: '41', isAdmin: true,
});
console.log(u.toObject());
```

```console
{
  email: 'grace@example.com', name: 'Grace', age: 41, isAdmin: undefined,
  _id: new ObjectId('...'), createdAt: 2026-08-10T12:41:07.884Z
}
```

`isAdmin` is **gone**. It was not in the schema, so Mongoose dropped it silently —
no error, no warning. This is a real security property (a request body cannot inject
a privilege field) and a real footgun (a typo'd field name vanishes and you debug the
wrong layer for an hour). `strict: 'throw'` on the schema turns the silence into an
error, which is what you want in development.

Casting has a boundary. Values are cast, **query operators are not**:

```js
await User.find({age: {$ne: null}});        // fine — $ne is an operator
await User.find({age: 'not-a-number'});     // CastError
```

```console
CastError: Cast to Number failed for value "not-a-number" (type string) at path "age"
```

That is the same hole as [page 02](./02-parameterized-queries.md): a request body
reaching a query as an object still carries `$ne` through. Mongoose's casting is a
type check, not an injection defence. Wrap user input in `String(...)` or use
`sanitizeFilter`.

## Validators run on `create`, not on `update`

This one is worth memorising, because the failure is silent data corruption.

```js
await User.create({email: 'x@example.com', name: 'x'.repeat(40)});
```

```console
ValidationError: User validation failed: name: Path `name` is longer than
the maximum allowed length (30).
```

```js
await User.updateOne({email: 'ada@example.com'}, {name: 'x'.repeat(40)});
const back = await User.findOne({email: 'ada@example.com'});
console.log(back.name.length);
```

```console
40
```

**A 40-character name was written past a `maxlength: 30`.** Update operations skip
validators by default — the document is never hydrated, so there is nothing to
validate. The fix is per-call or global:

```js
await User.updateOne(filter, update, {runValidators: true});
mongoose.set('runValidators', true);   // or set it once, globally
```

Even then, validators only see the fields in the update, not the resulting document,
so a validator that compares two fields cannot work on an update.

## Middleware fires on the operation, not on the change

Hooks are per-operation, and the names do not overlap the way people assume.

```js
userSchema.pre('save',            function () { console.log('pre save'); });
userSchema.pre('updateOne',       function () { console.log('pre updateOne'); });
userSchema.pre('findOneAndUpdate',function () { console.log('pre findOneAndUpdate'); });
```

```console
$ node ex8-mongoose.mjs
User.create(...)              -> pre save
doc.save()                    -> pre save
User.updateOne(...)           -> pre updateOne
User.findOneAndUpdate(...)    -> pre findOneAndUpdate
User.updateMany(...)          -> (nothing)
```

**`pre('save')` does not fire for updates.** If your password hashing lives in a
`pre('save')` hook — the canonical Mongoose tutorial — then an
`updateOne({password})` writes the plaintext. Same for `findOneAndUpdate`: it fires
only its own hook, never `updateOne`'s, even though both are updates.

Query middleware also has a different `this`: in `pre('save')` it is the document,
in `pre('updateOne')` it is the **query**, so you reach the payload through
`this.getUpdate()`.

## `{new: true}` is deprecated in Mongoose 9

```js
const updated = await User.findOneAndUpdate(filter, {age: 42}, {new: true});
```

```console
(node:41288) [MONGOOSE] DeprecationWarning: The `new` option is deprecated,
use `returnDocument: 'after'` instead.
```

Use `returnDocument: 'after'`. And remember the default is `'before'` — omit the
option entirely and you get the **pre-update document**, which reads as "my update
did not work" when it worked fine.

```js
const updated = await User.findOneAndUpdate(
  filter, {age: 42}, {returnDocument: 'after', runValidators: true});
```

## Hydration costs — `.lean()`

Every document Mongoose returns is a full instance with getters, setters, a change
tracker and validators. For a read you are about to serialise to JSON, that is
wasted work.

5001 documents, same query, same machine:

```console
hydrated documents   136 ms
.lean()               57 ms
RSS after hydrated   166 MB
```

**Roughly 2.4× on a read path.** `.lean()` returns plain objects:

```js
const rows = await User.find({age: {$gte: 18}}).lean();
```

The cost: no `save()`, no virtuals, no getters, and `_id` is a raw `ObjectId`. That
is exactly right for a list endpoint and exactly wrong for anything you intend to
mutate. Default to `.lean()` on reads that leave through `res.json()`.

## Buffering, connecting and `autoIndex`

Mongoose lets you issue queries **before** `connect()` resolves — they are buffered
and run once the connection is up:

```js
const p = User.findOne({email: 'ada@example.com'});   // no connection yet
await mongoose.connect(uri);
console.log(await p);                                  // resolves fine
```

Convenient in scripts, dangerous in a server: a broken connection string produces
requests that hang for `bufferTimeoutMS` (10 s default) instead of failing fast at
boot. Await `connect()` at startup like any other dependency
([page 03](./03-driver-lifecycle.md)).

`autoIndex` defaults to **`true`** — on model compilation Mongoose issues
`createIndex` for every schema index. Right in development; in production it means
every deploy of every instance fires index builds against the primary. Set
`autoIndex: false` and create indexes in a migration ([page 11](./11-migrations.md)).

## Where Mongoose earns its place, and where it does not

**Take it when** the shape of your documents matters and you want one file declaring
it, or when hooks genuinely model your domain — timestamps, soft deletes, slugging.

**Skip it when** the workload is aggregation-heavy — `Model.aggregate()` is the raw
pipeline with none of the schema benefits and **bypasses casting entirely** — or when
streaming large result sets, where hydration is pure overhead
([page 16](./16-cursors.md)).

It is not a substitute for knowing the driver: everything in
[page 05](./05-mongodb-from-node.md) still applies underneath, and
`mongoose.connection.getClient()` returns the `MongoClient` when you need a session
for a transaction ([page 06](./06-transactions.md)).

## Gotchas

**Symptom:** A field you sent is missing from the saved document
**Cause:** It is not in the schema; `strict` mode drops unknown paths silently.
**Fix:** Add it to the schema, or set `strict: 'throw'` so the typo raises.

**Symptom:** Data violates a validator that is clearly declared
**Cause:** It was written by `updateOne` / `findOneAndUpdate`, which skip validators.
**Fix:** `runValidators: true` per call, or `mongoose.set('runValidators', true)`.

**Symptom:** Passwords are in plaintext for some users only
**Cause:** Hashing lives in `pre('save')`; those rows were written by an update.
**Fix:** Add the equivalent `pre('findOneAndUpdate')` / `pre('updateOne')` hooks, or
move hashing out of middleware into the one function that sets passwords.

**Symptom:** `findOneAndUpdate` returns the old values
**Cause:** `returnDocument` defaults to `'before'`.
**Fix:** Pass `returnDocument: 'after'` — not `{new: true}`, which is deprecated in
Mongoose 9.

**Symptom:** A list endpoint is slow and memory-heavy for its row count
**Cause:** Full hydration of documents that are immediately serialised.
**Fix:** `.lean()` — measured 136 ms → 57 ms for 5001 documents.

**Symptom:** Every deploy causes a write spike on the primary
**Cause:** `autoIndex: true` re-issues `createIndex` from every instance.
**Fix:** `autoIndex: false` in production; create indexes in a migration.

**Symptom:** Requests hang for 10 s instead of erroring when the database is down
**Cause:** Query buffering; the connection never came up.
**Fix:** Await `connect()` at boot and fail startup; tune `bufferTimeoutMS`.

## Interview questions

**★ Why does Mongoose exist if MongoDB is schemaless?**
Schemaless means the *server* enforces nothing; the application still has a shape.
Mongoose moves that shape into one declared place and gets casting, defaults,
validation and hooks from it. The trade is that the shape is only enforced by the
code path that goes through Mongoose — a raw driver write, or an `aggregate`
pipeline, bypasses all of it.

**★ Do validators run on updates?**
No. `updateOne`, `updateMany` and `findOneAndUpdate` skip them by default, because no
document is hydrated. Measured: a 40-character name was written past `maxlength: 30`.
Pass `runValidators: true`, and know that it only validates the fields present in the
update.

**★ What does `.lean()` do, and what does it cost?**
It returns plain JavaScript objects instead of Mongoose documents — measured 136 ms
versus 57 ms for 5001 documents. You lose `save()`, virtuals, getters and custom
methods, so it suits reads that go straight to JSON and not documents you intend to
modify.

**★ Your password hashing is in a `pre('save')` hook. What breaks?**
Any write that does not go through `save()` — `updateOne`, `findOneAndUpdate`,
`updateMany`, or a raw driver call — stores the plaintext, because `pre('save')` does
not fire for updates. Hooks are bound to the operation, not to the change.

**Does Mongoose protect you from NoSQL injection?**
Partly, and not where it counts. It casts values, so `{age: 'abc'}` throws — but
operators are not cast, so a body of `{"password": {"$ne": null}}` still reaches the
query as an operator. Coerce user input with `String(...)` or use `sanitizeFilter`.

**What is `autoIndex` and why turn it off in production?**
On model compilation Mongoose issues `createIndex` for every schema index. It
defaults to `true`, so every instance of every deploy hits the primary with index
builds. Turn it off and create indexes in a migration.

---

← Prev: [Drivers vs builders vs ORMs](./08-drivers-builders-orms.md) · Next → [The repository pattern](./10-repository-pattern.md)
