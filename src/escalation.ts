/**
 * 有人オペレーターへのエスカレーション・セッション管理。
 *
 * MCP ツールは LLM を直接呼び出せないため、オペレーターとしての回答文そのものは
 * このモジュールでは生成しない（呼び出し側のエージェントが生成する）。ここではターン数の
 * カウントと、5ターン/10ターンのビジネスルールに基づく状態遷移のみを管理する。
 */

export type EscalationStatus = "active" | "confirm_close" | "force_closed";

export interface EscalationSession {
  session_id: string;
  turn_count: number;
  closed: boolean;
}

const sessions = new Map<string, EscalationSession>();

export const CONFIRM_CLOSE_AT_TURN = 5;
export const FORCE_CLOSE_AT_TURN = 10;

export function getOrCreateSession(session_id: string): EscalationSession {
  let session = sessions.get(session_id);
  if (!session) {
    session = { session_id, turn_count: 0, closed: false };
    sessions.set(session_id, session);
  }
  return session;
}

export interface AdvanceResult {
  session_id: string;
  turn_count: number;
  status: EscalationStatus;
  guidance: string;
}

export function advanceTurn(session_id: string): AdvanceResult {
  const session = getOrCreateSession(session_id);
  session.turn_count += 1;

  if (session.turn_count >= FORCE_CLOSE_AT_TURN) {
    session.closed = true;
    return {
      session_id,
      turn_count: session.turn_count,
      status: "force_closed",
      guidance:
        "オペレーターとの会話が10ターンに達しました。このセッションは強制的に終了します。" +
        "ユーザーには、引き続きサポートが必要な場合は新しい問い合わせを起票するようご案内してください。",
    };
  }

  if (session.turn_count === CONFIRM_CLOSE_AT_TURN) {
    return {
      session_id,
      turn_count: session.turn_count,
      status: "confirm_close",
      guidance:
        "オペレーターとの会話が5ターンに達しました。ユーザーにこの問い合わせを終了してよいか確認してください。" +
        "継続を希望する場合はそのまま会話を続けられますが、10ターンに達すると自動的に終了します。",
    };
  }

  return {
    session_id,
    turn_count: session.turn_count,
    status: "active",
    guidance:
      "一般的なオペレーターとして、ユーザーの質問に対しできる範囲で回答してください（この回答文自体はツールでは生成されません）。",
  };
}

export function isClosed(session_id: string): boolean {
  return sessions.get(session_id)?.closed ?? false;
}
