import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const url = new URL(process.argv[2] ?? "http://127.0.0.1:3917/mcp");
const token = process.argv[3] ?? "test-secret-token";

const transport = new StreamableHTTPClientTransport(url, {
  requestInit: { headers: { Authorization: `Bearer ${token}` } },
});
const client = new Client({ name: "http-smoke-client", version: "1.0.0" });
await client.connect(transport);

const { tools } = await client.listTools();
console.log(
  "tools:",
  tools.map((t) => t.name),
);

const result = await client.callTool({
  name: "lookup_order",
  arguments: { user_id: "goshi.tanaka@protiviti.com" },
});
console.log("lookup_order isError:", result.isError);
console.log(result.content[0].text);

await client.close();
