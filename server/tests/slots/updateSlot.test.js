import { connect, disconnect, clearDatabase } from "../setup/mongodb.js";
import User from "../../src/modules/users/user.model.js";
import Slot from "../../src/modules/slots/slot.model.js";
import ROLES from "../../src/constants/roles.js";
import { jest } from "@jest/globals";

jest.setTimeout(60000);

describe("Slots: Update Slot Unit Tests (Model/DB level)", () => {
  let counsellor1, counsellor2, slot;

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

    counsellor1 = await User.create({
      name: "Counsellor 1",
      email: "counsellor1@test.com",
      password: "Password123!",
      role: ROLES.COUNSELLOR,
    });

    counsellor2 = await User.create({
      name: "Counsellor 2",
      email: "counsellor2@test.com",
      password: "Password123!",
      role: ROLES.COUNSELLOR,
    });

    slot = await Slot.create({
      counsellor: counsellor1._id,
      startTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
      capacity: 5,
      bookedCount: 0,
    });
  });

  test("Update success (capacity and timing)", async () => {
    const newCapacity = 10;
    const updatedSlot = await Slot.findByIdAndUpdate(
      slot._id,
      { capacity: newCapacity },
      { new: true },
    );

    expect(updatedSlot.capacity).toBe(newCapacity);
  });

  test("Ownership validation (simulating counsellor permissions)", async () => {
    // Verify that counsellor2 is NOT the owner of the slot
    const isOwner = slot.counsellor.toString() === counsellor2._id.toString();
    expect(isOwner).toBe(false);

    // Verify counsellor1 IS the owner of the slot
    const isOwner1 = slot.counsellor.toString() === counsellor1._id.toString();
    expect(isOwner1).toBe(true);
  });

  test("Update fails for non-existent slot", async () => {
    const fakeId = new Slot()._id;
    const result = await Slot.findByIdAndUpdate(
      fakeId,
      { capacity: 10 },
      { new: true },
    );
    expect(result).toBeNull();
  });
});
