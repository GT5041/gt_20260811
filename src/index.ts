#!/usr/bin/env node
import { main } from "./server.js";

main().catch((err) => {
  console.error("fatal error starting return-billing-mcp-server:", err);
  process.exit(1);
});
