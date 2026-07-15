import express from "express";
import mongoose from "mongoose";
import "dotenv/config";
import router from "./routes.js";
import path from "path";
import { fileURLToPath } from "url";

import expireChecker from "./services/expireChecker.js";


const app = express();
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.resolve(
  __dirname,
  "../../client/dist"
);

app.use(express.static(clientDistPath));


app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));

expireChecker();

app.use('/api', router);

app.get("/{*splat}", (req, res) => {
  res.sendFile(path.join(clientDistPath, "index.html"));
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
