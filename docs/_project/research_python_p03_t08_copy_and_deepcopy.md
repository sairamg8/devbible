---
name: research-python-p03-t08-copy-and-deepcopy
description: Banked primary sources for Python phase 3 topic 08 (copy vs deepcopy — copy.py dispatch and memo at v3.14.7, the reduce protocol in typeobject.c, copyreg, copy.replace/__replace__, per-type hooks for Enum/partial/defaultdict/deque/weakref containers, uncopyable types and their error strings, dataclasses.replace/asdict, thread-safety docs, recursion limit, JSON/pickle round trips). Source-derived facts and three docs-vs-source discrepancies are marked.
metadata:
  type: reference
---

# research — python phase 3, topic 08 · `copy` vs `deepcopy`

🔴 **DO NOT RE-DERIVE.** Banked 2026-09-21 in one pass. Write every chunk from this file.

**How it was read.** Every source file below was fetched from the **`v3.14.7` tag**
(`https://raw.githubusercontent.com/python/cpython/v3.14.7/<path>`) on 2026-09-21, so line
facts are v3.14.7. The rendered page <https://docs.python.org/3.14/library/copy.html> was
fetched once: header **3.14.7**, "Last Updated: Sep 21, 2026", same text as `Doc/library/copy.rst`.
Files: `Lib/copy.py` (286 lines), `Lib/copyreg.py`, `Objects/typeobject.c`, `Lib/dataclasses.py`,
`Lib/enum.py`, `Lib/weakref.py`, `Lib/socket.py`, `Lib/threading.py`, `Lib/queue.py`,
`Lib/logging/__init__.py`, `Lib/fractions.py`, `Lib/_pydecimal.py`, `Lib/collections/__init__.py`,
`Lib/json/encoder.py`, `Modules/_functoolsmodule.c`, `Modules/_threadmodule.c`,
`Modules/_collectionsmodule.c`, `Modules/_decimal/_decimal.c`, `Modules/_sre/sre.c`,
`Modules/_io/{iobase,textio,bufferedio,fileio}.c`, `Modules/itertoolsmodule.c`,
`Modules/arraymodule.c`, `Objects/{setobject,dictobject,odictobject,descrobject,genobject,moduleobject,bytearrayobject}.c`,
`Include/internal/pycore_ceval.h`; docs `Doc/library/{copy,copyreg,pickle,dataclasses,json,sys,exceptions,threadsafety,functools,stdtypes,collections}.rst`,
`Doc/faq/{library,programming}.rst`, `Doc/howto/free-threading-python.rst`,
`Doc/whatsnew/{3.12,3.13,3.14}.rst`, `Doc/reference/datamodel.rst`.
Sibling banks already quote (do not re-fetch): `research_python_p03_t06_collections_module.md` (defaultdict/deque/Counter/OrderedDict/ChainMap/UserDict copy+reduce),
`research_python_p02_t10_recursion_and_the_limit.md` (sys recursion-limit docs).

**Local interpreter was 3.14.4, NOT 3.14.7 — nothing was run. All "behaviour" below is read from source at the tag.**

Doc anchors: `https://docs.python.org/3.14/library/copy.html`, `…/library/copyreg.html`,
`…/library/pickle.html#pickling-class-instances`, `…/library/dataclasses.html#dataclasses.replace`,
`…/library/dataclasses.html#dataclasses.asdict`, `…/whatsnew/3.13.html#copy`,
`…/whatsnew/3.14.html`, `…/library/threadsafety.html`,
`…/faq/library.html#what-kinds-of-global-value-mutation-are-thread-safe`,
`…/library/sys.html#sys.setrecursionlimit`, `…/library/exceptions.html#RecursionError`,
`…/faq/programming.html#how-do-i-copy-an-object-in-python`, `…/library/json.html`.
Source URLs: `https://github.com/python/cpython/blob/v3.14.7/<path>`.

---

## 1 · `copy` docs, verbatim (`Doc/library/copy.rst`)

> *"Assignment statements in Python do not copy objects, they create bindings between a target and an object. For collections that are mutable or contain mutable items, a copy is sometimes needed so one can change one copy without changing the other. This module provides generic shallow and deep copy operations (explained below)."*

`copy(obj)` *"Return a shallow copy of obj."* · `deepcopy(obj[, memo])` *"Return a deep copy of obj."* ·
`replace(obj, /, **changes)` *"Creates a new object of the same type as obj, replacing fields with values from changes."* `.. versionadded:: 3.13` ·
`exception Error` *"Raised for module specific errors."*

> *"A shallow copy constructs a new compound object and then (to the extent possible) inserts references into it to the objects found in the original."*
> *"A deep copy constructs a new compound object and then, recursively, inserts copies into it of the objects found in the original."*
> *"Two problems often exist with deep copy operations that don't exist with shallow copy operations: Recursive objects (compound objects that, directly or indirectly, contain a reference to themselves) may cause a recursive loop. Because deep copy copies everything it may copy too much, such as data which is intended to be shared between copies."*
> *"The deepcopy() function avoids these problems by: keeping a memo dictionary of objects already copied during the current copying pass; and letting user-defined classes override the copying operation or the set of components copied."*
> *"This module does not copy types like module, method, stack trace, stack frame, file, socket, window, or any similar types. It does "copy" functions and classes (shallow and deeply), by returning the original object unchanged; this is compatible with the way these are treated by the pickle module."*
> *"Shallow copies of many collections can be made using the corresponding copy() method (such as list.copy(), dict.copy() or set.copy()), and of sequences (such as lists or bytearrays) by making a slice of the entire sequence (sequence[:]). However, these methods and slicing can create an instance of the base type when copying an instance of a subclass, whereas copy.copy() normally returns an instance of the same type."*
> *"Classes can use the same interfaces to control copying that they use to control pickling. See the description of module pickle for information on these methods. In fact, the copy module uses the registered pickle functions from the copyreg module."*
> *"In order for a class to define its own copy implementation, it can define special methods `__copy__()` and `__deepcopy__()`."*
> `object.__copy__(self)` *"Called to implement the shallow copy operation; no additional arguments are passed."*
> `object.__deepcopy__(self, memo)` *"Called to implement the deep copy operation; it is passed one argument, the memo dictionary. If the `__deepcopy__` implementation needs to make a deep copy of a component, it should call the deepcopy() function with the component as first argument and the memo dictionary as second argument. The memo dictionary should be treated as an opaque object."*
> *"Function copy.replace() is more limited than copy() and deepcopy(), and only supports named tuples created by namedtuple(), dataclasses, and other classes which define method `__replace__()`."*
> `object.__replace__(self, /, **changes)` *"This method should create a new object of the same type, replacing fields with values from changes."* `.. versionadded:: 3.13`

**`copy.py` module docstring (v3.14.7) says "class"/"function"/"method" are not copied** — see discrepancy D1 (bound methods ARE deep-copied by source).

FAQ (`Doc/faq/programming.rst`, "How do I copy an object in Python?"):
> *"In general, try copy.copy() or copy.deepcopy() for the general case. Not all objects can be copied, but most can."*
> *"Some objects can be copied more easily. Dictionaries have a copy() method: `newdict = olddict.copy()`"* · *"Sequences can be copied by slicing: `new_l = l[:]`"*

