  import { Claim } from "../models/Claim.js";
import { Item } from "../models/Item.js";
import { AuditLog } from "../models/AuditLog.js";

export default function expireChecker() {
  let running = false
  setInterval(async () => {
    if (running)return;
    running = true

    try {
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
      Object.entries(itemCounts).map(async([itemId, count]) =>{
          const item = await Item.findByIdAndUpdate(itemId, {
          $inc: { stock: count },
        }, 
      )

          await AuditLog.create({
            itemId: itemId,
            previousStock: item.stock,
            newStock:item.stock+count ,
            action: "release"
          })

        return item
      }
      ),
    );

    await Claim.deleteMany({
      _id: { $in: expiredClaims.map((c) => c._id) },
    });
    } catch (error) {
      console.log(error)
    }finally{
      running=false
    }
  
  }, 1000);
}
