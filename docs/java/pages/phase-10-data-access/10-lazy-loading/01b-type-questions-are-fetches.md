---
title: "Almost every operation that answers a type or identity question about a proxy is a fetch wearing a disguise, so equals, toString and unproxy all throw on a detached graph"
sidebar_label: "01b · Type questions are fetches"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the `org.hibernate.Hibernate` javadoc for `getClass`, `unproxy`,
> `isInitialized` and `initialize`
> ([docs.hibernate.org/orm/7.4/javadocs/org/hibernate/Hibernate.html](https://docs.hibernate.org/orm/7.4/javadocs/org/hibernate/Hibernate.html)),
> the Hibernate ORM 7.4 *Introduction* §3.26 *equals() and hashCode()* and §5.6 *Proxies and
> lazy fetching*
> ([docs.hibernate.org/orm/7.4/introduction/html_single/](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)),
> and the `7.4` source of `AbstractLazyInitializer`
> ([github.com/hibernate/hibernate-orm](https://github.com/hibernate/hibernate-orm/blob/7.4/hibernate-core/src/main/java/org/hibernate/proxy/AbstractLazyInitializer.java)).
> JDK 25, Hibernate ORM 7.4.1, Jakarta Persistence 3.2.

**A lazy field is easy to spot when the code reads it: `order.getCustomer().getName()` is
obviously a fetch. What catches people is the code that never mentions the association at
all — an `equals` call, a `toString` in a log line, a `Set.contains`, a `switch` on the
concrete type, an `unproxy` written to make a cast work. Every one of those goes through an
accessor or through Hibernate's own reflection helpers, and every one of those is a fetch.
On an attached graph they are queries you did not plan. On a detached graph they are
`LazyInitializationException`s from a line that looks like pure Java.**

:::note What is already covered elsewhere
**[Topic 07 · 14 · What a lazy association is](../07-relationships-fetch/14-what-a-lazy-association-is.md)**
works through *why* `getClass()` and `instanceof` behave oddly on a proxy, and
**[Topic 07 · 15 · equals, hashCode, toString](../07-relationships-fetch/15-equals-hashcode-tostring.md)**
works through how to write those three methods correctly. This chunk takes the same
operations and asks a different question: **which of them hit the database, and therefore
which of them throw once the session is gone.**
:::

## The two free operations, and everything else

Hibernate's *Introduction* is explicit that the free list is short. There are exactly two
things it names as not fetching: reading the identifier, and using the proxy as the target
of an association via `getReference`. Then it says the rest go the other way — *"except for
`getReference()`, the following operations all result in immediate access to the
database"*.

That is the whole rule, and it is worth stating in reverse because that is how you will use
it: **assume any call on a proxy fetches unless you can name the reason it does not.**

## The type helpers, one at a time

### `instanceof` — free, and frequently wrong

A `x instanceof Publisher` test never initialises anything. The generated class *is* a
subclass of `Publisher`, so the JVM answers from the class hierarchy without calling a
method. It is safe on a detached graph.

It is also unreliable the moment inheritance is involved, because for a polymorphic
association Hibernate builds the proxy from the hierarchy root and does not know the
concrete subtype. `payment instanceof CardPayment` is `false` for a proxy of a row that is
a card payment. That failure is silent — no exception, just a branch that does not run.
The mechanism and Hibernate's `@ConcreteProxy` escape hatch are in
**[Topic 07 · 14](../07-relationships-fetch/14-what-a-lazy-association-is.md)**.

### `getClass()` — free, and answers a question you did not ask

`proxy.getClass()` returns the generated subclass. No fetch, no exception. It is also almost
never the answer any calling code wanted: a type registry keyed on `Publisher.class`, a
serialiser configured per class, a hand-written `equals` starting with
`getClass() != o.getClass()` — all of them see a class name that did not exist at compile
time and take the wrong branch.

### `Hibernate.getClass(Object)` — **a fetch**

The javadoc says it plainly: *"Get the true, underlying class of a proxied entity. This
operation will initialize a proxy by side effect."*

This is the one people reach for when `getClass()` gave the wrong answer, and it is a
different kind of call entirely. It is a query. On a detached proxy it throws.

### `Hibernate.unproxy(Object)` and `unproxy(Object, Class)` — **fetches, and they say so**

*"If the given object is not a proxy, return it. But, if it is a proxy, ensure that the
proxy is initialized, and return a direct reference to its proxied entity object."*

Both overloads document `@throws LazyInitializationException` — *"if called on an
uninitialized proxy not associated with an open session."*

So `unproxy` is not a way to *avoid* the exception. It is one of the few APIs in Hibernate
whose javadoc names it as a thing it throws. Reaching for `unproxy` to make a cast or an
`instanceof` work is reaching for a database round trip to answer a question about types,
and it will only work while the session is open.

### `Hibernate.isInitialized(Object)` — free, and asymmetric

*"Determines if the given proxy or persistent collection is initialized."* It returns true
*"if the argument is already initialized, or is not a proxy or collection."*

Read the second clause carefully. **`isInitialized` returns `true` for anything that is not
lazy at all** — a `String`, a `null`, an already-loaded entity. So it answers "is it safe to
touch this?" correctly, and it does not answer "is this a proxy?" at all. Code that uses it
as a proxy test is testing the wrong thing.

### `Hibernate.initialize(Object)` — a fetch, and it throws the other exception

*"Force initialization of a proxy or persistent collection. In the case of a many-valued
association, only the collection itself is initialized."* It throws `HibernateException` if
the proxy cannot be initialized, *"for example if the Session was closed"*. Treated properly
in **[06 · Fixes that are not fixes](06-fixes-that-are-not-fixes.md)**.

⚠️ **"only the collection itself is initialized"** is the clause people miss. Initialising
`order.getLines()` loads the line rows; it does **not** initialise the proxy each line holds
for its `Product`. A one-level fix on a two-level problem looks like it worked, right up to
the second level.

## Where this bites in ordinary code

None of the following mentions a lazy association, and all of them touch one.

**`equals` on entities.** Hibernate's own rule for writing it — *"you should use
`instanceof`, not `getClass()` to check the type of the argument, and should access fields
of the passed entity via its accessor methods"* — makes the correct implementation a fetch.
`other.getIsbn()` on a proxy is a query, because the proxy's own `isbn` field is empty. The
correctly-written `equals` is the one that throws on a detached graph; the incorrectly
written one silently returns `false`.

**`hashCode`, therefore `HashSet` and `HashMap`.** Adding a detached entity to a set calls
`hashCode`, which calls an accessor, which fetches. So does `contains`, so does a map
lookup. A method that builds a `Set<Order>` out of detached objects is doing data access
inside a data structure.

**`toString`, therefore every log line.** A generated `toString` that includes associations
walks the graph. On a detached object the log statement throws — and it throws from inside
your logging framework, at a line that reads `log.debug("saved {}", order)`, which is a
spectacularly confusing place to find a persistence exception. Worse, if the logger is at a
level that would not have emitted anything, some argument-formatting paths still build the
string.

**`Comparator`s and sorting.** `list.sort(comparing(Order::getCustomerName))` on detached
entities is one fetch per comparison.

**Bean mapping libraries.** Anything reflective that reads every getter — a mapper, a
validator, a diffing tool, an equality assertion in a test — walks the whole reachable
graph by construction.

**Debuggers.** Expanding a variable calls `toString` or reads fields depending on the IDE,
so inspecting a detached object in a debugger can produce the exception *in the debugger*
rather than in the program, and inspecting an attached one can initialise associations and
make a bug vanish while you look at it.

## The pattern under all of these

Every case above has the same shape: **a general-purpose mechanism that assumes plain Java
objects is handed something that is not one.** `HashSet` assumes `hashCode` is a pure
function of memory. A logger assumes `toString` is cheap and total. A mapper assumes a
getter returns a field. An entity with a lazy association violates all three, and it does so
invisibly, because the type is still `Order`.

That is the argument for the boundary this topic builds toward: not "be careful where you
call `equals`", which is unenforceable, but **do not hand an entity to code that was written
for values** — see **[05 · The DTO boundary](05-the-dto-boundary.md)**.

## Gotchas

**★ `unproxy` is documented to throw the exception you are probably using it to avoid.**
Both overloads list `LazyInitializationException` in their `@throws`. It resolves a proxy
into a real instance *by fetching it*; there is no offline mode.

**★ `Hibernate.getClass(x)` and `x.getClass()` are completely different operations.** One is
a free JVM call that gives you the generated subclass; the other is a documented fetch that
gives you the real class. They differ by one static import and a database round trip.

**★ `isInitialized` returns `true` for things that were never lazy.** Including `null`. A
guard written as `if (Hibernate.isInitialized(x)) use(x);` passes for every non-proxy value,
which is usually what you want — and is not a test for "this is a proxy".

**★ `Hibernate.initialize(collection)` does not initialise what is inside the collection.**
The javadoc restricts it explicitly to the collection itself. Two-level graphs need two
levels of work, which is where the loop in
**[Topic 08 · 17 · Initialize loops](../08-the-n-plus-1-problem/17-initialize-loops.md)**
comes from.

**★ A correctly written `equals` is more likely to throw than a broken one.** Hibernate
tells you to read the other object through its accessors, which is the thing that fetches.
The version that reads fields directly never throws and quietly returns `false` for two
references to the same row. Neither is acceptable; the fix is a natural key, per
**[Topic 06 · 10b · Fixing entity equality](../06-jpa-hibernate-model/10b-fixing-entity-equality.md)**.

**★ Logging is data access.** Any `toString` reaching an association makes every log
statement a potential query and a potential exception. This is not hypothetical for
Lombok's `@Data` or `@ToString`, which include every field by default.

**★ The debugger changes the program.** Inspecting an attached entity can initialise
associations, so a bug reproduced only when nobody is watching is not a ghost — it is the
absence of the debugger's incidental fetches.

**★ Reflection-based test assertions walk the entire graph.** An assertion library comparing
two entities field by field will touch every association on both sides. A test that passes
inside a transaction and fails outside one usually did not change behaviour; it changed how
much of the graph the assertion pulled.

**★ `instanceof` is safe on a detached graph and still wrong for hierarchies.** Being free
of the exception does not make it correct — for a polymorphic association it answers about
the root type. Safety and correctness are separate questions here.

## Interview questions

**★ Which operations on a proxy do not hit the database?**
Reading the identifier and using the proxy as the target of an association via
`getReference` — the two Hibernate's documentation names — plus the pure JVM operations that
never call a method on it: `instanceof`, `getClass()`, reference comparison, and
`Hibernate.isInitialized`. Everything else results in immediate database access, which the
documentation states directly. The practical version of the rule is the inverse: assume any
call fetches unless you can say why it does not.

**★ Why does `Hibernate.unproxy` not solve `LazyInitializationException`?**
Because it is an initialisation, not a conversion. Its javadoc says it ensures the proxy is
initialized and returns a direct reference to the proxied entity, and both overloads declare
`@throws LazyInitializationException` if called on an uninitialized proxy not associated with
an open session. It is useful for turning a proxy into a real instance *while the session is
open* — typically so a cast or a serialiser behaves — and it is exactly as unavailable as any
other fetch once the session has gone.

**★ How can a `log.debug` line throw a persistence exception?**
Because `toString` on an entity that includes its associations walks the object graph, and
walking it means initialising it. On a detached entity that is a `LazyInitializationException`
raised from inside the logging framework's argument formatting. It is one of the most
confusing forms of this failure, because the stack trace points at logging rather than at
data access, and because a generated `toString` — Lombok's `@Data`, or an IDE template —
includes associations by default without anyone deciding it should.

**★ Why can adding an entity to a `HashSet` cause a query?**
Because `HashSet.add` calls `hashCode`, and a correctly written entity `hashCode` reads a
natural key through an accessor. If the object is a proxy, the accessor triggers the fetch;
if it is detached, it throws. The general point is that collection classes assume `hashCode`
and `equals` are cheap, total, pure functions, and an entity satisfies none of the three.
That is a reason to keep entities out of hash-based structures that outlive the session, not
a reason to remove the accessors.

**★ Hibernate says `equals` must read the other object through its accessors. Is that not
asking for trouble?**
It is asking for a fetch, and it is still right, because the alternative is worse. A proxy's
own fields are empty, so reading `other.isbn` directly gets `null` and the method returns
`false` for two references to the same row — a silent wrong answer inside every collection
that entity is a member of. Reading through `getIsbn()` gets the correct value at the cost of
initialising the proxy. The real resolution is to base equality on a natural key that is
assigned before persistence and never changes, so the value is present without a fetch in the
overwhelming majority of cases.

**★ What does `Hibernate.initialize` on a collection actually guarantee?**
Only that the collection itself is loaded — the javadoc says so in as many words: *"In the
case of a many-valued association, only the collection itself is initialized."* The entities
inside it may each hold their own uninitialised proxies. So it fixes exactly one level of the
graph, and code that calls it and then serialises the result gets the exception from the
second level instead of the first.

**★ Why does `Hibernate.isInitialized` return `true` for a `String`?**
Because its contract is "is this safe to touch", not "is this a proxy". The javadoc says it
returns true if the argument is already initialized *or is not a proxy or collection*. That
makes it a correct guard in generic code that does not know what it has been handed, and a
useless test if what you actually wanted to know is whether Hibernate is standing in for
something.

**★ A bug only reproduces when you are not debugging it. What would you suspect first?**
That the debugger is initialising associations as a side effect of displaying variables.
Expanding a lazy field, or an IDE calling `toString` to render a value, performs the fetch
that the program itself was never going to perform, so the program under the debugger has a
more complete object graph than the program in production. The way to check it is to stop
inspecting and instead assert on `Hibernate.isInitialized` at the point of interest, which
answers the question without changing it.

<!--FOOTER-->
