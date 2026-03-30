import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

const app = new Hono();

// Middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: ["http://localhost:5173", "http://localhost:8081"],
    credentials: true,
  })
);

// Health check
app.get("/health", (c) => {
  return c.json({ success: true, data: { status: "ok" } });
});

// Placeholder routes
app.get("/items", (c) => {
  return c.json({
    success: true,
    data: {
      items: [],
      total: 0,
      page: 1,
      pageSize: 50,
    },
  });
});

app.get("/households/me", (c) => {
  return c.json({
    success: true,
    data: null,
    error: "Not implemented yet",
  });
});

app.get("/barcode/:upc", (c) => {
  const upc = c.req.param("upc");
  return c.json({
    success: false,
    error: `Barcode lookup not implemented yet: ${upc}`,
  });
});

app.post("/receipt", (c) => {
  return c.json({
    success: false,
    error: "Receipt processing not implemented yet",
  });
});

const port = parseInt(process.env.PORT || "3000");

console.log(`Server starting on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
