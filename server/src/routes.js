import { Router } from "express";
import mongoose from "mongoose";

import { Item } from "./models/Item.js";
import { Claim } from "./models/Claim.js";
import { AuditLog } from "./models/AuditLog.js";

const router = Router();

router.get("/index", async (_req, res, next) => {
  try {
    const item = await Item.findOne().lean();

    if (!item) {
      return res.status(404).json({
        error: "Item not found",
      });
    }

    return res.json({
      stock: item.stock,
    });
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

    const item = await Item.create({
      name: "Widget",
      stock: 10,
    });

    return res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

router.post("/items/:id/claim", async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({
      error: "Invalid item id",
    });
  }

  const requestId = req.header("x-request-id");

  if (!requestId) {
    return res.status(400).json({
      error: "x-request-id header required",
    });
  }

  const session = await mongoose.startSession();

  try {
    let response;

    await session.withTransaction(async () => {
      let claim;

      try {
        [claim] = await Claim.create(
          [
            {
              requestId,
              itemId: req.params.id,
              expiresAt: new Date(Date.now() + 30_000),
            },
          ],
          { session },
        );
      } catch (err) {
        if (err.code === 11000) {
          throw new Error("DUPLICATE_REQUEST");
        }

        throw err;
      }

      const item = await Item.findOneAndUpdate(
        {
          _id: req.params.id,
          stock: { $gt: 0 },
        },
        {
          $inc: { stock: -1 },
        },
        {
          new: false,
          session,
        },
      );

      if (!item) {
        throw new Error("OUT_OF_STOCK");
      }

      await AuditLog.create(
        [
          {
            itemId: item._id,
            requestId,
            previousStock: item.stock,
            newStock: item.stock - 1,
            action: "claim",
          },
        ],
        { session },
      );

      response = {
        claimed: true,
        claimId: claim._id,
        stockAfter: item.stock - 1,
      };
    });

    return res.status(200).json(response);
  } catch (err) {
    if (err.message === "DUPLICATE_REQUEST") {
      return res.status(409).json({
        error: "Duplicate request",
      });
    }

    if (err.message === "OUT_OF_STOCK") {
      return res.status(409).json({
        error: "No stock available",
      });
    }

    next(err);
  } finally {
    await session.endSession();
  }
});

router.patch("/claim/:claimId/confirm", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.claimId)) {
      return res.status(400).json({
        error: "Invalid claim id",
      });
    }

    const claim = await Claim.findById(req.params.claimId);

    if (!claim) {
      return res.status(404).json({
        error: "Claim does not exist",
      });
    }

    if (claim.status !== "pending") {
      return res.status(409).json({
        error: "Claim is no longer pending",
      });
    }

    claim.status = "confirmed";
    await claim.save();

    return res.status(200).json({
      itemConfirmed: true,
    });
  } catch (err) {
    next(err);
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
