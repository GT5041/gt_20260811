import { z } from "zod";
import { advanceTurn, isClosed } from "../escalation.js";
import { Errors } from "../errors.js";

export const escalateToHumanInputShape = {
  session_id: z
    .string()
    .min(1)
    .describe("エスカレーション会話を識別するセッションID（会話ごとに固定の値を渡すこと）"),
  user_message: z.string().min(1).describe("ユーザーからの直近の発言内容"),
};

export const escalateToHumanSchema = z.object(escalateToHumanInputShape);

/**
 * 返品・請求のいずれにも該当しない問い合わせをオペレーターに引き継ぐ際、
 * 呼び出し側エージェントが「1ユーザー発言ごとに1回」呼び出すことを想定したツール。
 * ターン数の管理とクローズ判定のみを行い、オペレーターの回答文自体は生成しない
 * （呼び出し側の LLM が一般的なオペレーターとして応答を作成すること）。
 */
export function escalateToHuman(input: z.infer<typeof escalateToHumanSchema>) {
  const { session_id, user_message } = input;

  if (isClosed(session_id)) {
    throw Errors.sessionClosed(session_id);
  }

  const result = advanceTurn(session_id);

  return {
    ...result,
    received_message: user_message,
  };
}
