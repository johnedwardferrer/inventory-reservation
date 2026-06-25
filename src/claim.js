import mongoose from "mongoose";

const claimSchema = new mongoose.Schema({
  requestId: { type: String, unique: true, required: true },
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: "Item" },
  claimedAt: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ["pending", "confirmed", "expired"],
    default: "pending",
  },
  expiresAt: { type: Date, required: true },
});

export const Claim = mongoose.model("Claim", claimSchema);
