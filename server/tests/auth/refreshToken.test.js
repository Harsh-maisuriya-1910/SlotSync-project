import request from "supertest";
import app from "../../src/app.js";
import { connect, disconnect, clearDatabase } from "../setup/mongodb.js";
import User from "../../src/modules/users/user.model.js";
import RefreshSession from "../../src/modules/auth/refreshSession.model.js";
import { jest } from "@jest/globals";

jest.setTimeout(60000);

describe("Auth: Refresh Token Rotation Integration Tests", () => {
  const password = "Password123!";

  beforeAll(async () => {
    await connect();
    await User.createIndexes();
  });

  afterAll(async () => {
    await disconnect();
  });

  beforeEach(async () => {
    await clearDatabase();

    await request(app).post("/api/auth/register").send({
      name: "Rotate User",
      email: "rotate@test.com",
      password,
    });
  });

  const loginUser = async () => {
    return await request(app)
      .post("/api/auth/login")
      .send({ email: "rotate@test.com", password });
  };

  test("login issues refresh token via httpOnly cookie AND response body", async () => {
    const res = await loginUser();

    expect(res.status).toBe(200);
    expect(res.body.data.refreshToken).toBeDefined();

    const cookies = res.headers["set-cookie"];
    const refreshCookie = cookies.find((cookie) =>
      cookie.startsWith("refreshToken="),
    );

    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toContain("HttpOnly");
    expect(refreshCookie).toContain("SameSite=Strict");
    expect(refreshCookie).toContain("Path=/api/auth");
  });

  test("POST /api/auth/refresh rotates tokens using the cookie", async () => {
    const agent = request.agent(app);

    const loginRes = await agent
      .post("/api/auth/login")
      .send({ email: "rotate@test.com", password });

    const oldRefreshToken = loginRes.body.data.refreshToken;

    const res = await agent.post("/api/auth/refresh");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    expect(res.body.data.refreshToken).not.toBe(oldRefreshToken);
    expect(res.body.data.user.email).toBe("rotate@test.com");

    // New cookie supersedes the old one
    const refreshCookie = res.headers["set-cookie"].find((cookie) =>
      cookie.startsWith("refreshToken="),
    );
    expect(refreshCookie).toBeDefined();
  });

  test("accepts refreshToken in body for backward compatibility", async () => {
    const loginRes = await loginUser();

    const res = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: loginRes.body.data.refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
  });

  test("old access token flow keeps working (backward compatible login contract)", async () => {
    const loginRes = await loginUser();

    expect(loginRes.body.data.accessToken).toBeDefined();

    const me = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${loginRes.body.data.accessToken}`);

    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe("rotate@test.com");
  });

  test("reusing an already-rotated token revokes the whole family", async () => {
    const loginRes = await loginUser();
    const stolen = loginRes.body.data.refreshToken;

    // Legitimate client rotates once
    const firstRotation = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: stolen });

    expect(firstRotation.status).toBe(200);

    const latest = firstRotation.body.data.refreshToken;

    // Attacker replays the ORIGINAL stolen token
    const replay = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: stolen });

    expect(replay.status).toBe(401);
    expect(replay.body.code).toBe("REFRESH_REUSE_DETECTED");

    // Even the newest descendant is dead: chain fully revoked
    const afterRevoke = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: latest });

    expect(afterRevoke.status).toBe(401);
    expect(afterRevoke.body.code).toBe("REFRESH_TOKEN_REVOKED");
  });

  test("rejects missing or garbage refresh tokens", async () => {
    const missing = await request(app).post("/api/auth/refresh");

    expect(missing.status).toBe(401);
    expect(missing.body.code).toBe("MISSING_REFRESH_TOKEN");

    const garbage = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: "definitely-not-a-real-token" });

    expect(garbage.status).toBe(401);
    expect(garbage.body.code).toBe("INVALID_REFRESH_TOKEN");
  });

  test("logout revokes the refresh chain", async () => {
    const loginRes = await loginUser();
    const refreshToken = loginRes.body.data.refreshToken;

    const logoutRes = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${loginRes.body.data.accessToken}`)
      .send({ refreshToken });

    expect(logoutRes.status).toBe(200);

    const sessions = await RefreshSession.countDocuments({
      revokedAt: null,
    });

    expect(sessions).toBe(0);

    const res = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("REFRESH_TOKEN_REVOKED");
  });
});
