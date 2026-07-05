import express from "express";
import mongoose from "mongoose";
import "dotenv/config";
import router from "./routes.js";

import expireChecker from "./services/expireChecker.js";
const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));

expireChecker();

app.use(router);

app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
  });
});

app.use((err, req, res, next) => {
  console.error(err);

  if (res.headersSent) {
    return next(err);
  }

  return res.status(500).json({
    error: "Internal Server Error",
  });
});

const start = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  app.listen(3000, () => console.log("listening on 3000"));
};

start();
