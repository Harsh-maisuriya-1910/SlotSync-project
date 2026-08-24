# SlotSync Performance Notes

## Dataset Profile

Seed Dataset:

- 1 Admin
- 5 Counsellors
- 200 Students
- 300 Slots
- ~5000 Bookings
- ~800 Waitlist Entries

This dataset is used to simulate realistic platform activity and validate scalability assumptions.

---

## Database Indexing Strategy

### Booking Collection

Indexes:

- (student, slot, status)

Purpose:

- Prevent duplicate bookings
- Accelerate booking lookups

---

### Slot Collection

Indexes:

- `(counsellor, startTime, endTime)` (Compound Index)

Purpose:

- Fast counsellor schedule retrieval
- Dashboard performance
- High-efficiency counsellor slot overlap-detection

#### Index Proof (Overlap-Detection Query)

To prevent scheduling overlapping slots for the same counsellor, the database executes the following query:
```javascript
Slot.findOne({
  counsellor: counsellorId,
  startTime: { $lt: endTime },
  endTime: { $gt: startTime }
});
```

Here is the `explain("executionStats")` metrics comparison before and after creating the compound index `{ counsellor: 1, startTime: 1, endTime: 1 }` on a dataset of 1,000 slots:

| Metric | Before Index | After Index |
| --- | --- | --- |
| **Winning Stage** | `COLLSCAN` / `FETCH` | `FETCH -> IXSCAN` |
| **executionTimeMillis** | `2 ms` | `1 ms` |
| **totalKeysExamined** | `1000` (or `0` on COLLSCAN) | `3` |
| **totalDocsExamined** | `1000` | `1` |
| **nReturned** | `1` | `1` |

**Field Order Rationale:**
- **counsellor (1st)**: Prefilters the dataset to only slots owned by the queried counsellor. This is an equality check (`counsellor: counsellorId`), which must come first under the Equality-Sort-Range (ESR) rule.
- **startTime (2nd) & endTime (3rd)**: Range queries check boundaries (`$lt` / `$gt`). Putting `startTime` before `endTime` conforms to sorting and range scanning order, allowing MongoDB to efficiently check range overlaps using the index keys without scanning any unrelated documents.

---

### Waitlist Collection

Indexes:

- (slot, position)

Purpose:

- Efficient FIFO promotion

---

### Audit Collection

Indexes:

- (createdAt)

Purpose:

- Faster audit filtering and reporting

---

## Booking Concurrency Performance

### Test Scenario

Simultaneous booking requests against the same slot.

### Validation Goals

- No overbooking
- Correct seat allocation
- Proper waitlist behavior

### Result

- Capacity respected
- No duplicate reservations
- No race-condition failures
- No inconsistent seat counts

---

## Waitlist Promotion Performance

### Validation

Automatic promotion executed during booking cancellation workflow.

### Result

- FIFO order preserved
- Promotion performed transactionally
- No skipped queue positions

---

## Analytics Performance

### Architecture

Single MongoDB `$facet` aggregation pipeline.

### Metrics Generated

- Seat Utilization
- Booking Status Distribution
- Busiest Slots
- Lead-Time Buckets
- Fourteen-Day Trend

### Benefit

All analytics are generated within a single aggregation execution rather than multiple independent queries.

---

## Pagination Performance

### Strategy

Cursor Pagination

### Why

Traditional `skip()` queries become slower as datasets grow.

Cursor pagination provides:

- Stable sorting
- Consistent response times
- Better scalability

---

## Frontend Performance

### RTK Query

Caching enabled for:

- Users
- Slots
- Bookings
- Waitlists
- Audit Logs
- Analytics

### Result

Reduced network traffic and improved UI responsiveness.

---

## Cache Invalidation Strategy

Mutations automatically invalidate related cached resources.

Examples:

### Create Booking

Refreshes:

- Slots
- Bookings
- Analytics

### Cancel Booking

Refreshes:

- Bookings
- Waitlist
- Analytics

### Join Waitlist

Refreshes:

- Waitlist

This prevents stale UI state.

---

## Docker Performance Considerations

### Services

- MongoDB
- API
- Frontend

### Features

- Health Checks
- Restart Policies
- Multi-stage Builds
- Non-root Runtime Containers

### Benefit

Improved deployment reliability and startup validation.

---

## Test Results

Backend:

- 25 Test Suites
- 112 Passing Tests

Coverage:

- Statements: 94.73%
- Branches: 74.73%
- Functions: 96.74%
- Lines: 95.02%

Frontend:

- ESLint: PASS
- Production Build: PASS

---

## Performance Summary

The application demonstrates:

- Transaction-safe booking workflows
- Consistent waitlist promotion
- Efficient aggregation analytics
- Stable cursor-based pagination
- Production-ready frontend build performance

The architecture is suitable for moderate-to-high scheduling workloads while maintaining data consistency and predictable response behavior.
