# DECISIONS.md — Architecture & Design Decisions

This document records the significant engineering decisions behind SlotSync, the alternatives considered, and the tradeoffs accepted.

## 1. Layered Modular Monolith (routes → controller → service → repository → model)

**Decision.** Each domain (`auth`, `users`, `slots`, `bookings`, `counsellor`, `waitlist`, `audit`, `analytics`) is a self-contained module with four layers:

- `*.routes.js` — HTTP surface + middleware chain
- `*.controller.js` — request/response shaping only
- `*.service.js` — business rules and invariants
- `*.repository.js` — data access and aggregation pipelines

**Why.**
- Business rules (booking windows, cancellation cutoffs, status machine) live in one testable place, not smeared across controllers.
- Repositories isolate Mongoose specifics, so aggregation-heavy analytics can be optimized without touching HTTP code.
- Modules mirror the PDF's functional decomposition, making compliance audits direct.

**Tradeoff.** More files/indirection than a flat Express app. Accepted because the domain rules are non-trivial and heavily tested; the layering is what makes 79 integration tests readable.

## 2. Centralized Error Contract via ApiError

**Decision.** Services throw `new ApiError(statusCode, message, CODE)`; one error middleware converts anything thrown into `{ success: false, message, code }`.

**Why.** One JSON error shape for the frontend, stable machine-readable codes (`CANCELLATION_WINDOW_CLOSED`, `SLOT_FULL`, `INVALID_STATUS_TRANSITION`), no scattered try/catch formatting.

**Tradeoff.** Error semantics must be documented and kept consistent (e.g., validation/conflict classes use 4xx consistently). Covered by integration tests asserting both status and `code`.

## 3. Status Machine for Booking Lifecycle

**Decision.**

```
BOOKED → CANCELLED   (student, ≥120 min before slot start)
BOOKED → ATTENDED    (owning counsellor)
BOOKED → NO_SHOW     (owning counsellor)
CANCELLED / ATTENDED / NO_SHOW → terminal
```

Invalid transitions return **422 `INVALID_STATUS_TRANSITION`**, not 409 — 422 signals "the request is semantically invalid for this resource state", keeping 409 reserved for true concurrent conflicts (duplicate booking, full slot).

**Why.** Outcome marking and cancellation are different actors with different rules; a single explicit guard in `markBookingOutcome` plus the cutoff check in `cancelBooking` encodes the whole lifecycle. Terminal-state enforcement prevents retroactive attendance edits.

**Tradeoff.** No "reopen" or "undo" path. Accepted: audit log preserves history, and rebooking creates a new record.

## 4. Time-Window Rules

- **Booking window:** slots are bookable until T-30 min (prevents last-second booking churn).
- **Cancellation cutoff:** cancellations are rejected inside T-120 min (422) so waitlist promotion has time to fill vacated seats with real lead time.

Both are computed from `slot.startTime - now` at request time. Tests pin behavior at boundaries (>2h passes, <2h fails, exactly-120-min-plus-padding passes).

## 5. Concurrency Decisions

### Seat reservation (no overbooking)
`reserveSeat` performs an atomic conditional update:

```js
findOneAndUpdate(
  { _id, bookedCount: { $lt: "$capacity" }, status != CANCELLED },
  { $inc: { bookedCount: 1 } }
)
```

The capacity predicate lives **inside the filter**, so MongoDB serializes competing increments — two requests racing on the final seat yield exactly one winner (`409 SLOT_FULL` for the loser). Verified by concurrency tests firing 10–20 parallel bookings.

### Multi-document transactions
Booking creation/cancellation wraps `reserveSeat` + `createBooking` (+ audit + waitlist promotion) in a Mongo transaction. Any failure aborts the whole unit — tests simulate mid-transaction failures and assert complete rollback (no orphan audit logs, unchanged counters).

**Tradeoff.** Requires a replica set (dev uses mongodb-memory-server replset; prod requires Mongo ≥4.2 replica set). Accepted as a hard operational requirement rather than losing atomicity.

### Duplicate protection
Unique index on `(student, slot)` backs the service-level duplicate check — even if two identical requests race past the read check, the second insert fails with E11000.

## 6. Waitlist Strategy

**Decision.** FIFO queue per slot with `queuePosition`; promotion happens **inside the cancellation transaction**: cancel booking → atomically claim next waiting entry (`findOneAndUpdate` on `status: WAITING`, lowest position) → create promoted booking → seat count stays constant (seat transfers directly from canceller to promotee).

**Why in-transaction?** Without it, a cancelled seat briefly appears available and an unrelated student could book it before the waitlisted student is promoted — breaking FIFO fairness guarantees under race conditions.

**Index support.**
- Partial unique index `(student, slot) WHERE status = WAITING` — one active queue entry per student/slot.
- Compound index `(slot, status, queuePosition)` — O(log n) retrieval of the next candidate.

**Race handling.** Concurrent joins rely on the unique partial index (50 parallel joins → exactly 1 success); concurrent cancellations each claim distinct queue heads via atomic conditional updates (tested).

**Tradeoff.** Promoted students inherit no grace period beyond the standard window rules; if they never confirm, they simply hold the booking like any other.

## 7. Audit Strategy

**Decision.** Append-only audit records written via `Audit.create(...)` (or within the caller's transaction where atomicity matters). Actions captured: `SLOT_CREATED`, `BOOKING_CREATED`, `BOOKING_CANCELLED`, `WAITLIST_PROMOTED`, `OUTCOME_UPDATED`. Records store actor, action, entity type/id, and metadata snapshot.

**Why append-only.** The log exists to reconstruct sequence of events; mutability would undermine its evidentiary purpose. Admin API is read-only by design.

**Tradeoff.** No update/delete endpoints means mistakes cannot be corrected, only superseded by new entries. Accepted deliberately.

## 8. Analytics via Single `$facet` Aggregation

**Decision.** Counsellor analytics executes **one** aggregation against `slots` with five `$facet` sub-pipelines (`seatUtilization`, `bookingStatusDistribution`, `busiestSlots`, `leadTimeBuckets`, `fourteenDayTrend`). Bookings join via `$lookup`.

**Why.** A single round-trip avoids N+1 queries and keeps all sections mutually consistent (same implicit snapshot). `$facet` lets each section apply independent grouping without intermediate collections.

**Tradeoff.** `$facet` materializes branch inputs in memory; bounded by per-counsellor slot volume, which is small relative to server limits.

## 9. Deterministic Production Seed

**Decision.** Seed uses a fixed-seed PRNG (mulberry32), wipes collections first (idempotent re-runs), pre-hashes the shared demo password once, bulk-inserts in batches, then reconciles `bookedCount/status` from actual booking rows and verifies referential integrity with aggregations (orphans/duplicates/mismatches must be zero).

**Why deterministic?** Bug reports and local demos stay reproducible; integrity verification makes the seed self-checking rather than trusting generation logic blindly.

## 10. JWT Access Tokens with Stateless Verification

**Decision.** Short-lived JWT bearer tokens verified by middleware; logout maintains a server-side token registry for invalidation.

**Tradeoff.** Refresh token rotation is deferred (tracked in README limitations). Access-token expiry keeps the stolen-token window short in the interim.
