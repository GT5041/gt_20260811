import { randomUUID, timingSafeEqual } from "node:crypto";
import express, { type NextFunction, type Request, type Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createServer } from "./server.js";

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? "0.0.0.0";
const AUTH_TOKEN = process.env.MCP_HTTP_TOKEN;

if (!AUTH_TOKEN) {
  console.error(
    "MCP_HTTP_TOKEN が未設定です。外部公開する場合に認証なしで起動しないよう、" +
      "起動を中止しました。環境変数 MCP_HTTP_TOKEN に固定トークンを設定してください。",
  );
  process.exit(1);
}

interface Session {
  server: McpServer;
  transport: StreamableHTTPServerTransport;
}

// セッションIDごとに McpServer/Transport のペアを保持する（プロセス内メモリ）。
// 複数インスタンスにスケールする場合は外部ストアへの置き換えが必要。
const sessions = new Map<string, Session>();

function checkAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.header("authorization") ?? "";
  const expected = `Bearer ${AUTH_TOKEN}`;
  const headerBuf = Buffer.from(header);
  const expectedBuf = Buffer.from(expected);
  const valid =
    headerBuf.length === expectedBuf.length && timingSafeEqual(headerBuf, expectedBuf);

  if (!valid) {
    res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        category: "VALIDATION",
        message: "認証に失敗しました。'Authorization: Bearer <token>' ヘッダーを指定してください。",
        details: null,
      },
    });
    return;
  }
  next();
}

async function handleSessionRequest(req: Request, res: Response): Promise<void> {
  const sessionId = req.header("mcp-session-id");
  const session = sessionId ? sessions.get(sessionId) : undefined;
  if (!session) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }
  await session.transport.handleRequest(req, res);
}

const app = express();
app.use(express.json());

// ヘルスチェックは認証不要（デプロイ先のロードバランサ等からの疑通確認用）
app.get("/healthz", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.post("/mcp", checkAuth, async (req, res) => {
  const sessionIdHeader = req.header("mcp-session-id");
  const existing = sessionIdHeader ? sessions.get(sessionIdHeader) : undefined;

  if (existing) {
    await existing.transport.handleRequest(req, res, req.body);
    return;
  }

  if (!isInitializeRequest(req.body)) {
    res.status(400).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Bad Request: No valid session ID provided" },
      id: null,
    });
    return;
  }

  const server = createServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (sessionId) => {
      sessions.set(sessionId, { server, transport });
    },
  });

  transport.onclose = () => {
    if (transport.sessionId) sessions.delete(transport.sessionId);
  };

  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.get("/mcp", checkAuth, handleSessionRequest);
app.delete("/mcp", checkAuth, handleSessionRequest);

app.listen(PORT, HOST, () => {
  console.log(`return-billing-mcp-server (Streamable HTTP) listening on http://${HOST}:${PORT}/mcp`);
});
