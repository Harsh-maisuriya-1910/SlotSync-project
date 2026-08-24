# PART B — Debug & Review

This document contains the detailed analysis of the bugs found in the code snippets for React, Express + Mongoose, Aggregation, and Docker, explaining the consequences of each bug in production and providing the corrected code.

---

## B1 — React (SlotBoard Component)

### Bugs Identified & Consequences

1. **State Mutation via Direct Property Assignment**
   - **Bug**: The code does `slots[i].seatsLeft = slots[i].seatsLeft - 1;` followed by `setSlots(slots);`.
   - **Consequence**: In React, updating state by directly mutating the existing state object/array does not change its reference identity. React's state setter (`setSlots`) will do a shallow equality check and assume the state has not changed, resulting in no re-render. The UI will not update dynamically when a booking is made.
   - **Fix**: Create a shallow copy of the slots array and a copy of the specific slot object being updated.

2. **Missing `day` Dependency in `useEffect`**
   - **Bug**: The URL fetched is `/api/slots?counsellor=${counsellorId}&day=${day}`, but the dependency array only has `[counsellorId]`.
   - **Consequence**: If the `day` state changes (e.g. the user changes the date filter), the component will fail to fetch the slots for the new date, leaving the user with stale/wrong slots.
   - **Fix**: Add `day` to the dependency array of the `useEffect` hook.

3. **No Request Headers (`Content-Type`) on POST Request**
   - **Bug**: `fetch("/api/bookings", { method: "POST", body: JSON.stringify({ slotId: slots[i]._id }) })` is sent without setting `Content-Type`.
   - **Consequence**: Without `headers: { 'Content-Type': 'application/json' }`, the backend's JSON body-parsing middleware will not parse the payload, resulting in `req.body` being undefined or empty on the server, causing a 400/500 error.
   - **Fix**: Add the appropriate headers to the fetch request.

4. **Using Loop Index `i` as the React Element `key`**
   - **Bug**: `<Slot key={i} ... />` uses the loop index `i` as the key.
   - **Consequence**: If the slot list is reordered, sorted, or filtered, using index-based keys can cause React to incorrectly reuse DOM nodes and component instances, leading to UI rendering bugs and input state leakage.
   - **Fix**: Use the unique database ID `s._id` as the key.

5. **No Optimistic UI Rollback on Booking Failure**
   - **Bug**: The code immediately decrements `seatsLeft` and updates the slots state, but does not handle booking failures (e.g., if the slot is full, resulting in a 409 error).
   - **Consequence**: If a slot booking fails, the UI will permanently show the decremented seat count, displaying inconsistent and incorrect information to the user.
   - **Fix**: Implement a try-catch block and restore the original slot count if the fetch request fails.

### Corrected Code

```jsx
import React, { useState, useEffect } from "react";

function SlotBoard({ counsellorId }) {
  const [slots, setSlots] = useState([]);
  const [day, setDay] = useState("2026-08-22");
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);

    const controller = new AbortController();

    fetch(`/api/slots?counsellor=${counsellorId}&day=${day}`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch slots");
        return r.json();
      })
      .then((d) => {
        if (active) setSlots(d.data || []);
      })
      .catch((err) => {
        if (active && err.name !== "AbortError") {
          setError(err.message);
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [counsellorId, day]);

  const book = async (index) => {
    const originalSlots = [...slots];
    const targetSlot = slots[index];

    if (targetSlot.seatsLeft <= 0) return;

    // Optimistically update the UI
    const updatedSlots = slots.map((s, idx) =>
      idx === index ? { ...s, seatsLeft: s.seatsLeft - 1 } : s
    );
    setSlots(updatedSlots);

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ slotId: targetSlot._id }),
      });

      if (!response.ok) {
        throw new Error("Booking failed");
      }
    } catch (err) {
      // Rollback on failure
      setSlots(originalSlots);
      alert("Booking failed. Please try again.");
    }
  };

  if (isLoading) return <div>Loading slots...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {slots.map((s, index) => (
        <Slot key={s._id} {...s} onBook={() => book(index)} />
      ))}
    </div>
  );
}
```

---

## B2 — Express + Mongoose

### Bugs Identified & Consequences

