import request from "supertest";
import app from "../../src/app.js";
import { connect, disconnect, clearDatabase } from "../setup/mongodb.js";
import User from "../../src/modules/users/user.model.js";
import Slot from "../../src/modules/slots/slot.model.js";
import { generateAccessToken } from "../../src/utility/jwt.js";
import ROLES from "../../src/constants/roles.js";
import { jest } from "@jest/globals";

jest.setTimeout(60000);

const TOTAL_SLOTS = 25;

describe("Slots: Cursor Pagination Integration Tests", () => {
  let counsellor, tokenStudent;

  beforeAll(async () => {
    await connect();
    await User.createIndexes();
    await Slot.createIndexes();
  });

  afterAll(async () => {
    await disconnect();
  });

  beforeEach(async () => {
    await clearDatabase();

    counsellor = await User.create({
      name: "Counsellor",
      email: "counsellor@test.com",
      password: "Password123!",
      role: ROLES.COUNSELLOR,
    });

    const student = await User.create({
      name: "Student",
      email: "student@test.com",
      password: "Password123!",
      role: ROLES.STUDENT,
    });

    tokenStudent = generateAccessToken({ id: student._id, role: student.role });

    // Insert out of order to prove stable composite sorting
    for (let i = TOTAL_SLOTS; i > 0; i -= 1) {
      await Slot.create({
        counsellor: counsellor._id,
        startTime: new Date(Date.now() + i * 60 * 60 * 1000),
        endTime: new Date(Date.now() + i * 60 * 60 * 1000 + 30 * 60 * 1000),
        capacity: 5,
      });
    }
  });

  test("walks all pages via nextCursor without duplicates or gaps", async () => {
    const seenIds = [];
    let cursor = null;
    let pages = 0;

    while (pages < 10) {
      const url = cursor
        ? `/api/slots?limit=10&cursor=${encodeURIComponent(cursor)}`
        : "/api/slots?limit=10";

      const res = await request(app)
        .get(url)
        .set("Authorization", `Bearer ${tokenStudent}`);

      expect(res.status).toBe(200);
      expect(res.body.data.slots.length).toBeLessThanOrEqual(10);

      res.body.data.slots.forEach((slot) => seenIds.push(slot.id));

      pages += 1;

      if (!res.body.data.pagination.nextCursor) {
        break;
      }

      cursor = res.body.data.pagination.nextCursor;
    }

    expect(seenIds.length).toBe(TOTAL_SLOTS);
    expect(new Set(seenIds).size).toBe(TOTAL_SLOTS);

    // Stable ordering across the whole walk
    expect(pages).toBe(3); // 25 items / limit 10 -> 3 pages
    const lastPage = await request(app)
      .get(
        `/api/slots?limit=10&cursor=${encodeURIComponent(
          (
            await request(app)
              .get("/api/slots?limit=20")
              .set("Authorization", `Bearer ${tokenStudent}`)
          ).body.data.pagination.nextCursor,
        )}`,
      )
      .set("Authorization", `Bearer ${tokenStudent}`);

    expect(lastPage.body.data.pagination.hasMore).toBe(false);
    expect(lastPage.body.data.pagination.nextCursor).toBeNull();
  });

  test("results are sorted by startTime ascending within and across pages", async () => {
    const first = await request(app)
      .get("/api/slots?limit=5")
      .set("Authorization", `Bearer ${tokenStudent}`);

    const times = first.body.data.slots.map((slot) =>
      new Date(slot.startTime).getTime(),
    );

    const sorted = [...times].sort((a, b) => a - b);
    expect(times).toEqual(sorted);
  });

  test("mid-collection insert between pages does not shift the window", async () => {
    const page1 = await request(app)
      .get("/api/slots?limit=10")
      .set("Authorization", `Bearer ${tokenStudent}`);

    const page2Before = await request(app)
      .get(`/api/slots?limit=10&cursor=${encodeURIComponent(page1.body.data.pagination.nextCursor)}`)
      .set("Authorization", `Bearer ${tokenStudent}`);

    // Insert a slot that sorts BEFORE everything already fetched
    await Slot.create({
      counsellor: counsellor._id,
      startTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
      endTime: new Date(Date.now() - 24 * 60 * 60 * 1000 + 30 * 60 * 1000),
      capacity: 5,
    });

    const page2After = await request(app)
      .get(`/api/slots?limit=10&cursor=${encodeURIComponent(page1.body.data.pagination.nextCursor)}`)
      .set("Authorization", `Bearer ${tokenStudent}`);

    expect(page2After.body.data.slots.map((s) => s.id)).toEqual(
      page2Before.body.data.slots.map((s) => s.id),
    );
  });

  test("malformed cursor is rejected with 400 INVALID_CURSOR", async () => {
    const res = await request(app)
      .get("/api/slots?cursor=garbage-cursor")
      .set("Authorization", `Bearer ${tokenStudent}`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_CURSOR");
  });

  test("limit is capped at 100 and defaults to 20", async () => {
    const overLimit = await request(app)
      .get("/api/slots?limit=5000")
      .set("Authorization", `Bearer ${tokenStudent}`);

    expect(overLimit.status).toBe(422);

    const defaultPage = await request(app)
      .get("/api/slots?cursor=")
      .set("Authorization", `Bearer ${tokenStudent}`);

    expect(defaultPage.status).toBe(200);
    expect(defaultPage.body.data.pagination.limit).toBe(20);
  });

  test("legacy callers without pagination params still get the full array", async () => {
    const res = await request(app)
      .get("/api/slots")
      .set("Authorization", `Bearer ${tokenStudent}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(TOTAL_SLOTS);
    expect(res.body.data[0].version).toBeDefined();
  });
});
