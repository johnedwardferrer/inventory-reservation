import { Router } from "express";
import mongoose from "mongoose";

import { Item } from "./models/Item.js";
import { Claim } from "./models/Claim.js";
import { AuditLog } from "./models/AuditLog.js";

const router = Router();

router.get("/items", async (_req, res, next) => {
  try {
    const items = await Item.find().lean();

    if (!items) {
      return res.status(404).json({
        error: "no items",
      });
    }

    return res.json(items);
  } catch (err) {
    next(err);
  }
});

router.post("/seed", async (_req, res, next) => {
  try {
    await Promise.all([
      Item.deleteMany({}),
      Claim.deleteMany({}),
      AuditLog.deleteMany({}),
    ]);

    for(let i = 0; i<10; i++){
  const item = await Item.create({
      name: `Item${i+1}`,
      stock: 10,
    });
    }

    return res.status(201).json({success: "seeded successfully"});
  } catch (err) {
    next(err);
  }
});

router.post("/items/:id/claim", async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: "Invalid item id", code: "INVALID_ID" });
  }

  const requestId = req.header("x-request-id");

  if (!requestId) {
    return res.status(400).json({ error: "x-request-id header required", code: "MISSING_REQUEST_ID" });
  }

  const session = await mongoose.startSession();

  try {
    let response;
    let statusCode = 200;

    await session.withTransaction(async () => {
      let claim;

      try {
        [claim] = await Claim.create(
          [{
            requestId,
            itemId: req.params.id,
            expiresAt: new Date(Date.now() + 30_000),
          }],
          { session },
        );
      } catch (err) {
        if (err.code === 11000) {
          statusCode = 409;
          response = { error: "Duplicate request", code: "DUPLICATE_REQUEST" };
          return;
        }
        throw err;
      }

      const item = await Item.findOneAndUpdate(
        { _id: req.params.id, stock: { $gt: 0 } },
        { $inc: { stock: -1 } },
        { new: false, session },
      );

      if (!item) {
        statusCode = 409;
        response = { error: "No stock available", code: "OUT_OF_STOCK" };
        return;
      }

      await AuditLog.create(
        [{
          itemId: item._id,
          requestId: claim._id,
          previousStock: item.stock,
          newStock: item.stock - 1,
          action: "claim",
        }],
        { session },
      );

      response = {
        claimed: true,
        claimId: claim._id,
        stockAfter: item.stock - 1,
        expiresAt: claim.expiresAt,
      };
    });

    return res.status(statusCode).json(response);
  } catch (err) {
    next(err); // only genuinely unexpected errors reach here now
  } finally {
    await session.endSession();
  }
});

router.get("/items/claim/:claimId/status", async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.claimId)) {
    return res.status(400).json({ error: "Invalid claim id" });
  }

  const session = await mongoose.startSession();

  try {
    const claim = await Claim.findById(req.params.claimId);

    if (!claim) {
      return res.status(404).json({ error: "Claim does not exist" });
    }

    // Lazy expire: still marked pending, but time's up
    if (claim.status === "pending" && claim.expiresAt < new Date()) {
      await session.withTransaction(async () => {
        const freshClaim = await Claim.findOne(
          { _id: claim._id, status: "pending" },
          null,
          { session },
        );

        if (freshClaim) {
          const item = await Item.findByIdAndUpdate(
            freshClaim.itemId,
            { $inc: { stock: 1 } },
            { new: true, session },
          );

          await AuditLog.create(
            [{
              itemId: freshClaim.itemId,
              requestId: freshClaim._id,
              previousStock: item.stock - 1,
              newStock: item.stock,
              action: "expire",
            }],
            { session },
          );

          freshClaim.status = "expired";
          await freshClaim.save({ session });
        }
      });

      return res.json({ status: "expired" });
    }

    return res.json({ status: claim.status, expiresAt: claim.expiresAt });
  } catch (err) {
    next(err);
  } finally {
    await session.endSession();
  }
});

router.patch("/items/claim/:claimId/confirm", async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.claimId)) {
    return res.status(400).json({ error: "Invalid claim id" });
  }

  const session = await mongoose.startSession();

  try {
    let response;
    let statusCode = 200;

    await session.withTransaction(async () => {
      const claim = await Claim.findById(req.params.claimId).session(session);

      if (!claim) {
        statusCode = 404;
        response = { error: "Claim does not exist" };
        return;
      }

      if (claim.status !== "pending") {
       statusCode = 409;
       response = { error: "Claim is no longer pending", code: "ALREADY_RESOLVED" };
      return;
      }

      if (claim.expiresAt < new Date()) {
        const item = await Item.findByIdAndUpdate(
          claim.itemId,
          { $inc: { stock: 1 } },
          { new: true, session },
        );

        await AuditLog.create(
          [{
            itemId: claim.itemId,
            requestId: claim._id,
            previousStock: item.stock - 1,
            newStock: item.stock,
            action: "expire",
          }],
          { session },
        );

        claim.status = "expired";
        await claim.save({ session });

        statusCode = 409;
        response = { error: "Claim expired", code: "EXPIRED" };
        return;
      }

      claim.status = "confirmed";
      await claim.save({ session });

      statusCode = 200;
      response = { itemConfirmed: true };
    });

    return res.status(statusCode).json(response);
  } catch (err) {
    next(err);
  } finally {
    await session.endSession();
  }
});

router.patch("/items/:id/reset", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        error: "Invalid item id",
      });
    }

    const item = await Item.findByIdAndUpdate(
      req.params.id,
      { stock: 10 },
      {
        new: true,
      },
    );

    if (!item) {
      return res.status(404).json({
        error: "Item not found",
      });
    }

    return res.json(item);
  } catch (err) {
    next(err);
  }
});

export default router;