1. **Non-Atomic Capacity Verification (Overselling Race Condition)**
   - **Bug**: The check `slot.booked >= slot.capacity` is executed, followed by an in-memory update `slot.booked = slot.booked + 1; await slot.save();`.
   - **Consequence**: In a high-concurrency scenario, multiple requests can fetch the same slot state concurrently. If a slot has 1 seat left and 5 requests hit this endpoint at the same moment, all 5 will pass the check `slot.booked < slot.capacity`, and all 5 will increment and save, resulting in 5 bookings for 1 seat (overselling). This violates the core constraint.
   - **Fix**: Use Mongoose/MongoDB atomic update with filters like `Slot.findOneAndUpdate({ _id: slotId, bookedCount: { $lt: capacity } }, { $inc: { bookedCount: 1 } })` within a session.

2. **N+1 Database Query Loop**
   - **Bug**: The code loops over bookings and performs an individual database call inside the loop:
     ```javascript
     for (const b of await Booking.find({ slot: slotId })) {
       classmates.push(await User.findById(b.student));
     }
     ```
   - **Consequence**: For a slot with $N$ bookings, this executes $N$ database calls to look up users. If there are 40 students in a slot, it executes 40 consecutive queries. Under high load, this wastes database connections, drastically increases API response latency, and throttles DB throughput.
   - **Fix**: Query all bookings with Mongoose `.populate("student")` or query users in a single `$in` query: `User.find({ _id: { $in: studentIds } })`.

3. **No Rollback/Transaction for Database Writes on Downstream Failure**
   - **Bug**: `slot.booked` is incremented and saved before attempting `Booking.create`.
   - **Consequence**: If `Booking.create` fails (e.g. due to a database error or a unique key constraint violation like the student already having a booking), the seat remains counted as booked in the Slot document, but no Booking document is created. The seat is permanently leaked (lost).
   - **Fix**: Perform both updates within a MongoDB session transaction so they succeed or fail together.

4. **Post-Facto Booking Date/Time Validation (Write-then-Delete)**
   - **Bug**: The code checks `new Date(slot.startsAt) < new Date()` *after* writing the slot increment and creating the booking, and if it fails, deletes the booking document: `await Booking.deleteOne(...)`.
   - **Consequence**: First, it creates an inconsistent database state temporarily. Second, if the API crashes or the delete query fails after the booking creation, the booking is left intact for a past slot. Third, the slot's `booked` count is not decremented upon deletion, permanently leaking the seat.
   - **Fix**: Perform the date validation at the very beginning of the controller before making any database writes.

5. **Inconsistent Schema Names**
   - **Bug**: The code references `slot.startsAt` and `slot.booked`.
   - **Consequence**: In our actual models, these fields are defined as `slot.startTime` and `slot.bookedCount`. The code will evaluate `new Date(undefined) < new Date()` which is `NaN < now` (always false), completely bypassing the past-date validation! And `slot.booked` is undefined, causing check `undefined >= slot.capacity` to be false, causing NaN addition and broken capacity counts.

### Corrected Code

```javascript
import mongoose from "mongoose";
import Slot from "../models/slot.model.js";
import Booking from "../models/booking.model.js";
import User from "../models/user.model.js";

router.post("/bookings", auth, async (req, res) => {
  const { slotId } = req.body;
  const studentId = req.user.id;

  // 1. Fetch slot details
  const slot = await Slot.findById(slotId);
  if (!slot) {
    return res.status(404).json({ error: "Slot not found" });
  }

  // 2. Timing check: enforce before doing any writes
  if (new Date(slot.startTime) < new Date()) {
    return res.status(400).json({ error: "Cannot book a slot in the past" });
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    // 3. Atomic check & reserve seat inside transaction
    const updatedSlot = await Slot.findOneAndUpdate(
      {
        _id: slotId,
        $expr: { $lt: ["$bookedCount", "$capacity"] },
      },
      {
        $inc: { bookedCount: 1, version: 1 },
      },
      {
        new: true,
        session,
      }
    );

    if (!updatedSlot) {
      throw new Error("Slot is full");
    }

    // 4. Create Booking inside transaction
    const booking = await Booking.create(
      [
        {
          slot: slotId,
          student: studentId,
          status: "BOOKED",
        },
      ],
      { session }
    );

    await session.commitTransaction();

    // 5. Query classmates in a single query (avoid N+1)
    const otherBookings = await Booking.find({ slot: slotId })
      .populate("student", "name email")
      .lean();

    const classmates = otherBookings
      .map((b) => b.student)
      .filter((student) => student && student._id.toString() !== studentId);

    return res.status(201).json({
      booking: booking[0],
      classmates,
    });
  } catch (error) {
    await session.abortTransaction();
    const status = error.message === "Slot is full" ? 409 : 500;
    return res.status(status).json({ error: error.message });
  } finally {
    await session.endSession();
  }
});
```

