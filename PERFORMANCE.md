# PERFORMANCE.md — Aggregation, Indexing, Transactions & Concurrency

## 1. Aggregation Strategy

### Counsellor analytics — single `$facet` pipeline
`GET /api/analytics/counsellor/:id` runs **one** aggregation on the `slots` collection (`analytics.repository.js → getCounsellorAnalyticsPipeline`):

```
$match { counsellor }            ← narrow first: only that counsellor's slots
$facet
  ├─ seatUtilization             $group capacity/booked sums + percentage $project
  ├─ bookingStatusDistribution   $lookup bookings → $unwind → $group by status
  ├─ busiestSlots                $sort bookedCount desc → $limit 5
  ├─ leadTimeBuckets             $lookup → lead-time computation → $bucket (0/24/48h+)
  └─ fourteenDayTrend            $lookup → date filter → $dateToString group → sort
```

- **No N+1 queries**: all five report sections derive from one DB round-trip; per-counsellor data volume keeps each facet branch within memory limits.
- `$match` before `$facet` reduces documents entering every branch.
- The repository post-processes facet output into a stable response shape (zero-filled distributions, ordered buckets) so the API contract stays constant even when facets return empty arrays.

### Dashboard rollups
Admin and counsellor dashboards use grouped aggregations with `$count` / `$group` sub-pipelines inside their own `$facet` stages rather than multiple `find + count` round-trips.

## 2. Indexing Strategy

| Collection | Index | Purpose |
| --- | --- | --- |
| users | `{ email: 1 } unique` | Login lookup + duplicate registration guard (E11000) |
| slots | `{ counsellor: 1 }` | Counsellor-scoped listings and analytics `$match` prefix |
| slots | `{ counsellor: 1, startTime: 1, endTime: 1 }` | Overlap checks and time-sorted own-slot listing |
| slots | implicit `_id` | Seat reservation point updates, analytics joins |
| bookings | `{ student: 1, slot: 1 } unique` | Duplicate booking prevention + "my bookings" lookups |
| waitlist | `{ student: 1, slot: 1 } unique (partial: status=WAITING)` | One active queue entry per student/slot |
| waitlist | `{ slot: 1, status: 1, queuePosition: 1 }` | FIFO head retrieval during promotion |

**Design rules applied**
- Indexes mirror access patterns: equality fields first (`counsellor`, `student`, `slot`), range/sort fields last (`startTime`, `queuePosition`).
- Partial indexes keep the write path lean — only `WAITING` documents pay the uniqueness tax.
- Unique indexes double as concurrency guards (last-line-of-defense against race-window duplicates).

## 3. Transaction Strategy

MongoDB multi-document transactions (replica set) wrap every operation whose steps must succeed or fail **as a unit**:

### Booking creation
```
START TRANSACTION
  1. reserveSeat          — atomic conditional $inc (409 SLOT_FULL if lost)
  2. createBooking        — insert (E11000 on true duplicates)
  3. audit log            — BOOKING_CREATED entry
COMMIT  (any failure → ABORT → no partial state)
```

### Cancellation (+ waitlist promotion)
```
START TRANSACTION
  1. update booking       → CANCELLED
  2. promoteNextStudent   — atomic claim of FIFO head + promoted booking creation
  3. audit log            — BOOKING_CANCELLED + WAITLIST_PROMOTED entries
COMMIT
```

Tests simulate failures at step 2 (repository mock throws) and verify full rollback: booking still active, seat count unchanged, zero audit rows — proving transactions, not best-effort sequencing.

**Operational requirement:** MongoDB ≥ 4.2 replica set. Local dev/test satisfies this via `mongodb-memory-server` replsets; docker-compose provisions one for development.

## 4. Concurrency Protection

SlotSync assumes hostile timing: parallel requests, double-clicks, and retries are normal.

| Threat | Protection | Layer | Test evidence |
| --- | --- | --- | --- |
| Overbooked final seat | Capacity predicate inside `findOneAndUpdate` filter (`bookedCount < capacity`) — Mongo serializes writers | slot.repository `reserveSeat` | 20 concurrent requests, capacity 5 → exactly 5 succeed |
| Duplicate booking by same student | Service read-check **plus** unique `(student, slot)` index | booking.service + model | 10 concurrent identical requests → 1 success, rest 409 |
| Lost cancellation/promotion race | Promotion claims queue head via conditional `findOneAndUpdate` inside the cancel transaction | waitlist.service | Concurrent cancels promote distinct students in FIFO order, no duplicates |
| Waitlist double-join under race | Partial unique index `(student, slot) WHERE WAITING` | waitlist.model | 50 parallel joins → exactly 1 created |
| Stale reads across booking flow | Multi-document transaction gives consistent snapshot for check-then-act sequences | booking.service | Rollback tests assert exact counter/log restoration |
| Retroactive state edits | Status machine terminal states enforced in service layer | counsellor.service | CANCELLED→ATTENDED etc. rejected 422 |

**Why this mix.** Each protection is enforced as close to the data as possible:
1. **Atomic conditional updates** for single-document invariants (seat counts, queue heads) — no application locks needed.
2. **Unique indexes** as the authoritative deduplication mechanism.
3. **Transactions** only where multiple collections must move together.

This avoids distributed-lock complexity while keeping correctness under concurrency provable by tests rather than by assumption.

## 5. Known Performance Boundaries

- Slot listing uses offset pagination (`skip`/`limit`); deep pages degrade linearly — cursor pagination is the planned successor.
- Analytics compute on request; sustained heavy read load would warrant materialized rollups or a cache layer.
- Audit log growth is unbounded; archival/TTL policies should precede production scale-out.
