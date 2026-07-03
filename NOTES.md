# Inventory Reservation System

A backend-only API built to demonstrate a classic concurrency bug in stock
management and its production-grade fix. Correctness under load, not feature breadth.

## The Bug (Phase 1)

`POST /claim/:id` originally did a read-then-decrement in two separate operations:

1. `findById` — reads current stock
2. `item.save()` — writes the decremented value

Under concurrency, 50 requests can all read `stock: 10` before any write lands.
Every request sees stock > 0, every request decrements, and the result is negative
stock and overselling. Phase 2 proved it: 50 concurrent requests against `stock: 10`
produced 50 successes.

## The Fix (Phase 3)

Replaced with a single atomic `findOneAndUpdate`:

Item.findOneAndUpdate(
  { _id: req.params.id, stock: { $gt: 0 } },
  { $inc: { stock: -1 } },
);


MongoDB processes this as one operation. The filter and the decrement happen
together — no window for another request to slip in and read stale stock.

## Load Test Results

50 concurrent `POST /claim`, `stock: 10`, 10 independent runs:

| Run | Successes | Failures |
|-----|-----------|----------|
| All 10 | 10 | 40 |

No overselling observed across any run.

## Stack

- Node 24 LTS
- Express
- MongoDB + Mongoose
- No frontend — correctness is proven by load test, not by clicking buttons