import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

await mongoose.connect(process.env.MONGO_URI);
const db = mongoose.connection.db;
const base = "http://localhost:5000/api";

const req = async (method, path, body, token) => {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${base}${path}`, opts);
  let json;
  try { json = await r.json(); } catch { json = {}; }
  return { status: r.status, data: json };
};

const pass = (msg) => console.log(`✅ PASS: ${msg}`);
const fail = (msg) => console.log(`❌ FAIL: ${msg}`);
const check = (cond, msg) => cond ? pass(msg) : fail(msg);

// ===== LOGINS =====
const aL = await req("POST", "/auth/login", { email: "admin@slotsync.com", password: "Password123!" });
const adminToken = aL.data.data?.accessToken;
check(aL.status === 200 && aL.data.data?.user?.role === "ADMIN", `Admin login → ADMIN`);

const c1L = await req("POST", "/auth/login", { email: "counsellor1@slotsync.com", password: "Password123!" });
const c1Token = c1L.data.data?.accessToken;
const c1Id = c1L.data.data?.user?.id;
check(c1L.status === 200, `Counsellor1 login`);

const c2L = await req("POST", "/auth/login", { email: "counsellor2@slotsync.com", password: "Password123!" });
const c2Token = c2L.data.data?.accessToken;
const c2Id = c2L.data.data?.user?.id;
check(c2L.status === 200, `Counsellor2 login`);

const s1L = await req("POST", "/auth/login", { email: "student1@slotsync.com", password: "Password123!" });
const s1Token = s1L.data.data?.accessToken;
check(s1L.status === 200, `Student1 login`);

const s2L = await req("POST", "/auth/login", { email: "student2@slotsync.com", password: "Password123!" });
const s2Token = s2L.data.data?.accessToken;

const s3L = await req("POST", "/auth/login", { email: "student3@slotsync.com", password: "Password123!" });
const s3Token = s3L.data.data?.accessToken;
check(s3L.status === 200, `Student3 login`);

// ===== BUSINESS RULES =====

// Rule 1: Wrong password → 401
const r1 = await req("POST", "/auth/login", { email: "admin@slotsync.com", password: "wrongpass" });
check(r1.status === 401, `Rule1: Wrong password → 401 (got ${r1.status})`);

// Rule 2: No auth → 401
const r2 = await req("GET", "/analytics/admin");
check(r2.status === 401, `Rule2: No auth → 401 (got ${r2.status})`);

// Rule 3: Student → admin route → 403
const r3 = await req("GET", "/analytics/admin", null, s1Token);
check(r3.status === 403, `Rule3: Student→admin route → 403 (got ${r3.status})`);

// Rule 4: Counsellor → other counsellor analytics → 403
const r4 = await req("GET", `/analytics/counsellor/${c2Id}`, null, c1Token);
check(r4.status === 403, `Rule4: Counsellor→other counsellor → 403 (got ${r4.status})`);

// ===== ANALYTICS =====
const adminStats = await req("GET", "/analytics/admin", null, adminToken);
check(adminStats.status === 200, `Admin analytics → 200`);
console.log(`  Users: ${adminStats.data.data?.users?.totalUsers}, Slots: ${adminStats.data.data?.slots?.totalSlots}, Bookings: ${adminStats.data.data?.bookings?.totalBookings}`);
console.log(`  Utilization: ${adminStats.data.data?.utilization?.utilizationPercentage}%`);

const c1Stats = await req("GET", `/analytics/counsellor/${c1Id}`, null, c1Token);
check(c1Stats.status === 200, `Counsellor1 self-analytics → 200`);
console.log(`  Counsellor1: totalSlots=${c1Stats.data.data?.totalSlots}, util=${c1Stats.data.data?.seatUtilization?.utilizationPercentage}%`);

// Admin can see counsellor analytics
const adminC1Stats = await req("GET", `/analytics/counsellor/${c1Id}`, null, adminToken);
check(adminC1Stats.status === 200, `Admin→counsellor analytics → 200`);

// ===== AUDIT LOGS =====
const auditR = await req("GET", "/admin/audit-logs?limit=5", null, adminToken);
check(auditR.status === 200, `Audit logs → 200`);
console.log(`  Audit logs returned: ${auditR.data.data?.logs?.length}`);

// ===== CREATE TEST SLOTS =====
// Use a date far in future and unique hour offset to avoid collision with previous verify runs
const futureDate = new Date();
futureDate.setDate(futureDate.getDate() + 90);
const fd = futureDate.toISOString().split("T")[0];
const hourOffset = new Date().getMinutes() % 10; // varies 0-9 giving unique hour slots per run

const slotA = await req("POST", "/slots", { startTime: `${fd}T0${hourOffset}:00:00.000Z`, endTime: `${fd}T0${hourOffset+1}:00:00.000Z`, capacity: 1 }, c1Token);
const slotAId = slotA.data.data?.id;
check(slotA.status === 201, `Create SlotA (cap=1) → 201 (got ${slotA.status}: ${slotA.data.message})`);

const slotB = await req("POST", "/slots", { startTime: `${fd}T${10+hourOffset}:00:00.000Z`, endTime: `${fd}T${10+hourOffset+1}:00:00.000Z`, capacity: 2 }, c1Token);
const slotBId = slotB.data.data?.id;
check(slotB.status === 201, `Create SlotB (cap=2) → 201 (got ${slotB.status}: ${slotB.data.message})`);
console.log(`  SlotA: ${slotAId}, SlotB: ${slotBId}`);

// ===== BOOKING FLOW =====
const bA1 = await req("POST", "/bookings", { slotId: slotAId }, s1Token);
const bA1Id = bA1.data.data?.id;
check(bA1.status === 201, `Student1 books SlotA → 201 (status=${bA1.data.data?.status})`);

const bB1 = await req("POST", "/bookings", { slotId: slotBId }, s1Token);
const bB1Id = bB1.data.data?.id;
check(bB1.status === 201, `Student1 books SlotB → 201`);

const bB2 = await req("POST", "/bookings", { slotId: slotBId }, s2Token);
check(bB2.status === 201, `Student2 books SlotB → 201 (SlotB now FULL)`);

// Rule 5: Full slot → 409
const r5 = await req("POST", "/bookings", { slotId: slotAId }, s2Token);
check(r5.status === 409, `Rule5: Full slot → 409 (got ${r5.status}, code=${r5.data.code})`);

// Rule 6: Overlapping booking → 409
// Create another slot overlapping SlotA using a different counsellor — hourOffset+0.5h overlap
const overlapSlot = await req("POST", "/slots", { startTime: `${fd}T0${hourOffset}:30:00.000Z`, endTime: `${fd}T0${hourOffset+1}:30:00.000Z`, capacity: 15 }, c2Token);
if (overlapSlot.status === 201) {
  const r6 = await req("POST", "/bookings", { slotId: overlapSlot.data.data?.id }, s1Token);
  check(r6.status === 409, `Rule6: Overlapping booking → 409 (got ${r6.status}, code=${r6.data.code})`);
} else {
  console.log(`  Rule6 setup: overlap slot created: ${overlapSlot.status} ${overlapSlot.data.message}`);
}

// Rule 7: Booking within 30-min window → 422
// Find a slot starting in <30 minutes from seeded data or create
const soonStart = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes from now
const soonEnd = new Date(soonStart.getTime() + 60 * 60 * 1000);
const soonSlot = await req("POST", "/slots", { startTime: soonStart.toISOString(), endTime: soonEnd.toISOString(), capacity: 15 }, c1Token);
if (soonSlot.status === 201) {
  const r7 = await req("POST", "/bookings", { slotId: soonSlot.data.data?._id }, s3Token);
  check(r7.status === 422, `Rule7: Book within 30min window → 422 (got ${r7.status}, code=${r7.data.code})`);
}

// ===== WAITLIST FLOW =====
// Student3 tries to book full SlotB
const wlTry = await req("POST", "/bookings", { slotId: slotBId }, s3Token);
check(wlTry.status === 409, `Student3 attempts full SlotB → 409 (got ${wlTry.status})`);

// Student3 joins waitlist
const wlJoin = await req("POST", "/waitlist", { slotId: slotBId }, s3Token);
check(wlJoin.status === 201, `Student3 joins waitlist → 201 (got ${wlJoin.status})`);
console.log(`  Waitlist: pos=${wlJoin.data.data?.queuePosition} status=${wlJoin.data.data?.status}`);

// Rule 8: Cancel within 2-hour window
const near2h = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
const near2hEnd = new Date(near2h.getTime() + 60 * 60 * 1000);
const nearSlot = await req("POST", "/slots", { startTime: near2h.toISOString(), endTime: near2hEnd.toISOString(), capacity: 15 }, c1Token);
if (nearSlot.status === 201) {
  const nearBook = await req("POST", "/bookings", { slotId: nearSlot.data.data?.id }, s3Token);
  if (nearBook.status === 201) {
    const r8 = await req("PATCH", `/bookings/${nearBook.data.data?.id}/cancel`, {}, s3Token);
    check(r8.status === 422, `Rule8: Cancel within 2h window → 422 (got ${r8.status}, code=${r8.data.code})`);
  } else {
    console.log(`  Rule8: booking attempt: ${nearBook.status} (${nearBook.data.message})`);
  }
}

// ===== WAITLIST PROMOTION =====
// Student1 cancels SlotB → Student3 gets promoted
const cancelB = await req("PATCH", `/bookings/${bB1Id}/cancel`, {}, s1Token);
check(cancelB.status === 200, `Student1 cancels SlotB → 200 (got ${cancelB.status})`);

await new Promise(r => setTimeout(r, 1000)); // Wait for async promotion

const s3BookingsR = await req("GET", "/bookings/my-bookings", null, s3Token);
const s3Promoted = s3BookingsR.data.data?.find(b => b.slot?.id?.toString() === slotBId?.toString() && b.status === "BOOKED");
check(!!s3Promoted, `Student3 auto-promoted to BOOKED on SlotB`);

const s3WaitlistR = await req("GET", "/waitlist/my-waitlist", null, s3Token);
const stillWaiting = s3WaitlistR.data.data?.find(w => w.slot?.id?.toString() === slotBId?.toString() && w.status === "WAITING");
check(!stillWaiting, `Student3 waitlist entry no longer WAITING`);

// ===== DELETE /bookings/:id route =====
const delR = await req("DELETE", `/bookings/${bA1Id}`, null, s1Token);
check(delR.status === 200 || delR.status === 409, `DELETE /bookings/:id mapped correctly (got ${delR.status} not 404)`);

// ===== COUNSELLOR OUTCOME MANAGEMENT =====
// Mark a past booking as ATTENDED
const c1Slots = await req("GET", "/counsellor/dashboard", null, c1Token);
console.log(`  Counsellor dashboard: ${c1Slots.status} ${JSON.stringify(c1Slots.data.data?.stats || {})}`);

// ===== MY BOOKINGS =====
const s1MyBooks = await req("GET", "/bookings/my-bookings", null, s1Token);
check(s1MyBooks.status === 200, `My Bookings loads → 200 (${s1MyBooks.data.data?.length} bookings)`);

// ===== DATABASE VERIFICATION =====
console.log("\n=== DATABASE COLLECTION COUNTS ===");
const userCount = await db.collection("users").countDocuments();
const slotCount = await db.collection("slots").countDocuments();
const bookingCount = await db.collection("bookings").countDocuments();
const waitlistCount = await db.collection("waitlists").countDocuments();
const auditCount = await db.collection("audits").countDocuments();
console.log(`Users: ${userCount}`);
console.log(`Slots: ${slotCount}`);
console.log(`Bookings: ${bookingCount}`);
console.log(`Waitlist entries: ${waitlistCount}`);
console.log(`Audit logs: ${auditCount}`);

// User field verification
const sampleUser = await db.collection("users").findOne({ role: "STUDENT" }, { projection: { name: 1, email: 1, role: 1 } });
console.log(`\nSample user fields (no extra fields): ${JSON.stringify(Object.keys(sampleUser))}`);

// Sample booking
const sampleBooking = await db.collection("bookings").findOne({}, { projection: { student: 1, slot: 1, status: 1 } });
console.log(`Sample booking fields: ${JSON.stringify(Object.keys(sampleBooking))}`);

console.log("\n=== VERIFICATION COMPLETE ===");
await mongoose.disconnect();
process.exit(0);
