import { Router } from "express";
import { Item } from "./models/Item.js";
import { Claim } from "./models/Claim.js";
import { AuditLog } from "./models/AuditLog.js";
import mongoose from "mongoose";

const router = Router();
 
router.get("/index", async (req, res) => {
  const item = Claim.findOne({});
  res.send({ stock: item.stock });
});

router.post("/seed", async (_req, res) => {
  await Item.deleteMany({});
  const item = await Item.create({ name: "Widget", stock: 10 });
  res.json(item);
});

router.post("/items/:id/claim", async (req, res) => {
   const session = await mongoose.startSession();
 let claim, item;
    try {
    const result = await session.withTransaction(async () => {
    const requestId = req.headers["x-request-id"];

  if (!requestId)
    return res.status(400).json({ error: "x-request-id header required" });

  try {
    claim = await Claim.create([{
      requestId,
      itemId: req.params.id,
      expiresAt: new Date(Date.now() + 30_000),
    }],  { session } );
  } catch (e) {
    if (e.code === 11000)
      return res.status(409).json({ error: "duplicate request" });

    throw e;
  }

  item = await Item.findOneAndUpdate(
    { _id: req.params.id, stock: { $gt: 0 } },
    { $inc: { stock: -1 } },
      { session } 
  );

  if (!item) {
    await Claim.deleteOne({ requestId },   { session } );
    return res.status(409).json({ error: "no stock" });
  }

  await AuditLog.create([{
    itemId: item._id,
    requestId:claim._id,
    previousStock: item.stock,
    newStock: item.stock-1,
    action: "claim"
  }],   { session } )  

});

  res.json({ claimed: true, stockAfter: item.stock -1, claimId: claim._id });
}catch(e){
   res.status(400).json({
      error: e.message,
    });
}finally{
    await session.endSession();
}
});

router.patch("/claim/:claimId/confirm", async (req, res) => {
  const claim = await Claim.findById(req.params.claimId);

  if (!claim) {
    return res.status(404).json({
      error: "Claim does not exist",
    });
  }
  if (claim.status !== "pending") {
    return res.status(409).json({ error: "claim is no longer pending" });
  }

  claim.status = "confirmed";
  await claim.save();

  return res.status(200).json({
    itemConfirmed: true,
  });
});

router.patch("/items/:id/reset", async (req, res) => {
  const item = await Item.findByIdAndUpdate(req.params.id, { stock: 10 });
  res.send(item);
});

export default router;
