---
title: "total_ordering writes four comparison methods from the one you supplied, and charges you execution speed and stack-trace clarity for the convenience"
sidebar_label: "9 · `total_ordering`"
sidebar_position: 79
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14
> [`functools.total_ordering`](https://docs.python.org/3.14/library/functools.html#functools.total_ordering),
> [`dataclasses`](https://docs.python.org/3.14/library/dataclasses.html)
> (the `eq`, `order`, `frozen`, `unsafe_hash` parameters and `field()`),
> and the [data model](https://docs.python.org/3.14/reference/datamodel.html#object.__hash__).
> Version spine: **CPython 3.14**.

**PEP 8 wants all six comparison methods and writing all six by hand is six chances to
get one backwards. The standard library offers two generators. `@total_ordering`
derives four ordering methods from any one of them plus `__eq__`, at a documented cost
in speed and stack-trace clarity. `@dataclass(order=True)` generates all four from the
field list, comparing the class *"as if it were a tuple of its fields, in order"* —
which makes field declaration order load-bearing, and makes `field(compare=False)` the
control you need when a field must not participate.**

## `@functools.total_ordering`

> *"Given a class defining one or more rich comparison ordering methods, this class
> decorator supplies the rest. This simplifies the effort involved in specifying all of
> the possible rich comparison operations:"*
>
> *"The class must define one of `__lt__()`, `__le__()`, `__gt__()`, or `__ge__()`. In
> addition, the class should supply an `__eq__()` method."* —
> [`functools.total_ordering`](https://docs.python.org/3.14/library/functools.html#functools.total_ordering)

Note the two different modal verbs: it *must* define one ordering method, and it
*should* supply `__eq__`. Without `__eq__` you inherit identity equality from `object`,
and the derived methods — which are defined in terms of your one method and `==` — then
mean something you did not intend.

The standard library's own example, worth copying wholesale for the
`NotImplemented` discipline it shows:

```python
@total_ordering
class Student:
    def _is_valid_operand(self, other):
        return (hasattr(other, "lastname") and
                hasattr(other, "firstname"))
    def __eq__(self, other):
        if not self._is_valid_operand(other):
            return NotImplemented
        return ((self.lastname.lower(), self.firstname.lower()) ==
                (other.lastname.lower(), other.firstname.lower()))
    def __lt__(self, other):
        if not self._is_valid_operand(other):
            return NotImplemented
        return ((self.lastname.lower(), self.firstname.lower()) <
                (other.lastname.lower(), other.firstname.lower()))
```

The `NotImplemented` returns are load-bearing: the derived methods propagate them, so
the reflected-operand fallback of [02](02-notimplemented-and-reflection.md) keeps
working through the generated code.

### The two costs, both documented

> *"While this decorator makes it easy to create well behaved totally ordered types, it
> does come at the cost of slower execution and more complex stack traces for the
> derived comparison methods. If performance benchmarking indicates this is a bottleneck
> for a given application, implementing all six rich comparison methods instead is
> likely to provide an easy speed boost."*

The derived methods are Python-level wrappers that call your one method (and sometimes
`__eq__` as well), so each derived comparison is at least two calls deep. In a sort of
a million objects that is measurable; in a config object compared twice a run it is
not. Benchmark before hand-writing six methods.

The stack-trace point is the one that costs debugging time: an exception raised inside
your `__lt__` during a `>=` comparison surfaces through `functools`' generated frame,
not from a line in your class.

### The inheritance rule

> *"This decorator makes no attempt to override methods that have been declared in the
> class or its superclasses. Meaning that if a superclass defines a comparison
> operator, total_ordering will not implement it again, even if the original method is
> abstract."*

Two live consequences:

- **Every class inherits from `object`**, which defines `__lt__`, `__gt__`, `__le__`
  and `__ge__` as slots that raise `TypeError`. The decorator knows to look past those
  — it checks for methods *distinct from* `object`'s defaults — but a *non-`object`*
  superclass with an ordering method blocks generation entirely.
- **An ABC with abstract ordering methods blocks it too**, explicitly. If you inherit
  from a base that declares `__lt__` as `@abstractmethod`, `total_ordering` sees a
  declared method and does nothing, and your subclass ends up with the abstract one.

## Gotchas

**★ `@total_ordering` generating nothing because a superclass declares `__lt__`.**
Documented: the decorator makes no attempt to override methods declared in the class
*or its superclasses*, even abstract ones. Fix: declare the ordering method on the
class being decorated, or drop the decorator and write all six.

**★ `@total_ordering` without `__eq__`, producing orderings that disagree with
equality.** The derived methods are defined in terms of your ordering method and `==`,
and the inherited `object.__eq__` is identity — so two value-equal objects order as
distinct. Fix: always supply `__eq__`; the docs say the class *should*, and in
practice it must.

**★ `@total_ordering` on a class whose one ordering method returns `False` instead of
`NotImplemented` for foreign types.** The derived methods propagate whatever your
method returned, so the reflected-operand fallback is disabled for all four of them at
once — one bug, four symptoms. Fix: `return NotImplemented`, as the standard library's
own `Student` example does.

**★ A profile showing `functools` frames dominating a sort.** The `total_ordering`
wrappers are Python-level and add call depth per comparison. The docs say implementing
all six is "likely to provide an easy speed boost". Fix: hand-write them, but only
after the profile says so.

**★ A traceback that points into `functools` instead of your class.** An exception
raised inside your `__lt__` during a `>=` comparison surfaces through the generated
wrapper. The docs list "more complex stack traces" as one of the two costs. Fix:
nothing to fix, but know to read one frame further down.

**★ `@total_ordering` used when the ordering is really "the order this report wants".**
It bakes an opinion into the type. Fix: `sorted(key=...)` at the call site, so a second
caller can order differently without arguing with the class.

## Interview questions

**★ Q: What does `@functools.total_ordering` require and what does it give you?**
It requires one of `__lt__`, `__le__`, `__gt__` or `__ge__`, and the docs say the
class *should* also supply `__eq__`. It generates the other three ordering methods in
terms of the one you wrote. It does not generate `__eq__` or `__hash__`.

**★ Q: What does `total_ordering` cost?**
Two documented things: slower execution, because the derived methods are Python-level
wrappers that call your method (and often `__eq__`) rather than doing the comparison
directly, and more complex stack traces, because exceptions surface through the
generated frames. The docs say hand-writing all six is likely an easy speed boost if a
benchmark points there.

**★ Q: Why might `@total_ordering` appear to do nothing?**
Because a superclass already declares the method it would have generated. The docs
state it makes no attempt to override methods declared in the class or its
superclasses, *"even if the original method is abstract"* — so an ABC with an abstract
`__lt__` blocks generation entirely.

**Q: Does `total_ordering` handle `NotImplemented` correctly?**
Yes, provided your method returns it. The generated methods propagate `NotImplemented`
rather than coercing it, so the reflected-operand fallback still works — which is why
the docs' `Student` example guards with `_is_valid_operand` and returns
`NotImplemented`, not `False`.

**Q: Class-level comparison methods or a `key=` at the call site?**
`key=` unless the ordering is genuinely intrinsic to the type. Adding `__lt__` to a
class asserts that this is *the* ordering of that type; if it is really "the ordering
this one report needs", a key function keeps the decision next to the code that made
it and lets a second report choose differently.

**Q: Why does the decorator ask for `__eq__` but only *require* an ordering method?**
Because it can technically generate the other three from any one ordering method
alone — but the results are only coherent if `==` agrees with the ordering. With
`object`'s identity equality, `a <= b` derived as `a < b or a == b` gives `False` for
two distinct-but-equivalent objects, which breaks the negation rule the reference asks
for.

---

← Prev: [min, max, heapq, bisect, groupby](08c-min-max-heapq-bisect-groupby.md) · Index: [Comparisons](README.md) · Next → [Dataclasses and the generated methods](09b-dataclasses-and-generated-methods.md)
