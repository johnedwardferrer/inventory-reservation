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

## PHASE 6 ACCOMPLISHED:
- Item component tracks per-claim lifecycle via useRef (claimId, expiresAt,
  timeout, tick interval) — no shared state map needed, key={item._id}
  gives natural per-item isolation
- Stock decrements at claim time (matches server's atomic reservation in
  Phase 3), not at confirm — UI no longer shows stale availability during
  pending window
- One-shot setTimeout scheduled past server-given expiresAt (not polling
  interval) triggers a single /status check; local 1s tick is pure display
  math, zero network cost
- Added GET /items/claim/:claimId/status (read-only, lazy-expire-on-read,
  reuses existing refund+audit transaction shape) — justified as no new
  correctness claim, only exposes existing server truth
- /confirm route now independently re-derives expiry inside its own
  transaction rather than trusting client to have polled /status first
- Replaced string-matched error branching (err.message === "STRING") with
  stable `code` field across /claim and /confirm — closes Phase 5 debt
  item flagged in prior handoff
- Client resync paths: EXPIRED -> revert stock+UI, ALREADY_RESOLVED ->
  re-check and converge (handles cross-tab confirm race)
- Loading/disabled states on claim + confirm buttons, inline error display

## Stack

- Node 24 LTS
- Express
- MongoDB + Mongoose
- No frontend — correctness is proven by load test, not by clicking buttons