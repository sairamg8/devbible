---
title: "Batching a sequence is `items[i:i + n]` for `i` in `range(0, len(items), n)` — half-open slices tile the list with nothing lost, the offset is the checkpoint a retry resumes from, and the ways to get it wrong are a range that stops early, a drain loop that deletes from the front, and a cut through text or bytes that lands inside a character"
sidebar_label: "11b · Slicing in real code: batching"
sidebar_position: 24
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 for **Python 3.14.7** against the 3.14 documentation —
> [An informal introduction](https://docs.python.org/3.14/tutorial/introduction.html#text) (the
> half-open identity), [time complexity](https://docs.python.org/3.14/library/time-complexity.html)
> (get and delete slice), [`itertools.batched`](https://docs.python.org/3.14/library/itertools.html#itertools.batched),
> [`textwrap.wrap`](https://docs.python.org/3.14/library/textwrap.html#textwrap.wrap),
> [`codecs`](https://docs.python.org/3.14/library/codecs.html#codecs.IncrementalDecoder.decode)
> (incremental decoding, error handlers) and the [Unicode HOWTO](https://docs.python.org/3.14/howto/unicode.html);
> CPython 3.14 `Objects/unicodeobject.c` for the decoder's reason string. Documentation-verified —
> **no sandbox run, no program output**.

**Bulk inserts, API calls with a per-request limit, messages with a maximum length, uploads in
parts: all of them cut a sequence into consecutive runs of at most *n*. On a sequence the cut is a
slice per batch, and it has three properties the iterator version
([`batched`](07c-islice-in-practice.md)) does not: each batch keeps the sequence's type, each batch
has an offset you can checkpoint and resume from, and you can cut text and bytes — which is where
the two nasty failures live, because a slice counts code points or bytes and neither is a
character.**

## The loop, and why it loses nothing

```python
from collections.abc import Iterator, Sequence


def batches(items: Sequence, size: int) -> Iterator[tuple[int, Sequence]]:
    """Yield (offset, batch) pairs; every item appears in exactly one batch."""
    if size < 1:
        raise ValueError(f"batch size must be at least 1, got {size}")
    for offset in range(0, len(items), size):
        yield offset, items[offset:offset + size]
```

`range(0, len(items), size)` produces every start; each stop is the next start; the last slice
clamps at the end and is shorter. The tiling is the documented half-open identity —
*"the start is always included, and the end always excluded. This makes sure that `s[:i] + s[i:]`
is always equal to `s`"* ([tutorial](https://docs.python.org/3.14/tutorial/introduction.html#text))
— applied once per boundary. Each batch is a copy of `size` references (the cost table's O(j − i)
for a list slice), so the loop as a whole is linear.

**When to prefer it over `itertools.batched`.** `batched` takes any iterable and yields tuples;
use it for streams. The slice loop needs a sequence, and in exchange a list batch is a list, a `str`
batch is a `str`, a `bytes` batch is `bytes` — and the offset is right there.

## The offset is the checkpoint

A job that fails on batch 412 of 900 should resume at batch 412, not at batch 1 and not at 413. The
offset is the natural checkpoint, and it has to stay **absolute**:

```python
from collections.abc import Callable, Sequence


def run_batches(
    items: Sequence,
    size: int,
    handle: Callable[[Sequence], None],
    save_checkpoint: Callable[[int], None],
    resume_at: int = 0,
) -> None:
    for offset in range(resume_at, len(items), size):
        handle(items[offset:offset + size])
        save_checkpoint(offset + size)            # the next absolute offset to process
```

Two conditions make an offset mean anything on the second run. The input must be **the same
sequence in the same order** — a list built from a set iterates in hash order, which differs between
processes for strings ([set · 6](../04-set-and-frozenset/06-iteration-order.md)), so sort it before
batching anything you intend to resume. And the checkpoint must be saved **after** the batch
succeeded; saving it first turns a crash into a skipped batch.

## Draining from the front is quadratic

A loop that removes what it has processed looks tidy and costs a list move per batch:

```python
while pending:                          # 🔴 every del shifts the whole remaining list forward
    batch = pending[:size]
    del pending[:size]
    send(batch)
```

The 3.14 cost table prices *"Delete slice `del l[i:j]`"* at O(n − i) — deleting at the front moves
everything behind it ([09c](09c-deletion-cost-and-types.md)). With *n* items and batches of *b*, that
is *n / b* moves of a shrinking list: quadratic in *n*. Iterate by offset instead and drop the whole
list once at the end, or, when items keep arriving, consume from an iterator:

```python
from itertools import batched

for offset in range(0, len(pending), size):
    send(pending[offset:offset + size])
pending.clear()

for batch in batched(incoming_queue_iter, size):     # a stream: no front deletion at all
    send(list(batch))
```

The one type where front deletion is cheap is `bytearray`: *"deleting at the front with `del`
(`del b[0]`, `del b[:k]`) only advances the start of the buffer instead of moving the remaining
bytes, and is amortized O(1)"* — so a `bytearray` receive buffer can be consumed with `del
buf[:n]` ([09c](09c-deletion-cost-and-types.md)).

## Cutting text: code points are not characters

`len()` and slicing on a `str` count code points — *"Strings are immutable sequences of Unicode code
points"* — and a character a reader sees can be more than one:

> *"a letter like 'ê' can be represented as a single code point U+00EA, or as U+0065 U+0302, which is
> the code point for 'e' followed by a code point for 'COMBINING CIRCUMFLEX ACCENT'. These will
> produce the same output when printed, but one is a string of length 1 and the other is of length
> 2."* — [Unicode HOWTO](https://docs.python.org/3.14/howto/unicode.html)

So `text[i:i + limit]` can end between the `e` and its accent; the next message then begins with a
lone combining mark. The 3.14 `unicodedata` documentation describes no grapheme segmentation, so
the standard library cannot cut on user-perceived characters. What it can do is cut on whitespace,
which avoids the problem for ordinary prose:

```python
import textwrap


def split_message(text: str, limit: int) -> list[str]:
    """Split on whitespace into parts of at most `limit` code points each."""
    return textwrap.wrap(text, width=limit, break_long_words=True, break_on_hyphens=False)
```

`wrap` makes *"every line … at most *width* characters long"* — code points again — and by default
*"will replace each whitespace character with a single space"* and drops whitespace at line ends, so
the parts rejoin to a normalised text, not the original. With `break_long_words=True` a word longer
than the limit is still cut mid-word, and that cut can split a combining sequence.

## Cutting bytes: a byte limit and a character that does not fit

When the limit is in **bytes** — a field size, a protocol frame, an API that counts UTF-8 — measure
the encoding, not the string: *"If the code point is >= 128, it's turned into a sequence of two,
three, or four bytes"* ([Unicode HOWTO](https://docs.python.org/3.14/howto/unicode.html)). A
fitting prefix that never splits a code point:

```python
def utf8_prefix(text: str, max_bytes: int) -> str:
    """Longest prefix of `text` whose UTF-8 encoding fits in `max_bytes`, cut between code points."""
    return text.encode("utf-8")[:max_bytes].decode("utf-8", errors="ignore")
```

The byte slice may end inside a multi-byte sequence; `errors="ignore"` — *"Ignore the malformed data
and continue without further notice"* — drops that incomplete tail. The input came from a valid
`str`, so the cut is the only malformed data there can be.

Reading bytes in fixed-size chunks and decoding each chunk alone fails the same way, loudly: a chunk
boundary inside a character makes `chunk.decode("utf-8")` raise `UnicodeDecodeError` with the reason
`unexpected end of data` (CPython 3.14 `unicode_decode_utf8_impl`). An incremental decoder carries
the partial character into the next chunk:

```python
import codecs
from collections.abc import Iterable, Iterator


def decode_chunks(chunks: Iterable[bytes], encoding: str = "utf-8") -> Iterator[str]:
    decoder = codecs.getincrementaldecoder(encoding)()
    for chunk in chunks:
        yield decoder.decode(chunk)
    yield decoder.decode(b"", final=True)      # raises if the stream ended mid-character
```

> *"If *final* is true the decoder must decode the input completely and must flush all buffers. If
> this isn't possible (e.g. because of incomplete byte sequences at the end of the input) it must
> initiate error handling just like in the stateless case (which might raise an exception)."* —
> [`IncrementalDecoder.decode`](https://docs.python.org/3.14/library/codecs.html#codecs.IncrementalDecoder.decode)

To send a large `bytes` in parts without copying each part, slice a `memoryview` of it — each slice
is a view, O(1) — with the lifetime rules in [06](06-slices-that-do-not-copy.md).

## Gotchas

**★ Symptom: after a crash and resume, the import processed the first thousand rows twice — or
skipped a thousand.** Cause: the resume sliced the list (`items[resume_at:]`) and batched the slice,
so the offsets it checkpointed were relative to the slice, not the list. Fix: keep offsets absolute
by starting the range at the checkpoint.

```python
for offset in range(resume_at, len(items), size):
    handle(items[offset:offset + size])
    save_checkpoint(offset + size)
```

**★ Symptom: a batch job that drains a list gets slower the larger the list, far faster than
linearly.** Cause: `del pending[:size]` moves the rest of the list forward on every batch. Fix:
iterate by offset and clear once, or batch an iterator.

```python
for offset in range(0, len(pending), size):
    send(pending[offset:offset + size])
pending.clear()
```

**★ Symptom: the last few records of every import never arrive.** Cause: the loop stopped early —
`range(0, len(items) - size, size)`, or `len(items) // size` batches — and the short final batch was
never produced. Fix: `range(0, len(items), size)`, and assert that the batches account for every
item in tests.

```python
assert sum(len(batch) for _, batch in batches(items, 500)) == len(items)
```

**★ Symptom: `UnicodeDecodeError … unexpected end of data` from a stream reader, on random chunks
and only for non-English text.** Cause: each fixed-size byte chunk was decoded on its own, and a
chunk boundary fell inside a multi-byte character. Fix: an incremental decoder — `decode_chunks`
above.

**Symptom: an API rejects some messages as too long, although every part passed the `len(part) <=
limit` check.** Cause: the limit is in bytes and `len()` counts code points; non-ASCII text encodes
to more bytes than characters. Fix: measure the encoding.

```python
part = utf8_prefix(remaining, max_bytes=1600)
assert len(part.encode("utf-8")) <= 1600
```

**Symptom: split messages arrive with a stray accent at the start of a part.** Cause: `text[i:i + n]`
cut a base letter from its combining mark — two code points, one visible character. Fix: split on
whitespace with `textwrap.wrap` so ordinary text is cut between words; for text without spaces,
accept that the standard library has no grapheme segmentation.

**Symptom: a resumed job processes a different set of items after the restart.** Cause: the input
list was built from a set, whose iteration order differs between processes, so offset 5000 names
different items each run. Fix: sort before batching anything resumable.

```python
items = sorted(pending_ids)
```

## Interview questions

**★ How do you split a list into batches of `n`, and why doesn't it lose or repeat items?**
`for i in range(0, len(items), n): batch = items[i:i + n]`. Every batch's stop is the next batch's
start, and slices include the start and exclude the stop, so adjacent batches meet exactly —
`s[:i] + s[i:] == s` at every boundary. The last slice clamps at the end, so the short final batch
comes for free. For arbitrary iterables, `itertools.batched` does the same and yields tuples.

**★ Why is draining a list with `del items[:n]` in a loop slow?**
Deleting a slice from the front of a list moves every remaining element forward — the cost table
gives O(n − i) for `del l[i:j]`, which is O(n) at the front. Doing that once per batch makes the
whole drain quadratic. Iterating by offset and clearing once is linear. `bytearray` is the exception:
front deletion only advances the buffer's start and is amortized O(1).

**How do you make a batch job resumable?**
Process a stable, sorted sequence; checkpoint the absolute offset of the next unprocessed batch after
each batch succeeds; on restart, begin `range(checkpoint, len(items), n)`. Slicing the list first and
batching the slice makes the offsets relative, which corrupts the checkpoint.

**Why can't you decode a UTF-8 byte stream chunk by chunk with `bytes.decode`?**
Because a chunk boundary can fall inside a multi-byte character, and each chunk decoded alone ends
with an incomplete sequence, which the strict decoder rejects. An incremental decoder from
`codecs.getincrementaldecoder` keeps the partial bytes and completes the character with the next
chunk; its final call with `final=True` raises if the stream really did end mid-character.

**What is the difference between a character limit and a byte limit when cutting text?**
`len()` and slicing on `str` count code points, so a character limit is enforced on the string and a
byte limit must be enforced on its encoding. Neither counts user-perceived characters: a combining
sequence is several code points and several bytes. Cutting bytes needs care not to end inside a
code point — encode, slice, and decode with `errors="ignore"` to drop an incomplete tail.

---

← Prev: [11 · Slicing in real code: pagination](11-slicing-in-real-code.md) · [Topic index](README.md) · Next → **11c · Fixed-width records** *(not written yet)*
