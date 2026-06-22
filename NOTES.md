# NOTES.md

## The Bug (Phase 1)

`POST /claim/:id` did a read-then-decrement in two separate operations:

1. `findById` — reads current stock
2. `item.save()` — writes decremented stock

Under concurrency, 50 requests can all read stock:10 before any write lands.
All 50 see stock > 0, all 50 decrement, result: stock goes negative and
10x overselling occurs. Proven in Phase 2: 50 successes against stock:10.

## The Fix (Phase 3)

Replaced with a single atomic `findOneAndUpdate`:

```js
Item.findOneAndUpdate(
  { _id: req.params.id, stock: { $gt: 0 } },
  { $inc: { stock: -1 } },
  { new: true },
);
```

MongoDB processes this as one operation. The filter `stock: { $gt: 0 }` and
the decrement `$inc: { stock: -1 }` happen together — no window for another
request to read stale stock in between.

## Load Test Results

50 concurrent POST /claim, stock:10, 10 independent runs:

- Every run: successes: 10, failures: 40
- No overselling observed across any run
