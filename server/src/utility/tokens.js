import crypto from "crypto";

const generateOpaqueToken = () => {
  return crypto.randomBytes(48).toString("hex");
};

const hashToken = (token) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

const generateFamilyId = () => {
  return crypto.randomUUID();
};

export { generateOpaqueToken, hashToken, generateFamilyId };
