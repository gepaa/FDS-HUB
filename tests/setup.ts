import path from "node:path";

/**
 * Environment for the test process.
 *
 * Set BEFORE any application module is imported: src/lib/env.ts parses
 * process.env at import time, and src/lib/prisma.ts picks its driver
 * adapter from DATABASE_URL the first time it is required.
 */
process.env.DATABASE_URL = `file:${path.resolve(__dirname, "test.db")}`;
process.env.QUO_INTEGRATION_ENABLED = "true";
process.env.QUO_API_KEY = "test-api-key";
// "whsec_" + base64("test-webhook-secret-value-0123456789")
process.env.QUO_WEBHOOK_SECRET =
  "whsec_dGVzdC13ZWJob29rLXNlY3JldC12YWx1ZS0wMTIzNDU2Nzg5";
process.env.QUO_DEFAULT_REGION = "US";
// Lets tests act as the agent (Authorization: Bearer …) and prove the
// boundaries that separate it from a human — see todo-api.test.ts.
process.env.AGENT_API_KEY = "test-agent-key";
// The AI pass is exercised through its own unit tests with a stubbed
// provider; integration tests must never reach for a model.
process.env.QUO_AI_EXTRACTION_ENABLED = "false";
