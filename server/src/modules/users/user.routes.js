import express from "express";
import User from "./user.model.js";

const router = express.Router();

router.post("/test", async (req, res) => {
  const user = await User.create(req.body);

  res.status(201).json({
    success: true,
    data: user,
  });
});

export default router;
