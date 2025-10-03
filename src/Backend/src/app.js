import express from "express";
import routes from "./routes.js";

const app = express();
app.use(express.json());

app.get("/health", (_, res) => res.json({ ok: true, server: "up" }));
app.use("/api", routes);

export default app;
