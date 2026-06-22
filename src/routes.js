import { Router } from "express";
import { Item } from "./item.js";

const router = Router();

// Seed: creates a test item with stock:10
router.post("/seed", async (_req, res) => {
  await Item.deleteMany({});
  const item = await Item.create({ name: "Widget", stock: 10 });
  res.json(item);
});

// DELIBERATELY WRONG — read-then-separate-decrement, not atomic
router.post("/claim/:id", async (req, res) => {
  const item = await Item.findById(req.params.id);
  if (!item || item.stock <= 0)
    return res.status(409).json({ error: "no stock" });

  // BUG: another request can read stock>0 here, before we decrement
  item.stock -= 1;
  await item.save();

  res.json({ claimed: true, stockAfter: item.stock });
});

export default router;
