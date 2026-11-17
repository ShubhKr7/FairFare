// =============================================================================
// helpers/testApp.js
// -----------------------------------------------------------------------------
// WHY THIS FILE EXISTS
//   The production entry point (index.js) is a WIRE-UP script. The moment you
//   import it, it does all of this:
//     - reads process.env.ORIGIN and throws if it is missing
//     - calls connectDB()  -> connects to the REAL MongoDB
//     - calls initExpenseCategorizer() -> builds Gemini/Groq SDK clients
//     - calls initBloomFilter() -> queries the real User collection
//     - calls keepServerAwake() -> starts a permanent setInterval
//     - calls app.listen(8000) -> binds a real port
//
//   None of that is desirable in a test. A test wants the SAME routes and
//   middleware, but with runtime concerns (DB connection, background workers,
//   self-pings, port binding) removed and under the test's control.
//
//   Importing index.js directly means you are testing the DEPLOYMENT, not the
//   APPLICATION. This factory gives you the application.
//
// HOW IT WORKS
//   createTestApp() returns a bare Express app with routes mounted and
//   NOTHING ELSE. It has zero side effects: no DB connect, no listeners, no
//   port binding. You can call it 200 times in 200 tests safely.
//
//   The caller decides:
//     - which env vars to set
//     - whether to connect a real (in-memory) DB or mock models
//     - which external services to mock (jest.mock at module boundary)
//
// USAGE
//   import supertest from "supertest";
//   import { createTestApp } from "../../helpers/testApp.js";
//   const request = supertest(createTestApp());
//
//   // With auth + a specific route subset:
//   const app = createTestApp({ withAuth: true });
//
// NOTE ON IMPORT GRAPH
//   We deliberately import the ROUTES, not the controllers or index.js.
//   Routes are pure definition files (express.Router()). Importing a route
//   transitively imports its controller, which imports models and services.
//   That is fine -- those get mocked per-test where needed. What we avoid is
//   importing index.js, which runs the bootstrap side effects above.
// =============================================================================

import express from "express";
import cors from "cors";
import userRoutes from "../routes/user.js";
import groupRoutes from "../routes/group.js";
import expenseRoutes from "../routes/expense.js";
import promoRoutes from "../routes/promo.js";
import termsRoutes from "../routes/terms.js";
import aiRoutes from "../routes/ai.js";
import activityRoutes from "../routes/activity.js";

/**
 * Build a test Express application with routes mounted.
 *
 * @param {object} options
 *   - {boolean} json  - attach express.json() body parser (default true).
 *                        Some tests (e.g. form uploads) may want it off.
 *   - {boolean} cors  - attach CORS middleware (default false).
 *                        CORS is irrelevant for supertest and adds noise.
 * @returns {express.Express}
 */
export function createTestApp({ json = true, cors = false } = {}) {
  const app = express();

  if (json) {
    app.use(express.json({ extended: true }));
  }

  if (cors) {
    const allowedOrigins = (process.env.ORIGIN || "http://localhost:5173").split(",");
    app.use(
      cors({
        origin: allowedOrigins,
        methods: ["GET", "POST", "PUT", "DELETE"],
        credentials: true,
      })
    );
  }

  // Mount the same route groups index.js mounts, at the same paths.
  // Keeping paths identical means route tests double as integration tests
  // against the real routing table.
  app.use("/user", userRoutes);
  app.use("/group", groupRoutes);
  app.use("/expenses", expenseRoutes);
  app.use("/promo", promoRoutes);
  app.use("/terms", termsRoutes);
  app.use("/ai", aiRoutes);
  app.use("/activity", activityRoutes);

  // A trivial health endpoint so e2e smoke tests have something to assert
  // on without depending on any auth or DB state.
  app.get("/api/ping", (_req, res) => res.send("ponging"));

  return app;
}