import mongoose from "mongoose";

const claimSchema = new mongoose.Schema({
  requestId: { type: String, unique: true },
  itemId: mongoose.Schema.Types.ObjectId,
  claimedAt: { type: Date, default: Date.now },
  status: { type: String, enum: ["pending", "confirmed"], default: "pending" },
  pendingAt: Date,
});

export const Claim = mongoose.model("Claim", claimSchema);