stdtypes: `sequence.copy()` (bytearray, list; versionadded 3.3) *"Create a shallow copy of sequence. This is equivalent to writing sequence[:]."* + hint *"The copy() method is not part of the MutableSequence ABC, but most concrete mutable sequence types provide it."* ·
`frozenset.copy()`/`set.copy()` *"Return a shallow copy of the set."* · `dict.copy()` *"Return a shallow copy of the dictionary."*

## 2 · `copyreg` docs + source

> *"The copyreg module offers a way to define functions used while pickling specific objects. The pickle and copy modules use those functions when pickling/copying those objects. The module provides configuration information about object constructors which are not classes. Such constructors may be factory functions or class instances."*
> `copyreg.pickle(type, function, constructor_ob=None)` *"Declares that function should be used as a "reduction" function for objects of type type. function must return either a string or a tuple containing between two and six elements."* · *"The constructor_ob parameter is a legacy feature and is now ignored, but if passed it must be a callable."*

`Lib/copyreg.py` v3.14.7: module docstring *"This is only useful to add pickle support for extension types defined in C, not for instances of user-defined classes."* ·
`dispatch_table = {}` (l.10) · `pickle(ob_type, pickle_function, constructor_ob=None)`: `if not callable(pickle_function): raise TypeError("reduction functions must be callable")` then `dispatch_table[ob_type] = pickle_function` (l.12–15) ·
built-in registrations: `pickle(complex, pickle_complex, complex)` (`complex, (c.real, c.imag)`), `pickle(type(int | str), pickle_union)` (`operator.getitem, (typing.Union, obj.__args__)`), `pickle(super, pickle_super)` (`super, (obj.__thisclass__, obj.__self__)`) ·
`def __newobj__(cls, *args): return cls.__new__(cls, *args)` (l.103) · `__newobj_ex__(cls, args, kwargs)` *"Used by pickle protocol 4, instead of __newobj__ to allow classes with keyword-only arguments to be pickled correctly."* ·
`_slotnames(cls)` l.112: reads cache `cls.__dict__.get("__slotnames__")`; walks `cls.__mro__`; a single-string `__slots__` becomes a 1-tuple; **skips `__dict__` and `__weakref__`**; **mangles `__x` names to `_Class__x`** (`stripped = c.__name__.lstrip('_')`); caches with `cls.__slotnames__ = names` inside `try/except: pass`.
`_reduce_ex(self, proto)` (l.60) is the protocol<2 fallback: raises `TypeError(f"cannot pickle {cls.__name__!r} object")` when `base is cls`, and for `__slots__` without `__getstate__`: `"a class that defines __slots__ without defining __getstate__ cannot be pickled with protocol {proto}"`. **copy uses protocol 4, so this is not the copy path.**

## 3 · `Lib/copy.py` v3.14.7 — verbatim (the whole load-bearing file)

```python
def copy(x):
    cls = type(x)

    if cls in _copy_atomic_types:
        return x
    if cls in _copy_builtin_containers:
        return cls.copy(x)


    if issubclass(cls, type):
        # treat it as a regular class:
        return x

    copier = getattr(cls, "__copy__", None)
    if copier is not None:
        return copier(x)

    reductor = dispatch_table.get(cls)
    if reductor is not None:
        rv = reductor(x)
    else:
        reductor = getattr(x, "__reduce_ex__", None)
        if reductor is not None:
            rv = reductor(4)
        else:
            reductor = getattr(x, "__reduce__", None)
            if reductor:
                rv = reductor()
            else:
                raise Error("un(shallow)copyable object of type %s" % cls)

    if isinstance(rv, str):
        return x
    return _reconstruct(x, None, *rv)


_copy_atomic_types = {types.NoneType, int, float, bool, complex, str, tuple,
          bytes, frozenset, type, range, slice, property,
          types.BuiltinFunctionType, types.EllipsisType,
          types.NotImplementedType, types.FunctionType, types.CodeType,
          weakref.ref, super}
_copy_builtin_containers = {list, dict, set, bytearray}

def deepcopy(x, memo=None, _nil=[]):
    cls = type(x)

    if cls in _atomic_types:
        return x

    d = id(x)
    if memo is None:
        memo = {}
    else:
        y = memo.get(d, _nil)
        if y is not _nil:
            return y

    copier = _deepcopy_dispatch.get(cls)
    if copier is not None:
        y = copier(x, memo)
    else:
        if issubclass(cls, type):
            y = x # atomic copy
        else:
            copier = getattr(x, "__deepcopy__", None)
            if copier is not None:
                y = copier(memo)
            else:
                reductor = dispatch_table.get(cls)
                if reductor:
                    rv = reductor(x)
                else:
                    reductor = getattr(x, "__reduce_ex__", None)
                    if reductor is not None:
                        rv = reductor(4)
                    else:
                        reductor = getattr(x, "__reduce__", None)
                        if reductor:
                            rv = reductor()
                        else:
                            raise Error(
                                "un(deep)copyable object of type %s" % cls)
                if isinstance(rv, str):
                    y = x
                else:
                    y = _reconstruct(x, memo, *rv)

    # If is its own copy, don't memoize.
    if y is not x:
        memo[d] = y
        _keep_alive(x, memo) # Make sure x lives at least as long as d
    return y

_atomic_types =  {types.NoneType, types.EllipsisType, types.NotImplementedType,
          int, float, bool, complex, bytes, str, types.CodeType, type, range,
          types.BuiltinFunctionType, types.FunctionType, weakref.ref, property}

_deepcopy_dispatch = d = {}

def _deepcopy_list(x, memo, deepcopy=deepcopy):
    y = []
    memo[id(x)] = y
    append = y.append
    for a in x:
        append(deepcopy(a, memo))
    return y
d[list] = _deepcopy_list

def _deepcopy_tuple(x, memo, deepcopy=deepcopy):
    y = [deepcopy(a, memo) for a in x]
    # We're not going to put the tuple in the memo, but it's still important we
    # check for it, in case the tuple contains recursive mutable structures.
    try:
        return memo[id(x)]
    except KeyError:
        pass
    for k, j in zip(x, y):
        if k is not j:
            y = tuple(y)
            break
    else:
        y = x
    return y
d[tuple] = _deepcopy_tuple

def _deepcopy_dict(x, memo, deepcopy=deepcopy):
    y = {}
    memo[id(x)] = y
    for key, value in x.items():
        y[deepcopy(key, memo)] = deepcopy(value, memo)
    return y
d[dict] = _deepcopy_dict

def _deepcopy_method(x, memo): # Copy instance methods
    return type(x)(x.__func__, deepcopy(x.__self__, memo))
d[types.MethodType] = _deepcopy_method

def _keep_alive(x, memo):
    """Keeps a reference to the object x in the memo.

    Because we remember objects by their id, we have
    to assure that possibly temporary objects are kept
    alive by referencing them.
    We store a reference at the id of the memo, which should
    normally not be used unless someone tries to deepcopy
    the memo itself...
    """
    try:
        memo[id(memo)].append(x)
    except KeyError:
        # aha, this is the first one :-)
        memo[id(memo)]=[x]

def _reconstruct(x, memo, func, args,
                 state=None, listiter=None, dictiter=None,
                 *, deepcopy=deepcopy):
    deep = memo is not None
    if deep and args:
        args = (deepcopy(arg, memo) for arg in args)
    y = func(*args)
    if deep:
        memo[id(x)] = y

    if state is not None:
        if deep:
            state = deepcopy(state, memo)
        if hasattr(y, '__setstate__'):
            y.__setstate__(state)
        else:
            if isinstance(state, tuple) and len(state) == 2:
                state, slotstate = state
            else:
                slotstate = None
            if state is not None:
                y.__dict__.update(state)
            if slotstate is not None:
                for key, value in slotstate.items():
                    setattr(y, key, value)

    if listiter is not None:
        if deep:
            for item in listiter:
                item = deepcopy(item, memo)
                y.append(item)
        else:
            for item in listiter:
                y.append(item)
    if dictiter is not None:
        if deep:
            for key, value in dictiter:
                key = deepcopy(key, memo)
                value = deepcopy(value, memo)
                y[key] = value
        else:
            for key, value in dictiter:
                y[key] = value
    return y

def replace(obj, /, **changes):
    """Return a new object replacing specified fields with new values.

    This is especially useful for immutable objects, like named tuples or
    frozen dataclasses.
    """
    cls = obj.__class__
    func = getattr(cls, '__replace__', None)
    if func is None:
        raise TypeError(f"replace() does not support {cls.__name__} objects")
    return func(obj, **changes)
```

