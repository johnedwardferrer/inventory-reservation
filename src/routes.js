import { Router } from "express";
import { Item } from "./item.js";
import { Claim } from "./claim.js";

const router = Router();

router.post("/seed", async (_req, res) => {
  await Item.deleteMany({});
  const item = await Item.create({ name: "Widget", stock: 10 });
  res.json(item);
});

// FIXED — atomic check-and-decrement, no gap
router.post("/claim/:id", async (req, res) => {
  try {
    await Claim.create({ requestId, itemId: req.params.id });
  } catch (e) {
    if (e.code === 11000)
      return res.status(409).json({ error: "duplicate request" });
    throw e;
  }

  const item = await Item.findOneAndUpdate(
    { _id: req.params.id, stock: { $gt: 0 } },
    { $inc: { stock: -1 } },
    { new: true },
  );

  if (!item) return res.status(409).json({ error: "no stock" });
  res.json({ claimed: true, stockAfter: item.stock });
});

router.patch("/:id/reset", async (req, res) => {
  const item = await Item.findByIdAndUpdate(req.params.id, { stock: 10 });
  res.send(item);
});

export default router;
