---
title: "When identity is the equality you want — connections, tasks and listeners belong in a set as themselves, the set's strong reference is the leak in a listener registry and the lifeline for a background task, and entities loaded twice are two elements"
sidebar_label: "8b · When identity is the equality you want"
sidebar_position: 21
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 on **Python 3.14.7** against the
> [glossary](https://docs.python.org/3.14/glossary.html#term-hashable),
> [`weakref.WeakSet`](https://docs.python.org/3.14/library/weakref.html#weakref.WeakSet) and
> [`asyncio.create_task`](https://docs.python.org/3.14/library/asyncio-task.html#asyncio.create_task).
> Split out of [8 · Custom classes as elements](08-custom-classes-as-elements.md) on a concept
> boundary. Documentation-verified — **no sandbox run, no program output**.

**[8](08-custom-classes-as-elements.md) is about giving objects value semantics. Most objects in a
running service should not have them: a connection, a task, a subscriber is a *thing*, and two of
them with identical attributes are still two. For those, the default identity hash is correct and a
set is the natural registry — with one property to decide deliberately: a set holds a strong
reference to every element.**

## Identity-hashed elements: registries

For objects that *are* something, identity is the right semantics and the set is the natural
registry. The trap is the other half of the set's job: it holds a **strong reference**, so everything
in it stays alive as long as the set does. A listener registry that nobody unregisters from is a
memory leak. When membership should not keep the object alive, the standard library has the type:

> *"Set class that keeps weak references to its elements. An element will be discarded when no strong
> reference to it exists any more."* — [`weakref.WeakSet`](https://docs.python.org/3.14/library/weakref.html#weakref.WeakSet)

```python
import weakref
from collections.abc import Callable


class EventBus:
    def __init__(self) -> None:
        self._listeners: weakref.WeakSet[Listener] = weakref.WeakSet()

    def subscribe(self, listener: "Listener") -> None:
        self._listeners.add(listener)            # does not keep `listener` alive

    def publish(self, event: str) -> None:
        for listener in list(self._listeners):   # snapshot: a listener may be collected mid-loop
            listener.handle(event)


class Listener:
    def __init__(self, on_event: Callable[[str], None]) -> None:
        self.handle = on_event
```

The opposite case is in the `asyncio` docs, where the strong reference is the point: the event loop
keeps only weak references to tasks, so a fire-and-forget task needs a set to keep it alive —

> *"Save a reference to the result of this function, to avoid a task disappearing mid-execution. The
> event loop only keeps weak references to tasks. A task that isn't referenced elsewhere may get
> garbage collected at any time, even before it's done."* —
> [`asyncio.create_task`](https://docs.python.org/3.14/library/asyncio-task.html#asyncio.create_task)

— and the documented pattern adds each task to a set and registers `background_tasks.discard` as the
task's done callback, so the set releases it on completion. The same page's caveat applies:
exceptions from such tasks are never retrieved, and `asyncio.TaskGroup` is the alternative that
awaits them.

## Gotchas

**★ Symptom: deduplicating entities loaded from the database or an API removes nothing.** Cause: the
default hash and equality are identity, and every load builds new objects. Fix: deduplicate on the
key — a set of IDs, or a dict keyed by ID ([9 · Diffing ID sets](09-diffing-id-sets.md)) — rather than making ORM
entities hash by value.

**Symptom: memory grows with every request, and a heap dump shows thousands of handler objects held
by one module-level set.** Cause: a set keeps strong references. Fix: `weakref.WeakSet` for
registries whose members should die with their owners — `EventBus` above.

**Symptom: background `asyncio` tasks occasionally vanish before finishing.** Cause: the event loop
holds only weak references to tasks. Fix: the documented pattern — a set of tasks with
`task.add_done_callback(background_tasks.discard)` — or `asyncio.TaskGroup`.

## Interview questions

**★ When should objects in a set be compared by identity rather than value?**
When the object *is* the thing rather than a description of it — a connection, a task, a listener, an
open file. Two such objects with identical attributes are still two things. The default identity
semantics are right for them, and a `WeakSet` is the variant to use when membership must not keep
them alive.

---

← Prev: [Custom classes as elements](08-custom-classes-as-elements.md) · [Topic index](README.md) · Next → [Diffing ID sets](09-diffing-id-sets.md)
