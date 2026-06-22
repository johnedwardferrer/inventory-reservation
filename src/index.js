import express from "express";
import mongoose from "mongoose";
import "dotenv/config";
import router from "./routes";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));
app.use(router);

const start = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  app.listen(3000, () => console.log("listening on 3000"));
};

start();
