import mongoose from "mongoose";
const itemSchema = new mongoose.Schema({
  name: String,
  stock: Number,
});

export const Item = mongoose.model("Item", itemSchema);