---

## B3 — Aggregation

### Bugs Identified & Consequences

1. **Incorrect Pipeline Order (Lookups before Filter)**
   - **Bug**: The pipeline begins with `$lookup` and `$unwind` on "users" and "slots" for *all* bookings, and only filters by counsellor ID and status afterwards.
   - **Consequence**: MongoDB has to perform index-free join operations on the entire collections before applying the match filter. For millions of bookings in production, this causes huge memory consumption, high CPU load, and extremely slow response times (or pipeline crashes due to memory limits).
   - **Fix**: Put the `$match` stage as the very first step in the pipeline.

2. **Incorrect Timezone for Day Buckets (India vs UTC)**
   - **Bug**: `_id: { $dateToString: { format: "%Y-%m-%d", date: "$slot.startsAt" } }` does not define a timezone parameter.
   - **Consequence**: MongoDB will parse and format the date in UTC. India Standard Time (IST) is UTC+5:30. A slot starting on `2026-08-23T02:00:00+05:30` (IST) corresponds to `2026-08-22T20:30:00Z` (UTC). Aggregating in UTC will place this slot in the `2026-08-22` bucket instead of `2026-08-23`, yielding incorrect daily statistics.
   - **Fix**: Specify the timezone parameter: `timezone: "Asia/Kolkata"`.

3. **Referencing Non-Existent Fields (`$leadMinutes`)**
   - **Bug**: The group stage averages `"$leadMinutes"`.
   - **Consequence**: The Booking model schema does not contain a field called `leadMinutes`. The aggregation will evaluate `leadMinutes` as `null` or `undefined` for all documents, and `avgLead` will return `null` instead of actual minutes.
   - **Fix**: Calculate the lead time in the pipeline dynamically using `$subtract` between slot startsAt and booking createdAt times.

4. **Unnecessary Lookup on Users**
   - **Bug**: `$lookup` from `users` collection is performed to get the student.
   - **Consequence**: The student's details are not used anywhere in the grouping, sorting, or limiting. This join is dead code that wastes memory and execution time.
   - **Fix**: Remove the student lookup from the aggregation pipeline.

### Corrected Code & Index

#### Corrected Pipeline

```javascript
const stats = await Booking.aggregate([
  // 1. Match bookings first (efficient indexing)
  {
    $match: {
      status: { $ne: "CANCELLED" }
    }
  },
  // 2. Join with slots
  {
    $lookup: {
      from: "slots",
      localField: "slot",
      foreignField: "_id",
      as: "slot"
    }
  },
  { $unwind: "$slot" },
  // 3. Match slots for the specific counsellor
  {
    $match: {
      "slot.counsellor": new mongoose.Types.ObjectId(req.params.counsellorId)
    }
  },
  // 4. Calculate lead time in minutes dynamically
  {
    $addFields: {
      leadMinutes: {
        $divide: [
          { $subtract: ["$slot.startTime", "$createdAt"] },
          1000 * 60
        ]
      }
    }
  },
  // 5. Group by day in IST (Asia/Kolkata timezone)
  {
    $group: {
      _id: {
        $dateToString: {
          format: "%Y-%m-%d",
          date: "$slot.startTime",
          timezone: "Asia/Kolkata"
        }
      },
      total: { $sum: 1 },
      avgLead: { $avg: "$leadMinutes" }
    }
  },
  // 6. Sort and limit to get the busiest days
  { $sort: { total: -1 } },
  { $limit: 5 }
]);
```

#### Supporting Database Index
To support this pipeline, we should create a compound index on the `Booking` collection:
```javascript
bookingSchema.index({ status: 1, slot: 1 });
```
And on the `Slot` collection:
```javascript
slotSchema.index({ counsellor: 1, startTime: 1 });
```

---

## B4 — Docker

### Bugs Identified & Consequences

1. **Incorrect Database Host (`localhost` in URI)**
   - **Bug**: `ENV MONGO_URI=mongodb://localhost:27017/slotsync`
   - **Consequence**: Each container has its own network space. In Docker Compose, the API container cannot access the database using `localhost`, as that refers to the API container itself. The connection will fail, causing the API to crash on startup.
   - **Fix**: Use the service name `mongo` (defined in `docker-compose.yml`) as the host: `mongodb://mongo:27017/slotsync`.

