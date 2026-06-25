import { Claim } from "../models/Claim.js";
import { Item } from "../models/Item.js";

export default function expireChecker() {
  setInterval(async () => {
    const expiredClaims = await Claim.find({
      expiresAt: { $lt: new Date() },
      status: "pending",
    });

    if (expiredClaims.length === 0) {
      return;
    }

    // atomically mark them so next tick can't double-process
    await Claim.updateMany(
      { _id: { $in: expiredClaims.map((c) => c._id) } },
      { status: "expired" },
    );

    const itemCounts = {};

    for (const claim of expiredClaims) {
      itemCounts[claim.itemId] = (itemCounts[claim.itemId] || 0) + 1;
    }

    await Promise.all(
      Object.entries(itemCounts).map(([itemId, count]) =>
        Item.findByIdAndUpdate(itemId, {
          $inc: { stock: count },
        }),
      ),
    );

    await Claim.deleteMany({
      _id: { $in: expiredClaims.map((c) => c._id) },
    });
  }, 1000);
}
