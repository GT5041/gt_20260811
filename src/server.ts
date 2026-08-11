import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { toAppError } from "./errors.js";
import { lookupOrder, lookupOrderInputShape } from "./tools/lookupOrder.js";
import {
  checkReturnEligibility,
  checkReturnEligibilityInputShape,
} from "./tools/checkReturnEligibility.js";
import { processReturn, processReturnInputShape } from "./tools/processReturn.js";
import { getBillingStatus, getBillingStatusInputShape } from "./tools/getBillingStatus.js";
import { escalateToHuman, escalateToHumanInputShape } from "./tools/escalateToHuman.js";

function ok(data: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

function fail(err: unknown): CallToolResult {
  const appError = toAppError(err);
  return {
    content: [{ type: "text", text: JSON.stringify(appError.toStructured(), null, 2) }],
    isError: true,
  };
}

/** ハンドラを try/catch でラップし、例外を構造化エラー応答に変換する */
function wrap<TInput>(fn: (input: TInput) => unknown) {
  return async (input: TInput): Promise<CallToolResult> => {
    try {
      return ok(fn(input));
    } catch (err) {
      return fail(err);
    }
  };
}

export function createServer(): McpServer {
  const server = new McpServer({
    name: "return-billing-mcp-server",
    version: "1.0.0",
    description:
      "ローカル JSON の注文・請求ダミーデータを用いた、返品・請求問い合わせ振り分けMCPサーバー",
  });

  server.registerTool(
    "lookup_order",
    {
      title: "注文照会",
      description:
        "ユーザーID（メールアドレス）から、そのユーザーの注文一覧（商品名・数量・注文日・請求ステータス）を取得する。" +
        "問い合わせ対応の最初のステップとして、ユーザー本人確認を側ねて呼び出す。",
      inputSchema: lookupOrderInputShape,
    },
    wrap(lookupOrder),
  );

  server.registerTool(
    "check_return_eligibility",
    {
      title: "返品可否判定",
      description:
        "注文IDを指定し、注文日から1ヶ月以内かどうかに基づいて返品可能かどうかを判定する。" +
        "返品期限超過・返品済みの場合も「エラー」ではなく eligible=false の正常応答として返す。",
      inputSchema: checkReturnEligibilityInputShape,
    },
    wrap(checkReturnEligibility),
  );

  server.registerTool(
    "process_return",
    {
      title: "返品処理実行",
      description:
        "check_return_eligibility で返品可能と判定された注文について、返品理由を受け取り返品処理を確定する。" +
        "処理完了後、ユーザーの登録メールアドレス宛てに返品受付通知メールを送信する（本サンプルでは送信をシミュレートする）。" +
        "返品不可の注文に対して呼び出された場合は RETURN_NOT_ELIGIBLE エラーを返す。",
      inputSchema: processReturnInputShape,
    },
    wrap(processReturn),
  );

  server.registerTool(
    "get_billing_status",
    {
      title: "請求状況照会",
      description:
        "ユーザーID（メールアドレス）から、そのユーザーの全注文の請求ステータス（未払い/支払い済み）一覧を取得する。" +
        "未払いの注文には振込先情報（payment_instructions）が付与される。",
      inputSchema: getBillingStatusInputShape,
    },
    wrap(getBillingStatus),
  );

  server.registerTool(
    "escalate_to_human",
    {
      title: "有人オペレーターへのエスカレーション",
      description:
        "返品にも請求にも該当しない問い合わせについて、有人オペレーターとの会話セッションを管理する。" +
        "ユーザーの発言1回ごとに呼び出すこと。ターン数をサーバー側で管理し、5ターンで終了確認、" +
        "10ターンで強制終了（別問い合わせの起票を依頼）という状態を status フィールドで返す。" +
        "オペレーターの回答文自体はこのツールでは生成しないため、呼び出し側のエージェントが" +
        "一般的なオペレーターとして応答内容を作成すること。",
      inputSchema: escalateToHumanInputShape,
    },
    wrap(escalateToHuman),
  );

  return server;
}

export async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