2. **MongoDB Container is Not Configured as a Replica Set**
   - **Bug**: The compose config uses `image: mongo` without `--replSet rs0` command arguments or replication initialization.
   - **Consequence**: Mongoose transactions require MongoDB to run in replica set mode (even for a single node). Running in standalone mode causes transactions to fail, meaning every booking/cancellation attempt will crash with: `Transaction numbers are only allowed on a replica set member or mongos`.
   - **Fix**: Run MongoDB with command `--replSet rs0` and run a health check script to initialize the replica set.

3. **Running Container as Root User**
   - **Bug**: The Dockerfile does not create or switch to a non-root user.
   - **Consequence**: Running Node.js as the `root` user in a container is a security vulnerability. If an attacker gains shell access through a remote code execution vulnerability, they will run as root on the host machine and compromise the host environment.
   - **Fix**: Switch to a non-root user (`USER node` or create an explicit service user/group).

4. **Dev Dependencies Installed in Production Stage**
   - **Bug**: `RUN npm install` installs all packages (including development packages like `nodemon`).
   - **Consequence**: Installs unnecessary testing/development tools in the production image, increasing size and surface area for security vulnerabilities.
   - **Fix**: Use `npm ci --omit=dev` for production dependencies.

5. **No Multi-Stage Build**
   - **Bug**: The Dockerfile is single-stage.
   - **Consequence**: Large image sizes, since build utilities, cache files, and source structures remain in the final image.
   - **Fix**: Use multi-stage builds (`deps` stage and `runtime` stage).

6. **No Pinned Base Image Tag**
   - **Bug**: `FROM node:latest` is used.
   - **Consequence**: Using `latest` makes builds non-deterministic. If a new major Node version is released, rebuilding the image will use the new Node version, which could introduce breaking changes and fail in production.
   - **Fix**: Pin a specific node version (e.g. `node:22-alpine` or `node:20-alpine`).

7. **Secrets Baked Into the Image**
   - **Bug**: `ENV JWT_SECRET=exam-secret` is baked into the Dockerfile.
   - **Consequence**: Security credentials are baked into the image layers. Anyone with access to the image can inspect the layers and extract the secret key, allowing them to forge JWT signatures.
   - **Fix**: Remove secret definitions from the Dockerfile and supply them dynamically via Docker Compose environment variables.

8. **No API Startup Delay / Wait for MongoDB Health**
   - **Bug**: `depends_on: [mongo]` in compose starts the API simultaneously with MongoDB.
   - **Consequence**: MongoDB takes several seconds to boot and accept connections. The API container starts immediately, fails to connect to the uninitialized database, and crashes.
   - **Fix**: Use `depends_on` with `condition: service_healthy` to block API startup until MongoDB is ready and initialized.

### Corrected Configuration Files

#### Corrected Dockerfile
```dockerfile
# ---------- Stage 1: production dependencies ----------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ---------- Stage 2: runtime ----------
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
ENV PORT=4000
WORKDIR /app

# Run as non-root user for security hardening
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=deps --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --chown=appuser:appgroup package.json ./
COPY --chown=appuser:appgroup src ./src

USER appuser
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:4000/api/health" || exit 1

CMD ["node", "src/server.js"]
```

#### Corrected docker-compose.yml
```yaml
services:
  mongo:
    image: mongo:7
    container_name: slotsync-mongo
    command: ["--replSet", "rs0", "--bind_ip_all"]
    volumes:
      - mongo_data:/data/db
    ports:
      - "27017:27017"
    healthcheck:
      test: >
        mongosh --quiet --eval "
        try { rs.status().ok }
        catch (e) {
          rs.initiate({_id:'rs0', members:[{_id:0, host:'mongo:27017'}]}).ok
        }"
      interval: 10s
      timeout: 10s
      retries: 12
      start_period: 20s

  api:
    build:
      context: ./server
      dockerfile: Dockerfile
    container_name: slotsync-api
    depends_on:
      mongo:
        condition: service_healthy
    ports:
      - "4000:4000"
    environment:
      NODE_ENV: production
      PORT: 4000
      MONGO_URI: mongodb://mongo:27017/slotsync?replicaSet=rs0&directConnection=true
      JWT_SECRET: ${JWT_SECRET:-dev-super-secret-change-me}
      ADMIN_EMAIL: admin@slotsync.com
      ADMIN_PASSWORD: ${ADMIN_PASSWORD:-Admin@123}

volumes:
  mongo_data:
```
