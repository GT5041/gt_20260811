import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverEntry = path.join(__dirname, "..", "dist", "index.js");

let client;

function parse(result) {
  assert.equal(result.content[0].type, "text");
  return JSON.parse(result.content[0].text);
}

before(async () => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverEntry],
    env: { ...process.env, MCP_TODAY: "2026-08-11" },
  });
  client = new Client({ name: "test-client", version: "1.0.0" });
  await client.connect(transport);
});

after(async () => {
  await client.close();
});

test("tools/list exposes the five expected tools", async () => {
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name).sort();
  assert.deepEqual(names, [
    "check_return_eligibility",
    "escalate_to_human",
    "get_billing_status",
    "lookup_order",
    "process_return",
  ]);
});

test("lookup_order returns orders for a known user", async () => {
  const result = await client.callTool({
    name: "lookup_order",
    arguments: { user_id: "goshi.tanaka@protiviti.com" },
  });
  const data = parse(result);
  assert.equal(result.isError, undefined);
  assert.equal(data.user.name, "Goshi Tanaka");
  assert.equal(data.order_count, 3);
});

test("lookup_order returns structured USER_NOT_FOUND error for unknown user", async () => {
  const result = await client.callTool({
    name: "lookup_order",
    arguments: { user_id: "nobody@example.com" },
  });
  assert.equal(result.isError, true);
  const data = parse(result);
  assert.equal(data.error.code, "USER_NOT_FOUND");
  assert.equal(data.error.category, "NOT_FOUND");
});

test("check_return_eligibility: within 1 month is eligible", async () => {
  // ORD-01-1 = Ami, order_date 2026-08-01, today overridden to 2026-08-11 (10 days)
  const result = await client.callTool({
    name: "check_return_eligibility",
    arguments: { order_id: "ORD-01-1" },
  });
  const data = parse(result);
  assert.equal(data.eligible, true);
  assert.equal(data.reason, "OK");
});

test("check_return_eligibility: over 1 month is not eligible", async () => {
  // ORD-01-3 = Ami, order_date 2026-06-01, today 2026-08-11 (> 1 month)
  const result = await client.callTool({
    name: "check_return_eligibility",
    arguments: { order_id: "ORD-01-3" },
  });
  const data = parse(result);
  assert.equal(data.eligible, false);
  assert.equal(data.reason, "EXPIRED");
});

test("check_return_eligibility: unknown order returns structured ORDER_NOT_FOUND error", async () => {
  const result = await client.callTool({
    name: "check_return_eligibility",
    arguments: { order_id: "ORD-99-9" },
  });
  assert.equal(result.isError, true);
  const data = parse(result);
  assert.equal(data.error.code, "ORDER_NOT_FOUND");
});

test("process_return succeeds for an eligible order and sends a notification email", async () => {
  const result = await client.callTool({
    name: "process_return",
    arguments: { order_id: "ORD-01-1", reason: "サイズが合わなかったため" },
  });
  assert.equal(result.isError, undefined);
  const data = parse(result);
  assert.ok(data.return_id.startsWith("RET-"));
  assert.equal(data.notification.to, "Ami.Muratsubaki@protiviti.com");
  assert.match(data.notification.subject, /返品受付完了/);
});

test("process_return fails with RETURN_NOT_ELIGIBLE for an already-returned order", async () => {
  const result = await client.callTool({
    name: "process_return",
    arguments: { order_id: "ORD-01-1", reason: "もう一度試したい" },
  });
  assert.equal(result.isError, true);
  const data = parse(result);
  assert.equal(data.error.code, "RETURN_NOT_ELIGIBLE");
  assert.equal(data.error.details.reason, "ALREADY_RETURNED");
});

test("process_return fails with RETURN_NOT_ELIGIBLE for an expired order", async () => {
  const result = await client.callTool({
    name: "process_return",
    arguments: { order_id: "ORD-01-3", reason: "気が変わった" },
  });
  assert.equal(result.isError, true);
  const data = parse(result);
  assert.equal(data.error.code, "RETURN_NOT_ELIGIBLE");
  assert.equal(data.error.details.reason, "EXPIRED");
});

test("get_billing_status lists orders with payment instructions for unpaid ones", async () => {
  const result = await client.callTool({
    name: "get_billing_status",
    arguments: { user_id: "Ami.Muratsubaki@protiviti.com" },
  });
  const data = parse(result);
  assert.equal(data.user.name, "Ami Muratsubaki");
  const unpaid = data.billing.filter((b) => b.billing_status === "unpaid");
  assert.ok(unpaid.length > 0);
  for (const b of unpaid) {
    assert.equal(b.payment_instructions.bank_name, "〇〇銀行");
    assert.equal(b.payment_instructions.account_number, "XXXXXXX");
  }
});

test("escalate_to_human tracks turn count and confirms close at turn 5, force closes at turn 10", async () => {
  const sessionId = "test-session-1";
  let lastStatus;
  for (let i = 1; i <= 10; i++) {
    const result = await client.callTool({
      name: "escalate_to_human",
      arguments: { session_id: sessionId, user_message: `質問その${i}` },
    });
    const data = parse(result);
    assert.equal(data.turn_count, i);
    lastStatus = data.status;
    if (i === 5) assert.equal(data.status, "confirm_close");
    if (i === 10) assert.equal(data.status, "force_closed");
  }
  assert.equal(lastStatus, "force_closed");

  // 11th call should now fail with SESSION_CLOSED
  const result = await client.callTool({
    name: "escalate_to_human",
    arguments: { session_id: sessionId, user_message: "まだ質問があります" },
  });
  assert.equal(result.isError, true);
  const data = parse(result);
  assert.equal(data.error.code, "SESSION_CLOSED");
});
