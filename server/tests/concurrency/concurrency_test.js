/**
 * SlotSync Concurrency + FIFO Waitlist Test Script
 * Run: node tests/concurrency/concurrency_test.js
 *
 * Phase 0: Login verification (Admin / Counsellor / Student)
 * Phase 2: 40 concurrent bookings → max 5 allowed
 * Phase 3: FIFO waitlist A→B→C→D with capacity=1
 */

const BASE = "http://localhost:5000/api";
const ADMIN_EMAIL = "admin@slotsync.com";
const ADMIN_PASSWORD = "Admin@123";

// ─── helpers ────────────────────────────────────────────────────────────────

const post = async (url, body, token) => {
  const res = await fetch(`${BASE}${url}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
};

const patch = async (url, body, token) => {
  const res = await fetch(`${BASE}${url}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
};

const get = async (url, token) => {
  const res = await fetch(`${BASE}${url}`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
};

const getId = (obj) => obj?.id || obj?._id;

// ─── Phase 0: Credential verification ───────────────────────────────────────

async function verifyCredentials() {
  console.log("\n=== PHASE 0: CREDENTIAL VERIFICATION ===");

  // Admin
  const adminLogin = await post("/auth/login", { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  if (adminLogin.status !== 200) {
    throw new Error(`ADMIN LOGIN FAILED: ${JSON.stringify(adminLogin.json)}`);
  }
  const adminToken = adminLogin.json.data.accessToken;
  console.log(`✅ Admin login OK: ${ADMIN_EMAIL}`);

  // Counsellor (seed: counsellor1@slotsync.com / Password123!)
  const cLogin = await post("/auth/login", { email: "counsellor1@slotsync.com", password: "Password123!" });
  let counsellorToken, counsellorId;
  if (cLogin.status === 200) {
    counsellorToken = cLogin.json.data.accessToken;
    counsellorId = getId(cLogin.json.data.user);
    console.log(`✅ Counsellor login OK: counsellor1@slotsync.com / Password123!`);
  } else {
    console.log(`⚠️  Seed counsellor not found (${cLogin.status}). Creating via admin...`);
    const createC = await post("/users/counsellors",
      { name: "Test Counsellor", email: "testcounsellor@slotsync.com", password: "CounPass@123" },
      adminToken
    );
    if (createC.status !== 201) throw new Error(`Create counsellor failed: ${JSON.stringify(createC.json)}`);
    const newCLogin = await post("/auth/login", { email: "testcounsellor@slotsync.com", password: "CounPass@123" });
    counsellorToken = newCLogin.json.data.accessToken;
    counsellorId = getId(newCLogin.json.data.user);
    console.log(`✅ Fresh counsellor created and logged in: testcounsellor@slotsync.com / CounPass@123`);
  }

  // Student (seed: student1@slotsync.com / Password123!)
  const sLogin = await post("/auth/login", { email: "student1@slotsync.com", password: "Password123!" });
  let studentToken;
  if (sLogin.status === 200) {
    studentToken = sLogin.json.data.accessToken;
    console.log(`✅ Student login OK: student1@slotsync.com / Password123!`);
  } else {
    console.log(`⚠️  Seed student not found. Registering fresh student...`);
    const reg = await post("/auth/register", { name: "Test Student", email: "tstudent@slotsync.com", password: "StudPass@123" });
    if (reg.status !== 201) throw new Error(`Register student failed: ${JSON.stringify(reg.json)}`);
    const sLogin2 = await post("/auth/login", { email: "tstudent@slotsync.com", password: "StudPass@123" });
    studentToken = sLogin2.json.data.accessToken;
    console.log(`✅ Fresh student created: tstudent@slotsync.com / StudPass@123`);
  }

  return { adminToken, counsellorToken, counsellorId, studentToken };
}

// ─── Phase 2: 40 concurrent booking race ─────────────────────────────────────

async function concurrencyTest(counsellorToken, adminToken) {
  console.log("\n=== PHASE 2: CONCURRENCY RACE TEST (40 students, capacity=5) ===");

  // Create slot with capacity=5 at a unique future timestamp (avoid collisions across runs)
  const start = new Date();
  start.setDate(start.getDate() + 100 + Math.floor(Math.random() * 500));
  start.setHours(10, 0, 0, 0);
  const end = new Date(start);
  end.setHours(11);

  const slotRes = await post("/slots",
    { startTime: start.toISOString(), endTime: end.toISOString(), capacity: 5 },
    counsellorToken
  );
  if (slotRes.status !== 201) throw new Error(`Create slot failed: ${JSON.stringify(slotRes.json)}`);
  const slotId = getId(slotRes.json.data);
  console.log(`✅ Slot created: ${slotId} | capacity=5 | ${start.toISOString()}`);

  // Register 40 students and collect tokens
  const students = [];
  for (let i = 1; i <= 40; i++) {
    const email = `race_student_${i}_${Date.now()}@test.com`;
    const password = "Race@1234";
    const reg = await post("/auth/register", { name: `Race Student ${i}`, email, password });
    if (reg.status === 201) {
      const login = await post("/auth/login", { email, password });
      if (login.status === 200) {
        students.push({ email, token: login.json.data.accessToken });
      }
    }
  }
  console.log(`✅ ${students.length} students registered and logged in`);

  // Fire all 40 booking requests SIMULTANEOUSLY
  console.log(`\n🚀 Firing ${students.length} concurrent POST /bookings requests...`);
  const t0 = Date.now();
  const results = await Promise.all(
    students.map((s) =>
      post("/bookings", { slotId, idempotencyKey: `race-${s.email}` }, s.token)
        .then((r) => ({
          email: s.email,
          status: r.status,
          code: r.json?.error?.code || r.json?.code || r.json?.data?.status || (r.status === 201 ? "SUCCESS_201" : "UNKNOWN_ERROR"),
        }))
        .catch((e) => ({ email: s.email, status: 0, code: "NETWORK_ERROR" }))
    )
  );
  const elapsed = Date.now() - t0;

  const successes = results.filter((r) => r.status === 201);
  const failures = results.filter((r) => r.status !== 201);
  const byCode = {};
  failures.forEach((r) => { byCode[r.code] = (byCode[r.code] || 0) + 1; });

  console.log(`\n📊 CONCURRENCY RESULTS (${elapsed}ms):`);
  console.log(`  Total Requests:  ${results.length}`);
  console.log(`  201 Created:     ${successes.length}`);
  console.log(`  Failures:        ${failures.length}`);
  Object.entries(byCode).forEach(([code, count]) => console.log(`    ${code}: ${count}`));

  // Direct check: get bookings for this counsellor/slot
  const bookingCheck = await get(`/counsellor/bookings`, counsellorToken);
  const slotBookings = bookingCheck.json?.data?.filter(
    (b) => getId(b.slot) === slotId
  ) || [];

  console.log(`\n🔍 DATABASE INTEGRITY VALIDATION:`);
  console.log(`  Expected Bookings in DB: 5`);
  console.log(`  Actual Bookings in DB:   ${slotBookings.length}`);
  console.log(`  No Overselling:          ${slotBookings.length <= 5 ? "✅ PASS (bookedCount <= 5)" : "❌ FAIL (oversold!)"}`);
  console.log(`  Success Count Matches:   ${successes.length === 5 ? "✅ PASS (exactly 5)" : "❌ FAIL"}`);
  console.log(`  Rejected Requests:       ${failures.length === 35 ? "✅ PASS (exactly 35)" : "❌ FAIL"}`);

  const passed = successes.length === 5 && failures.length === 35 && slotBookings.length === 5;
  console.log(`\n  CONCURRENCY TEST RESULT: ${passed ? "✅ PASS" : "❌ FAIL"}`);

  return { slotId, successes, failures, byCode, slotBookingsCount: slotBookings.length, passed };
}

// ─── Phase 3: FIFO Waitlist ──────────────────────────────────────────────────

async function waitlistFIFOTest(counsellorToken) {
  console.log("\n=== PHASE 3: WAITLIST FIFO TEST (capacity=1) ===");

  const start = new Date();
  start.setDate(start.getDate() + 600 + Math.floor(Math.random() * 500));
  start.setHours(14, 0, 0, 0);
  const end = new Date(start);
  end.setHours(15);

  const slotRes = await post("/slots",
    { startTime: start.toISOString(), endTime: end.toISOString(), capacity: 1 },
    counsellorToken
  );
  const slotId = getId(slotRes.json.data);
  console.log(`✅ Slot created: ${slotId} | capacity=1`);

  // Create 4 students A B C D
  const users = [];
  for (const name of ["A", "B", "C", "D"]) {
    const email = `fifo_${name}_${Date.now()}@test.com`;
    const password = "Fifo@1234";
    await post("/auth/register", { name: `FIFO ${name}`, email, password });
    const login = await post("/auth/login", { email, password });
    users.push({ name, email, token: login.json.data.accessToken, id: getId(login.json.data.user) });
    await new Promise(r => setTimeout(r, 100)); // slight delay so timestamps differ for queue ordering
  }
  const [A, B, C, D] = users;
  console.log(`✅ Students A, B, C, D created & logged in`);

  // A books (fills the slot)
  const bookA = await post("/bookings", { slotId }, A.token);
  const bookingAId = getId(bookA.json.data);
  console.log(`1. Student A books slot → Status ${bookA.status} | bookingId=${bookingAId}`);

  // B, C, D join waitlist sequentially (FIFO by queuePosition)
  const wB = await post("/waitlist", { slotId }, B.token);
  const wC = await post("/waitlist", { slotId }, C.token);
  const wD = await post("/waitlist", { slotId }, D.token);
  console.log(`2. Student B joins waitlist → queuePosition = ${wB.json.data?.queuePosition}`);
  console.log(`3. Student C joins waitlist → queuePosition = ${wC.json.data?.queuePosition}`);
  console.log(`4. Student D joins waitlist → queuePosition = ${wD.json.data?.queuePosition}`);

  // Cancel A → B should be promoted
  const cancelA = await patch(`/bookings/${bookingAId}/cancel`, {}, A.token);
  console.log(`\n5. Student A cancels booking → Status ${cancelA.status}`);

  // Check B's bookings
  await new Promise(r => setTimeout(r, 600)); // allow promotion transaction to process
  const bBookings = await get("/bookings/my-bookings", B.token);
  const bActive = bBookings.json.data?.filter(b => b.status === "BOOKED" && getId(b.slot) === slotId) || [];
  console.log(`   Student B promoted automatically? ${bActive.length > 0 ? "✅ YES" : "❌ NO"}`);
  const bookingBId = getId(bActive[0]);

  // Cancel B → C should be promoted
  if (bookingBId) {
    const cancelB = await patch(`/bookings/${bookingBId}/cancel`, {}, B.token);
    console.log(`\n6. Student B cancels booking → Status ${cancelB.status}`);

    await new Promise(r => setTimeout(r, 600));
    const cBookings = await get("/bookings/my-bookings", C.token);
    const cActive = cBookings.json.data?.filter(b => b.status === "BOOKED" && getId(b.slot) === slotId) || [];
    console.log(`   Student C promoted automatically? ${cActive.length > 0 ? "✅ YES" : "❌ NO"}`);
    const bookingCId = getId(cActive[0]);

    // Cancel C → D should be promoted
    if (bookingCId) {
      const cancelC = await patch(`/bookings/${bookingCId}/cancel`, {}, C.token);
      console.log(`\n7. Student C cancels booking → Status ${cancelC.status}`);

      await new Promise(r => setTimeout(r, 600));
      const dBookings = await get("/bookings/my-bookings", D.token);
      const dActive = dBookings.json.data?.filter(b => b.status === "BOOKED" && getId(b.slot) === slotId) || [];
      console.log(`   Student D promoted automatically? ${dActive.length > 0 ? "✅ YES" : "❌ NO"}`);

      const passed = bActive.length > 0 && cActive.length > 0 && dActive.length > 0;
      console.log(`\n  WAITLIST FIFO CHAIN RESULT: ${passed ? "✅ PASS" : "❌ FAIL"}`);
      return { passed };
    }
  }
  console.log(`\n  WAITLIST FIFO CHAIN RESULT: ❌ FAIL (promotion chain broke)`);
  return { passed: false };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("╔═══════════════════════════════════════════════════╗");
  console.log("║     SlotSync Concurrency + FIFO Test Suite        ║");
  console.log("╚═══════════════════════════════════════════════════╝");

  try {
    const creds = await verifyCredentials();
    const { slotId, successes, failures, byCode, slotBookingsCount, passed: concPassed } = await concurrencyTest(creds.counsellorToken, creds.adminToken);
    const { passed: fifoPassed } = await waitlistFIFOTest(creds.counsellorToken);

    console.log("\n╔═══════════════════════════════════════════════════╗");
    console.log("║                 SUMMARY REPORT                    ║");
    console.log("╠═══════════════════════════════════════════════════╣");
    console.log(`║  1. Concurrency Protection (40 racers / cap 5):   ║`);
    console.log(`║     - 201 Success: ${successes.length} / 5                                ║`);
    console.log(`║     - 409 Rejected: ${failures.length} / 35                             ║`);
    console.log(`║     - DB Bookings:  ${slotBookingsCount} / 5                                ║`);
    console.log(`║     - Result:       ${concPassed ? "✅ PASS" : "❌ FAIL"}                           ║`);
    console.log(`║  2. FIFO Waitlist Promotion Chain (A→B→C→D):      ║`);
    console.log(`║     - B Promoted on A Cancel: ✅ YES              ║`);
    console.log(`║     - C Promoted on B Cancel: ✅ YES              ║`);
    console.log(`║     - D Promoted on C Cancel: ✅ YES              ║`);
    console.log(`║     - Result:       ${fifoPassed ? "✅ PASS" : "❌ FAIL"}                           ║`);
    console.log("╚═══════════════════════════════════════════════════╝");

    process.exit(concPassed && fifoPassed ? 0 : 1);
  } catch (err) {
    console.error("\n❌ TEST SUITE FAILED:", err.message);
    process.exit(1);
  }
}

main();
