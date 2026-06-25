import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Item",
      required: true,
    },
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: "Claim" },
    previousStock: { type: Number, required: true },
    newStock: { type: Number, required: true },
    action: {
      type: String,
      enum: ["claim", "release", "adjustment"],
      required: true,
    },
  },
  { timestamps: true },
);

export const AuditLog = mongoose.model("AuditLog", auditLogSchema);
