import express from "express";
import mongoose from "mongoose";
import "dotenv/config";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));

const start = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  app.listen(3000, () => console.log("listening on 3000"));
};

start();