Module header (l.1–50): imports only `types`, `weakref`, `from copyreg import dispatch_table` — **pure Python, no C accelerator in 3.14.7**. `error = Error   # backward compatibility`. `__all__ = ["Error", "copy", "deepcopy", "replace"]`. Docstring: *"Classes can use the same interfaces to control copying that they use to control pickling: they can define methods called __getinitargs__(), __getstate__() and __setstate__()."* (⚠️ `__getinitargs__` is a pre-2.2 name; nothing in the 3.14.7 code reads it — do not teach it.) `_keep_alive` docstring quoted above. `del types, weakref` at module end.

### Facts derived by reading the code (source-derived, NOT run — say so on the page)

- **F1 exact-type keys.** `_copy_atomic_types`, `_copy_builtin_containers`, `_atomic_types`, `_deepcopy_dispatch` are all keyed by `type(x)` exactly. A subclass (`class Row(dict)`) misses every table and takes the `__copy__` → `dispatch_table` → `__reduce_ex__(4)` route.
- **F2 lookup asymmetry.** `copy()` does `getattr(cls, "__copy__", None)` (on the **class**, then `copier(x)`); `deepcopy()` does `getattr(x, "__deepcopy__", None)` (on the **instance**, then `copier(memo)`). ⇒ an instance attribute named `__deepcopy__` is honoured by deepcopy only; an object with a catch-all `__getattr__` answers `__deepcopy__` lookups.
- **F3 precedence.** copy: atomic → builtin container `.copy` → `issubclass(cls, type)` → class `__copy__` → `copyreg.dispatch_table` → `__reduce_ex__(4)` → `__reduce__` → `Error`. deepcopy: atomic → memo hit → `_deepcopy_dispatch` → metaclass instance → instance `__deepcopy__` → `dispatch_table` → `__reduce_ex__(4)` → `__reduce__` → `Error`.
- **F4 `copy.Error` is nearly unreachable.** Every object inherits `object.__reduce_ex__`, so the two `raise Error(...)` lines need both `__reduce_ex__` and `__reduce__` to be missing/None. What a lock/generator/module actually raises is a **`TypeError` from `object.__reduce_ex__`** (see §5).
- **F5 memo is keyed by `id()`**; `memo[id(memo)]` is reserved for the `_keep_alive` list; `y is x` results are not memoized (so identity-preserving types cost no memo entry). `_keep_alive` exists because temporaries created during reduction (e.g. the list `set.__reduce__` builds) could be freed and their ids reused.
- **F6 registration order.** `_deepcopy_list` and `_deepcopy_dict` put the empty copy in the memo **before** recursing; `_reconstruct` puts `y` in the memo **after** `func(*args)` returns and **before** state/items. So anything whose children travel in `args` (set, frozenset, Counter, namedtuple, partial's `(func,)`) cannot be memoized before its children are copied.
- **F7 tuple retrofit.** `_deepcopy_tuple` cannot pre-register; it re-checks `memo[id(x)]` after copying elements (a nested copy may have created it) and returns `x` itself if every element copied to itself.
- **F8 `_reconstruct` signature takes at most `func, args, state, listiter, dictiter`.** A `__reduce__` returning the 6-tuple form with a `state_setter` (pickle docs: *"Optionally, a callable with a (obj, state) signature … versionadded:: 3.8"*) passes a 6th positional and fails the call. `copy` never reads the 6th item.
- **F9 `__setstate__` detection is `hasattr(y, '__setstate__')`** on the **new, un-initialised object**. Since 3.11 `object` has `__getstate__` but **no** `__setstate__`, so `hasattr` reaches `__getattr__` for ordinary classes.
- **F10 state paths.** With no `__setstate__`: `y.__dict__.update(state)` (bypasses `__setattr__`; shares values in shallow copy) and slot values go through **`setattr(y, key, value)`** (invokes `__setattr__`/descriptors). A 2-tuple state is *always* read as `(dict_state, slot_state)` when there is no `__setstate__`.
- **F11 shallow copy passes the live state.** `copy()` calls `_reconstruct(x, None, …)`; `state` is not copied, so a `__setstate__` that stores it (`self.__dict__ = state`) makes copy and original share one `__dict__` if `__getstate__` returned the live dict.
- **F12 subclass containers.** `listiter` ⇒ `y.append(item)`; `dictiter` ⇒ `y[key] = value` — overridden `append`/`__setitem__` in a list/dict subclass **run during copy**. (`_PyObject_GetItemsIter`, §5, feeds these for any `list`/`dict` subclass.)
- **F13 frame accounting (recursion).** dict-in-dict: `deepcopy → _deepcopy_dict → deepcopy` = 2 Python frames per nesting level; list likewise; tuple `deepcopy → _deepcopy_tuple → deepcopy` (list comprehension is inlined since 3.12, PEP 709 — do not claim a frame for it); **an object with attributes**: `deepcopy → _reconstruct → deepcopy(state) → _deepcopy_dict → deepcopy(value)` = **4 frames per object level**. So a singly linked chain of instances costs about 4 frames per node; at the default limit of 1000 that is on the order of 250 nodes minus whatever depth the caller already uses. (Derived arithmetic — present as derivation, never as a measurement.)
- **F14 no memo ⇒ no sharing in `_asdict_inner`.** `dataclasses.asdict` has no memo parameter (see §7), so shared references become separate dicts and a cycle recurses until `RecursionError`.
- **F15 cycle through a set is copied twice** (trace): `S = {E}; E.group = S`. `deepcopy(S)` → reduce builds temp list `[E]` → `deepcopy(E)`: memoizes new `E'` then deep-copies `E.__dict__` → `deepcopy(S)` again: `S` not in memo yet ⇒ second reduce builds a second temp list ⇒ `deepcopy(E)` memo-hits the half-built `E'` ⇒ inner set `S2 = {E'}`; `E'.group = S2`; outer continues and builds `S1 = {E'}` and `memo[id(S)] = S1`. Result: `E'.group is S2`, not `S1`. If `E.__hash__` reads an attribute that `E'` does not have yet, building `S2` raises. Tuple has a retrofit for this shape (F7); set/frozenset/Counter do not. **Present as source-derived.**
- **F16 `__new__`-singleton rewritten by its own deepcopy.** `_reconstruct` calls `func(*args)` = `cls.__new__(cls)`; if `__new__` returns the existing instance, `y is x`, then `state = deepcopy(state, memo)` and `y.__dict__.update(state)` **rebinds the original's attributes to fresh deep copies**. (Shallow copy: `x.__dict__.update(x.__dict__)` — a no-op.) Source-derived.
- **F17 `copy.copy(namedtuple_instance) is not the original.** `tuple` is in `_copy_atomic_types` by exact type only; a namedtuple goes through `__reduce_ex__(4)` → `__getnewargs__` (`return _tuple(self)`, docstring *"Return self as a plain tuple.  Used by copy and pickle."*) → `copyreg.__newobj__(cls, *fields)` → a new instance.
- **F18 `weakref.ref` is atomic in both** (in both sets). An object holding `self._parent = weakref.ref(parent)` — deepcopy of the child gives a child whose `_parent()` is the **original** parent, not the copied one.
- **F19 builtin-bound callbacks are atomic.** `types.BuiltinFunctionType` is atomic in both, and a bound method of a builtin object (`some_list.append`) is of that type ⇒ deepcopy of `{"sink": sink_list.append}` keeps appending to the **original** list. `types.FunctionType` (lambdas, closures) atomic ⇒ closure cells are not copied. `types.MethodType` (bound method of a Python class) ⇒ `_deepcopy_method` ⇒ **`deepcopy(x.__self__, memo)`: the owner instance is deep-copied** (D1).

## 4 · pickle docs the copy protocol rests on (`Doc/library/pickle.rst`, "Pickling Class Instances")

> *"In most cases, no additional code is needed to make instances picklable. By default, pickle will retrieve the class and the attributes of an instance via introspection. When a class instance is unpickled, its `__init__()` method is usually not invoked. The default behaviour first creates an uninitialized instance and then restores the saved attributes."*
```python
def save(obj):
    return (obj.__class__, obj.__dict__)

def restore(cls, attributes):
    obj = cls.__new__(cls)
    obj.__dict__.update(attributes)
    return obj
```
> `object.__getnewargs_ex__()` *"In protocols 2 and newer, classes that implement the `__getnewargs_ex__()` method can dictate the values passed to the `__new__()` method upon unpickling. The method must return a pair (args, kwargs) …"* · *"You should implement this method if the `__new__()` method of your class requires keyword-only arguments. Otherwise, it is recommended for compatibility to implement `__getnewargs__()`."*
> `object.__getnewargs__()` *"… supports only positional arguments. It must return a tuple of arguments args which will be passed to the `__new__()` method upon unpickling."* · *"`__getnewargs__()` will not be called if `__getnewargs_ex__()` is defined."*
> `object.__getstate__()` *"Classes can further influence how their instances are pickled by overriding the method `__getstate__()`. It is called and the returned object is pickled as the contents for the instance, instead of a default state. There are several cases:"* — no dict & no slots: default state `None`; dict & no slots: `self.__dict__`; dict **and** slots: *"a tuple consisting of two dictionaries: self.__dict__, and a dictionary mapping slot names to slot values. Only slots that have a value are included in the latter."*; slots & no dict: *"a tuple whose first item is None and whose second item is a dictionary mapping slot names to slot values"*. `.. versionchanged:: 3.11 Added the default implementation of the __getstate__() method in the object class.`
> `object.__setstate__(state)` *"Upon unpickling, if the class defines `__setstate__()`, it is called with the unpickled state. In that case, there is no requirement for the state object to be a dictionary. Otherwise, the pickled state must be a dictionary and its items are assigned to the new instance's dictionary."* + note *"If `__reduce__()` returns a state with value None at pickling, the `__setstate__()` method will not be called upon unpickling."*
> **Note (load-bearing for the `__getattr__` trap):** *"At unpickling time, some methods like `__getattr__()`, `__getattribute__()`, or `__setattr__()` may be called upon the instance. In case those methods rely on some internal invariant being true, the type should implement `__new__()` to establish such an invariant, as `__init__()` is not called when unpickling an instance."*
> *"As we shall see, pickle does not use directly the methods described above. In fact, these methods are part of the copy protocol which implements the `__reduce__()` special method. The copy protocol provides a unified interface for retrieving the data necessary for pickling and copying objects."* · *"Although powerful, implementing `__reduce__()` directly in your classes is error prone. For this reason, class designers should use the high-level interface (i.e., `__getnewargs_ex__()`, `__getstate__()` and `__setstate__()`) whenever possible."*
> `object.__reduce__()` *"The interface is currently defined as follows. The `__reduce__()` method takes no argument and shall return either a string or preferably a tuple (the returned object is often referred to as the "reduce value")."* · *"If a string is returned, the string should be interpreted as the name of a global variable. It should be the object's local name relative to its module … This behaviour is typically useful for singletons."* · *"When a tuple is returned, it must be between two and six items long. Optional items can either be omitted, or None can be provided as their value."* Items: callable; args tuple (*"An empty tuple must be given if the callable does not accept any argument."*); state; *"an iterator (and not a sequence) yielding successive items. These items will be appended to the object either using obj.append(item) or, in batch, using obj.extend(list_of_items)."*; *"an iterator (not a sequence) yielding successive key-value pairs. These items will be stored to the object using obj[key] = value."*; sixth: *"a callable with a (obj, state) signature … versionadded:: 3.8"*.
> `object.__reduce_ex__(protocol)` *"Alternatively, a `__reduce_ex__()` method may be defined. The only difference is this method should take a single integer argument, the protocol version. When defined, pickle will prefer it over the `__reduce__()` method. In addition, `__reduce__()` automatically becomes a synonym for the extended version."*
> What can be pickled: *"Attempts to pickle unpicklable objects will raise the PicklingError exception; when this happens, an unspecified number of bytes may have already been written to the underlying file. Trying to pickle a highly recursive data structure may exceed the maximum recursion depth, a RecursionError will be raised in this case. You can carefully raise this limit with sys.setrecursionlimit()."* · *"Note that functions (built-in and user-defined) are pickled by fully qualified name, not by value."* · *"functions (built-in and user-defined) accessible from the top level of a module (using def, not lambda);"* · *"classes accessible from the top level of a module;"*
> `Pickler.clear_memo()` *"The memo is the data structure that remembers which objects the pickler has already seen, so that shared or recursive objects are pickled by reference and not by value."*
> `DEFAULT_PROTOCOL` *"Currently the default protocol is 5"* (`versionchanged:: 3.14 The default protocol is 5.`). **`copy` hard-codes 4** (`reductor(4)`), independent of `DEFAULT_PROTOCOL`.
> Warning: *"The pickle module **is not secure**. Only unpickle data you trust."*

## 5 · CPython C source — `Objects/typeobject.c` v3.14.7 (l.7278–7835)

- Header comment l.7278: *"Stuff to implement __reduce_ex__ for pickle protocols >= 2. We fall back to helpers in copyreg for: pickle protocols < 2; calculating the list of slot names (done only once per class); the __newobj__ function (which is used as a token but never called)"*.
- `object_getstate_default(obj, required)` l.7353: `if (required && Py_TYPE(obj)->tp_itemsize)` → `TypeError "cannot pickle %.200s objects"`; state = `None` if `_PyObject_IsInstanceDictEmpty(obj)` else `PyObject_GenericGetDict(obj)` (**the live dict**); `slotnames = _PyType_GetSlotNames(type)`; if `required`: `basicsize = PyBaseObject_Type.tp_basicsize` `+ sizeof(PyObject*)` if a non-managed `tp_dictoffset` `+ sizeof(PyObject*)` if `tp_weaklistoffset > 0` `+ sizeof(PyObject*) * len(slotnames)`; **`if (Py_TYPE(obj)->tp_basicsize > basicsize)` → `TypeError "cannot pickle '%.200s' object"`** (type's `tp_name`). Then slot values are gathered by `getattr`; unset slots skipped (*"It is not an error if the attribute is not present."*); if any slot has a value, `state = (state, slots_dict)`.
- `object_getstate(obj, required)` l.7478: if `__getstate__` is not overridden, calls the default with `required`; otherwise calls the override with no args.
- `reduce_newobj(obj)` l.7652: `if (Py_TYPE(obj)->tp_new == NULL)` → `TypeError "cannot pickle '%.200s' object"`; gets `__getnewargs_ex__` then `__getnewargs__` (`_PyObject_LookupSpecial` — looked up on the **type**); no kwargs → `copyreg.__newobj__` with `(cls, *args)`; kwargs → `copyreg.__newobj_ex__` with `(cls, args, kwargs)`; **`state = object_getstate(obj, !(hasargs || PyList_Check(obj) || PyDict_Check(obj)))`** — i.e. `required` is true when the type supplied no `__getnewargs__*` and is not a list/dict subclass; `_PyObject_GetItemsIter` fills `listitems`/`dictitems`; result `PyTuple_Pack(5, newobj, newargs, state, listitems, dictitems)`.
- `_PyObject_GetItemsIter` l.7612: `PyList_Check(obj)` ⇒ `listitems = iter(obj)`; `PyDict_Check(obj)` ⇒ `dictitems = iter(obj.items())` (**calls the `items` method by name — an overridden `items` is honoured**).
- `_PyObject_GetNewArguments` error texts: `"__getnewargs_ex__ should return a tuple, not '%.200s'"`, `"__getnewargs_ex__ should return a tuple of length 2, not %zd"`, `"__getnewargs__ should return a tuple, not '%.200s'"`.
- `object___reduce_ex___impl(self, protocol)` l.7804: looks up `__reduce__`; if the class's `__reduce__` is **not** `object.__reduce__` (override) it calls that (so *"`__reduce__()` automatically becomes a synonym for the extended version"*), else `_common_reduce(self, protocol)`; `_common_reduce`: `proto >= 2` ⇒ `reduce_newobj(self)`, else `copyreg._reduce_ex`.
- ⇒ **for a plain user class, `copy` gets `(copyreg.__newobj__, (cls,), state, None, None)`**; for a `list` subclass `listitems` is an iterator over the items; for a `dict` subclass `dictitems` is `iter(obj.items())`.

### Types with no `__reduce__` — what the default path does (all source-derived)

- **`_thread.lock`** (`threading.Lock()` is `_thread.lock`): `Modules/_threadmodule.c` type spec `.name = "_thread.lock"`, `.basicsize = sizeof(lockobject)`, slots dealloc/repr/doc/methods/traverse/**`Py_tp_new lock_new`**, no `__reduce__`/`__getstate__` ⇒ no `__getnewargs__` ⇒ `required` ⇒ basicsize check ⇒ **`cannot pickle '_thread.lock' object`**. `_thread.RLock` (`.name = "_thread.RLock"`, `.basicsize = sizeof(rlockobject)`) likewise. `copy.copy(lock)` AND `deepcopy(lock)` both raise (`copy()` also calls `reductor(4)`).
- `threading.Event.__init__`: `self._cond = Condition(Lock())`; `queue.Queue.__init__`: `self.mutex = threading.Lock()` + three `Condition(self.mutex)` ⇒ **deepcopy of an Event/Queue reaches a Lock and raises**; shallow copy of an object *holding* a lock does not raise — `y.__dict__.update(state)` shares the lock.
- **Generators** (`Objects/genobject.c`): no `reduce`/`getstate`/`pickle` hit ⇒ default path ⇒ `cannot pickle 'generator' object` (tp_name `generator`). **Modules** (`Objects/moduleobject.c`): same ⇒ `cannot pickle 'module' object`. **`mappingproxy`** (`Objects/descrobject.c`): has a `copy` method (`mappingproxy_copy` → `PyObject_CallMethodNoArgs(pp->mapping, &_Py_ID(copy))`, doc *"D.copy() -> a shallow copy of D"*) but no `__copy__`/`__reduce__` ⇒ `copy.copy(proxy)` takes the default path (expect the same refusal) — **state as "expected from the source", not confirmed by a run.**
- **Files**: `Modules/_io/iobase.c` l.251 `_PyIOBase_cannot_pickle`: `TypeError "cannot pickle '%.100s' instances"` with `_PyType_Name(Py_TYPE(self))` (the unqualified name, e.g. `TextIOWrapper`); installed as `__getstate__` on `FileIO` (fileio.c l.1270), `BufferedReader/Writer/Random` (bufferedio.c l.2559, 2618, 2735), `TextIOWrapper` (textio.c l.3397).
- **Sockets**: `Lib/socket.py` l.277: `def __getstate__(self): raise TypeError(f"cannot pickle {self.__class__.__name__!r} object")`.
- **itertools iterators (3.14)**: whatsnew 3.14 (itertools): *"Remove support for copy, deepcopy, and pickle operations from itertools iterators. These have emitted a DeprecationWarning since Python 3.12. (Contributed by Raymond Hettinger in gh-101588.)"* Exception: `itertools._tee` keeps `{"__copy__", tee_copy, METH_NOARGS, "Returns an independent iterator."}` (`itertoolsmodule.c` l.1052, 1125) — `copy.copy(tee_obj)` is the supported fork.

## 6 · Per-type copy behaviour — verbatim source

**Enum** (`Lib/enum.py` l.1303–1310, inside `class Enum`, l.1107):
```python
    def __reduce_ex__(self, proto):
        return self.__class__, (self._value_, )

    def __deepcopy__(self,memo):
        return self

    def __copy__(self):
        return self
```
⇒ **settles the question phase 1 left open**: enum members are their own copy (IntEnum/StrEnum/Flag inherit it; `copy()` finds `__copy__` on the class).

**`functools.partial`** (`Modules/_functoolsmodule.c` l.697–769):
```c
static PyObject *
partial_reduce(PyObject *self, PyObject *Py_UNUSED(args))
{
    partialobject *pto = partialobject_CAST(self);
    return Py_BuildValue("O(O)(OOOO)", Py_TYPE(pto), pto->fn, pto->fn,
                         pto->args, pto->kw,
                         pto->dict ? pto->dict : Py_None);
}
```
`partial_setstate`: requires a 4-tuple; `fnargs` kept by reference if exact tuple; **`if (kw == Py_None) kw = PyDict_New(); else if(!PyDict_CheckExact(kw)) kw = PyDict_Copy(kw); else Py_INCREF(kw);`** — an exact dict is kept **by reference**; `dict` (the instance `__dict__`) likewise `Py_INCREF`'d. ⇒ **shallow copy shares `keywords` and `__dict__` with the original** (source-derived). Members: `keywords` is `Py_READONLY` (the attribute), doc *"dictionary of keyword arguments to future partial calls"*, but the dict is mutable. Docs: *"The keyword arguments that will be supplied when the partial object is called."* Deepcopy deep-copies `(fn, args, kw, dict)`.

**weakref containers** (`Lib/weakref.py`): `WeakValueDictionary.copy` builds `WeakValueDictionary()` from live referents; `__copy__ = copy`; `__deepcopy__(self, memo)`: `new[deepcopy(key, memo)] = o` — **keys deep-copied, values shared** (weakly held — cannot be copied without dying). `WeakKeyDictionary.__deepcopy__`: `new[o] = deepcopy(value, memo)` — **keys shared, values deep-copied**. (`copy()` returns a plain `WeakValueDictionary`/`WeakKeyDictionary` — subclass lost; `__deepcopy__` uses `self.__class__()`.)

**defaultdict** (`_collectionsmodule.c`): `defdict_copy` → `new_defdict(op, op)` = `type(dd)(default_factory or None, dd)`; comment *"This calls the object's class.  That only works for subclasses whose class constructor has the same signature.  Subclasses that define a different constructor signature must override copy()."*; bound as both `copy` and `__copy__` (l.2339–2342). `defdict_reduce` comment: *"__reduce__ must return a 5-tuple as follows: factory function; tuple of args for the factory function; additional state (here None); sequence iterator (here None); dictionary iterator (yielding successive (key, value) pairs. This API is used by pickle.py and copy.py."* · *"For this to be useful with pickle.py, the default_factory must be picklable; e.g., None, a built-in, or a global function in a module or package."* · *"Both shallow and deep copying are supported, but for deep copying, the default_factory must be deep-copyable; e.g. None, or a built-in (functions are not copyable at this time)."* — ⚠️ **the last clause is stale** (`FunctionType` is in `_atomic_types`; a lambda factory deep-copies as itself); reduce value `(type, (factory,) or (), None, None, iter(items))` — **state is `None`, so instance attributes of a defaultdict subclass are not carried by the reduce path**.
**deque** (`_collectionsmodule.c` l.591–671, 1592): `deque.copy` and `deque.__copy__` (alias of `deque_copy_impl`); `deque_copy_impl` exact deque → block walk, subclass → `type(d)(d)` / `type(d)(d, maxlen)`, non-deque return → `TypeError("%.200s() must return a deque, not %.200s")`. `__reduce__`: `(type, (), state, iter)` unbounded, `(type, ((), maxlen), state, iter)` bounded ⇒ **maxlen survives copy/deepcopy**. Doc: *"In addition to the above, deques support iteration, pickling, len(d), reversed(d), copy.copy(d), copy.deepcopy(d), membership testing with the in operator, and subscript references such as d[0] to access the first element."*
**OrderedDict** (`odictobject.c`): `OrderedDict_copy_impl` l.1243: exact ⇒ `PyODict_New()`, subclass ⇒ **`_PyObject_CallNoArgs(type(od))`** (subclass with required ctor args breaks `copy()`), mutation during copy ⇒ `RuntimeError "OrderedDict mutated during iteration"`. `__reduce__` (l.989): `(type, (), state, None, iter(items))`; state via `_PyObject_GetState` ⇒ instance attributes survive.
**Counter** (`collections/__init__.py` l.743–750): `copy` = `self.__class__(self)`; `__reduce__` = `(self.__class__, (dict(self),))` — children travel in `args` (F6).
**ChainMap** l.1060: `copy` *"New ChainMap or subclass with a new copy of maps[0] and refs to maps[1:]"*; `__copy__ = copy`. No `__deepcopy__` ⇒ deepcopy goes the reduce route and deep-copies `__dict__` (`maps`) — every layer.
**UserDict** l.1198–1215: `__copy__` copies `__dict__` and `data` directly; `copy()` exact ⇒ `UserDict(self.data.copy())`; subclass ⇒ temporarily empties `self.data`, `copy.copy(self)`, restores, then `c.update(self)` (through `__setitem__`). **UserList** l.1315/1337 has `__copy__` and `copy` too.
**array.array** (`arraymodule.c` l.985–1010): `__copy__` and `__deepcopy__` both return an `array` copy (`array_array___deepcopy___impl` → `array_array___copy___impl`).
**set/frozenset** (`setobject.c`): `set_copy_untracked_lock_held` → `make_new_set_basetype_untracked(Py_TYPE(so), NULL)` (**base type — a `set` subclass's `.copy()` returns a plain `set`/`frozenset`**); **`frozenset_copy_impl`: `if (PyFrozenSet_CheckExact(so)) { return Py_NewRef(so); }`** else `set_copy_impl`. `set___reduce___impl`: `keys = list(so)`; `args = (keys,)`; `state = _PyObject_GetState(so)`; result `(type, (keys,), state)` — **elements travel in `args` as a temporary list** (F6, F15). **bytearray**: `bytearray.copy()` = `PyByteArray_FromStringAndSize(...)`; `__reduce__`/`__reduce_ex__` via a local `_common_reduce`.
**Decimal**: `_decimal.c` l.4876 `dec_copy` returns `Py_NewRef(self)` (comment *"__copy__ (METH_NOARGS) and __deepcopy__ (METH_O)"*); `_pydecimal.py` l.3713: `if type(self) is Decimal: return self  # I'm immutable; therefore I am my own clone`. **Fraction** (`fractions.py` l.1070): same, `if type(self) == Fraction: return self`; subclasses rebuild `self.__class__(self._numerator, self._denominator)`. **`re.Pattern`** and **`re.Match`**: `__copy__`/`__deepcopy__` return `Py_NewRef(self)` (`sre.c` l.1464–1490, 2641–2665).
**logging.Logger** (`Lib/logging/__init__.py` l.1827): `def __reduce__(self): if getLogger(self.name) is not self: … raise pickle.PicklingError('logger cannot be pickled'); return getLogger, (self.name,)`; `RootLogger.__reduce__` l.1846 returns `getLogger, ()` ⇒ **copy/deepcopy of a logger returns the same logger** (via `func(*args)` = `getLogger(name)`).
**namedtuple** (`collections/__init__.py` l.446–508): `_make` = `tuple_new(cls, iterable)` (no `__new__`/`__init__` call, length check `TypeError(f'Expected {num_fields} arguments, got {len(result)}')`); **`_replace(self, /, **kwds)`: `result = self._make(_map(kwds.pop, field_names, self))`; `if kwds: raise TypeError(f'Got unexpected field names: {list(kwds)!r}')`**; class namespace sets **`'__replace__': _replace, '_replace': _replace`**, `'__slots__': ()`, `__getnewargs__` (F17).

## 7 · `dataclasses` (`Doc/library/dataclasses.rst`, `Lib/dataclasses.py` v3.14.7)

`replace` docs verbatim:
> *"Creates a new object of the same type as obj, replacing fields with values from changes. If obj is not a Data Class, raises TypeError. If keys in changes are not field names of the given dataclass, raises TypeError."*
> *"The newly returned object is created by calling the `__init__()` method of the dataclass. This ensures that `__post_init__()`, if present, is also called."*
> *"Init-only variables without default values, if any exist, must be specified on the call to replace() so that they can be passed to `__init__()` and `__post_init__()`."*
> *"It is an error for changes to contain any fields that are defined as having init=False. A ValueError will be raised in this case."*
> *"Be forewarned about how init=False fields work during a call to replace(). They are not copied from the source object, but rather are initialized in `__post_init__()`, if they're initialized at all. It is expected that init=False fields will be rarely and judiciously used. If they are used, it might be wise to have alternate class constructors, or perhaps a custom replace() (or similarly named) method which handles instance copying."*
> *"Dataclass instances are also supported by generic function copy.replace()."*

🔴 **D2 (docs vs source).** Source l.1782–1810 (`_replace`): `if not f.init: if f.name in changes: raise TypeError(f'field {f.name} is declared with init=False, it cannot be specified with replace()')`; `if f.name not in changes: if f._field_type is _FIELD_INITVAR and f.default is MISSING: raise TypeError(f"InitVar {f.name!r} must be specified with replace()")`; `changes[f.name] = getattr(self, f.name)`; **`return self.__class__(**changes)`**. **v3.14.7 raises `TypeError`, the 3.14 docs say `ValueError`.** Phase 1 `08c` repeats the docs' `ValueError`. Write: "the docs say ValueError; the v3.14.7 source raises TypeError — do not depend on either".
`replace(obj, /, **changes)` l.1763: `if not _is_dataclass_instance(obj): raise TypeError("replace() should be called on dataclass instances")`; then `_replace(obj, **changes)`. l.1150: **`_set_new_attribute(cls, '__replace__', _replace)`**; `_set_new_attribute` (l.922) *"Never overwrites an existing attribute.  Returns True if the attribute already exists."* — a `__replace__` defined in the class body wins; it checks `cls.__dict__` only, so a dataclass subclass gets its own.
Slots + frozen (l.1246–1258, 1375–1379): *"_dataclass_getstate and _dataclass_setstate are needed for pickling frozen classes with slots."*; `_dataclass_getstate(self): return [getattr(self, f.name) for f in fields(self)]`; `_dataclass_setstate(self, state): for field, value in zip(fields(self), state): # use setattr because dataclass may be frozen  object.__setattr__(self, field.name, value)`; installed `if is_frozen:` in `_add_slots` only when the class dict lacks its own `__getstate__`/`__setstate__`.
`asdict` docs: *"Converts the dataclass obj to a dict (by using the factory function dict_factory). Each dataclass is converted to a dict of its fields, as name: value pairs. dataclasses, dicts, lists, and tuples are recursed into. Other objects are copied with copy.deepcopy()."* · *"To create a shallow copy, the following workaround may be used: `{field.name: getattr(obj, field.name) for field in fields(obj)}`"*. Source `_asdict_inner`: `_ATOMIC_TYPES` fast path (comment *"…other types that are also unaffected by deepcopy"*); dataclass ⇒ dict of fields; exact `list`/`dict`/`tuple` recursed; namedtuple rebuilt; `dict`/`list` subclasses rebuilt via the type; **`else: return copy.deepcopy(obj)`**. No memo (F14).

## 8 · What's New — verbatim

3.13 (`Doc/whatsnew/3.13.rst`, "copy" section): *"The new replace() function and the replace protocol make creating modified copies of objects much simpler. This is especially useful when working with immutable objects. The following types support the replace() function and implement the replace protocol: collections.namedtuple(); dataclasses.dataclass; datetime.datetime, datetime.date, datetime.time; inspect.Signature, inspect.Parameter; types.SimpleNamespace; code objects. Any user-defined class can also support copy.replace() by defining the `__replace__()` method. (Contributed by Serhiy Storchaka in gh-108751.)"* Also in the summary list: *"The copy module now has a copy.replace() function, with support for many builtin types and any class defining the `__replace__()` method."*
3.14 (`Doc/whatsnew/3.14.rst`, ast): *"Add support for copy.replace() for AST nodes. (Contributed by Bénédikt Tran in gh-121141.)"* · (itertools) removal quoted in §5.
3.12 (`Doc/whatsnew/3.12.rst` l.924): *"sys.setrecursionlimit() and sys.getrecursionlimit(). The recursion limit now applies only to Python code. Builtin functions do not use the recursion limit, but are protected by a different mechanism that prevents recursion from causing a virtual machine crash."*

## 9 · Recursion, threads, round trips — docs verbatim

sys: *"Return the current value of the recursion limit, the maximum depth of the Python interpreter stack. This limit prevents infinite recursion from causing an overflow of the C stack and crashing Python. It can be set by setrecursionlimit()."* · *"Set the maximum depth of the Python interpreter stack to limit. … The highest possible limit is platform-dependent. A user may need to set the limit higher when they have a program that requires deep recursion and a platform that supports a higher limit. This should be done with care, because a too-high limit can lead to a crash. If the new limit is too low at the current recursion depth, a RecursionError exception is raised."* · exceptions: *"This exception is derived from RuntimeError. It is raised when the interpreter detects that the maximum recursion depth (see sys.getrecursionlimit()) is exceeded."* `Include/internal/pycore_ceval.h` l.44: `#ifndef Py_DEFAULT_RECURSION_LIMIT` / `#  define Py_DEFAULT_RECURSION_LIMIT 1000` (default 1000 unless the build overrides it).

FAQ (`faq/library.rst`): *"In general, Python offers to switch among threads only between bytecode instructions; how frequently it switches can be set via sys.setswitchinterval(). Each bytecode instruction and therefore all the C implementation code reached from each instruction is therefore atomic from the point of view of a Python program."* · *"In practice, it means that operations on shared variables of built-in data types (ints, lists, dicts, etc) that "look atomic" really are."* · atomic list: `L.append(x)`, `L1.extend(L2)`, `x = L[i]`, `x = L.pop()`, `L1[i:j] = L2`, `L.sort()`, `x = y`, `x.field = y`, `D[x] = y`, `D1.update(D2)`, `D.keys()` · *"These aren't: i = i+1, L.append(L[-1]), L[i] = L[j], D[x] = D[x] + 1"* · *"Operations that replace other objects may invoke those other objects' `__del__()` method when their reference count reaches zero, and that can affect things. This is especially true for the mass updates to dictionaries and lists. When in doubt, use a mutex!"*
`library/threadsafety.rst` (free-threaded build): *"This page documents thread-safety guarantees for built-in types in Python's free-threaded build. The guarantees described here apply when using Python with the GIL disabled (free-threaded mode). When the GIL is enabled, most operations are implicitly serialized."* · list: *"The following operations return new objects and appear atomic to other threads: `lst1 + lst2`, `x * lst`, `lst.copy()  # returns a shallow copy of the list`"* · dict: *"The following operations return new objects and hold the per-object lock for the duration of the operation: `d.copy()`, `d | other`, `d.keys()`, `d.values()`, `d.items()`"* · *"To safely iterate over a dictionary that may be modified by another thread, iterate over a copy: `for key, value in d.copy().items():`"* · *"Consider external synchronization when sharing dict instances across threads."* · set: *"The copy() method returns a new object and holds the per-object lock for the duration so that it is always atomic."* **The page says nothing about `copy.copy` or `copy.deepcopy`.**
Iteration-during-mutation strings in C source: `"dictionary changed size during iteration"` and `"dictionary keys changed during iteration"` (`dictobject.c` l.5240, 5281 …), `"Set changed size during iteration"` (`setobject.c` l.917). `_deepcopy_dict` iterates `x.items()` and runs Python code (each `deepcopy` call) between steps ⇒ another thread can change the dict mid-copy (source-derived).

JSON (`Doc/library/json.rst`): *"Keys in key/value pairs of JSON are always of the type str. When a dictionary is converted into JSON, all the keys of the dictionary are coerced to strings. As a result of this, if a dictionary is converted into JSON and then back into a dictionary, the dictionary may not equal the original one. That is, loads(dumps(x)) != x if x has non-string keys."* · py→json table: `dict`→object, **`list, tuple`→array**, `str`→string, `int, float, int- & float-derived Enums`→number, `True/False/None`. · *"If check_circular is true (the default), then lists, dicts, and custom encoded objects will be checked for circular references during encoding to prevent an infinite recursion (which would cause a RecursionError). Otherwise, no such check takes place."* — `Lib/json/encoder.py` l.287/346/449: `raise ValueError("Circular reference detected")`; l.182: `TypeError(f'Object of type {o.__class__.__name__} is not JSON serializable')` (the source line is `raise TypeError(f'Object of type {o.__class__.__name__} ' f'is not JSON serializable')`). · *"If allow_nan is true (the default), then NaN, Infinity, and -Infinity will be encoded as such. This behavior is not JSON specification compliant …"*

`__slots__` (`Doc/reference/datamodel.rst` "Notes on using `__slots__`"): *"Without a `__dict__` variable, instances cannot be assigned new variables not listed in the `__slots__` definition."* · *"`__slots__` are implemented at the class level by creating descriptors for each variable name. As a result, class attributes cannot be used to set default values for instance variables defined by `__slots__`; otherwise, the class attribute would overwrite the descriptor assignment."* · *"Without a `__weakref__` variable for each instance, classes defining `__slots__` do not support weak references to its instances."* · *"The action of a `__slots__` declaration is not limited to the class where it is defined. `__slots__` declared in parents are available in child classes."*

## 10 · Discrepancies and things NOT confirmed

- **D1 — methods.** Docs (and the module docstring): *"This module does not copy types like module, method, …"*. Source: `_deepcopy_dispatch[types.MethodType] = _deepcopy_method` = `type(x)(x.__func__, deepcopy(x.__self__, memo))`. **A bound method of a Python instance is deep-copied by deep-copying its owner.** Say: "the sentence in the docs is about the intent; the code in 3.14.7 does this; the code is what runs." `copy.copy(bound_method)` is not atomic either: goes `method.__reduce__` (not read; **do not describe**).
- **D2 — `dataclasses.replace` error type** (above).
- **D3 — `defaultdict` C comment "functions are not copyable at this time"** vs `FunctionType` atomic (above).
- Phase 1 `08c` says of `weakref`: *"the copy either gets a reference to the original referent or a dead one"* — source says `weakref.ref` is returned as the **same ref object** (F18) → same live referent; report as a defect in another topic (phase-1 08c), not fixed.
- Phase 1 `08c` says enum copy behaviour is unconfirmed — now confirmed in `enum.py` (§6).
- **Not confirmed (write as uncertain):** exact `TypeError` text for `copy.copy(MappingProxyType(...))` (expected `cannot pickle 'mappingproxy' object` by the default-path rule — not confirmed); what `copy.copy(bound_method)` returns; behaviour of `datetime`/`Path`/`UUID` copies (not read — leave out); free-threaded-build behaviour of `copy.deepcopy` beyond "the module is pure Python and the thread-safety page lists only built-in methods".
- **Nothing here was executed.** Every "what happens" is a reading of the tag. The pages must say so.

## 11 · Link map (all `ls`-verified 2026-09-21; paths relative to `docs/python/pages/`)

Phase 1 `phase-1-language-core/07-assignment-and-aliasing/`: `08-shallow-copy.md` · `08b-deepcopy.md` · `08c-copy-hooks-and-uncopyable.md` · `09-immutability-is-shallow.md` · `10-designing-away-aliasing.md` · `10b-read-only-views-and-boundaries.md` · `11-where-it-bites.md` · `11b-publishing-state-and-diagnostics.md` · `11c-caches-workers-and-orm.md` · `03b-repetition-and-shared-refs.md` · `05b-dont-touch-mine.md` · `06-mutable-default-argument.md` · `README.md`.
Phase 0: `phase-0-runtime/02-the-gil/02-the-gil-is-not-thread-safety.md`, `03-making-threaded-code-correct.md`, `06-free-threading.md`. Phase 2: `phase-2-functions/10-recursion-and-the-limit/01-recursion-error-and-the-c-stack.md`, `phase-2-functions/06-functools/01-partial-and-freezing-callables.md`, `phase-2-functions/07-callables-beyond-functions/02-bound-methods-and-the-reality-of-self.md`, `phase-2-functions/03-scope-and-closures/03-closures-and-the-late-binding-trap.md`.
Phase 3 siblings: `01-list-internals/10-copies-and-aliasing.md`, `02-tuple/01-what-immutability-freezes.md`, `03-dict/06-building-a-dict.md`, `03-dict/07-merging.md`, `04-set-and-frozenset/` (`05-frozenset-hashable-sets.md`, `03g-subclassing-set-does-not-intercept-mutation.md`), `05-slicing/05-slices-are-copies.md`, `06-collections-module/` (`02b-defaultdict-in-production.md`, `04b-bounded-deques.md`, `06b-chainmap-traps.md`, `07-ordereddict-what-it-still-does.md`, `08-userlist-and-userdict.md`, `09-crossing-a-boundary.md`), `07-heapq-and-bisect/`.
**Not written yet → bold + *(not written yet)*:** pickle in depth; phase 4 dataclasses/classes; phase 6 threading; typing; testing.

## 12 · Chunk plan (this bank's contract)

01 what copy.copy decides · 01b atomic types and identity · 02 deepcopy algorithm · 02b the memo as an API · 03 cycles and shared children traced · 03b containers that cannot be registered early · 04 reduce protocol · 04b `_reconstruct` step by step · 04c what reconstruct runs that you did not expect · 05 writing copy hooks · 05b copyreg and third-party types · 06 `__slots__` · 06b dataclasses under copy · 06c namedtuple, enum, partial · 07 `copy.replace` · 07b dataclasses.replace and `init=False` · 07c implementing `__replace__` · 08 builtins' copy spellings · 08b collections types · 09 callables in a copied graph · 10 what cannot be copied · 10b finding and fixing the uncopyable · 11 the config two requests shared · 11b fixes that copy · 11c fixes that freeze · 12 JSON and pickle round trips · 12b structural sharing and copy-on-write · 13 deepcopy cost · 13b the recursion limit · 14 not atomic under threads · 15 testing copy behaviour · 16 choosing, and the interview drill. (Merge/split freely; the plan is a floor.)
