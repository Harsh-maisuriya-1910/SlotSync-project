import { connect, disconnect, clearDatabase } from "../setup/mongodb.js";
import User from "../../src/modules/users/user.model.js";
import Audit from "../../src/modules/audit/audit.model.js";
import ROLES from "../../src/constants/roles.js";
import { jest } from "@jest/globals";

jest.setTimeout(60000);

describe("Audit: Append-Only Immutability Tests", () => {
  let user;

  beforeAll(async () => {
    await connect();
    await User.createIndexes();
  });

  afterAll(async () => {
    await disconnect();
  });

  beforeEach(async () => {
    await clearDatabase();

    user = await User.create({
      name: "Auditor",
      email: "auditor@test.com",
      password: "Password123!",
      role: ROLES.ADMIN,
    });
  });

  const createLog = async () => {
    return await Audit.create({
      user: user._id,
      action: "BOOKING_CREATED",
      entity: "BOOKING",
      entityId: user._id,
      metadata: { seeded: true },
    });
  };

  test("creating audit records still works", async () => {
    const log = await createLog();

    expect(log._id).toBeDefined();
    expect(log.action).toBe("BOOKING_CREATED");
  });

  test("updateOne is rejected", async () => {
    await createLog();

    await expect(
      Audit.updateOne({ action: "BOOKING_CREATED" }, { $set: { action: "TAMPERED" } }),
    ).rejects.toThrow(/append-only/i);
  });

  test("updateMany is rejected", async () => {
    await createLog();

    await expect(
      Audit.updateMany({}, { $set: { metadata: {} } }),
    ).rejects.toThrow(/append-only/i);
  });

  test("findOneAndUpdate is rejected", async () => {
    const log = await createLog();

    await expect(
      Audit.findOneAndUpdate({ _id: log._id }, { $set: { action: "TAMPERED" } }),
    ).rejects.toThrow(/append-only/i);
  });

  test("replaceOne is rejected", async () => {
    const log = await createLog();

    await expect(
      Audit.replaceOne({ _id: log._id }, { action: "REPLACED" }),
    ).rejects.toThrow(/append-only/i);
  });

  test("deleteOne (query and document) is rejected", async () => {
    const log = await createLog();

    await expect(
      Audit.deleteOne({ _id: log._id }),
    ).rejects.toThrow(/append-only/i);

    await expect(log.deleteOne()).rejects.toThrow(/append-only/i);
  });

  test("deleteMany is rejected", async () => {
    await createLog();

    await expect(Audit.deleteMany({})).rejects.toThrow(/append-only/i);
  });

  test("save() on an existing record is rejected", async () => {
    const log = await createLog();

    log.action = "TAMPERED";

    await expect(log.save()).rejects.toThrow(/append-only/i);
  });

  test("records remain readable after all rejection paths", async () => {
    const log = await createLog();

    const found = await Audit.findById(log._id);

    expect(found).not.toBeNull();
    expect(found.action).toBe("BOOKING_CREATED");
  });
});
