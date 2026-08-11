/**
 * 構造化エラー応答の共通基盤。
 *
 * MCP のツール呼び出しは「呼び出しは成功したがビジネス上の異常系」を表現する必要がある。
 * ここでは例外を投げっぺなしにせず、code / category / message / details を持つ
 * 一貫した JSON 形式に変換してツール結果（isError: true）として返すことで、
 * 呼び出し側エージェントがエラー種別ごとに分岐しやすくする。
 */

export type ErrorCategory =
  | "NOT_FOUND" // 対象データが存在しない
  | "VALIDATION" // 入力値が不正
  | "BUSINESS_RULE" // 業務ルール上、要求を実行できない（正常系の一部だがエラー扱いする操作のみ）
  | "STATE_CONFLICT" // 現在の状態と矛盾する要求（二重処理・クローズ済みセッション等）
  | "INTERNAL"; // 想定外の内部エラー

export interface StructuredError {
  error: {
    code: string;
    category: ErrorCategory;
    message: string;
    details: Record<string, unknown> | null;
  };
}

export class AppError extends Error {
  readonly code: string;
  readonly category: ErrorCategory;
  readonly details?: Record<string, unknown>;

  constructor(
    code: string,
    category: ErrorCategory,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.category = category;
    this.details = details;
  }

  toStructured(): StructuredError {
    return {
      error: {
        code: this.code,
        category: this.category,
        message: this.message,
        details: this.details ?? null,
      },
    };
  }
}

export const Errors = {
  userNotFound(user_id: string): AppError {
    return new AppError(
      "USER_NOT_FOUND",
      "NOT_FOUND",
      `ユーザーID「${user_id}」に該当する顧客情報が見つかりませんでした。メールアドレスに誤りがないかご確認ください。`,
      { user_id },
    );
  },

  orderNotFound(order_id: string): AppError {
    return new AppError(
      "ORDER_NOT_FOUND",
      "NOT_FOUND",
      `注文ID「${order_id}」に該当する注文が見つかりませんでした。`,
      { order_id },
    );
  },

  invalidInput(message: string, details?: Record<string, unknown>): AppError {
    return new AppError("INVALID_INPUT", "VALIDATION", message, details);
  },

  returnNotEligible(
    order_id: string,
    reason: "EXPIRED" | "ALREADY_RETURNED",
    detailMessage: string,
  ): AppError {
    return new AppError("RETURN_NOT_ELIGIBLE", "BUSINESS_RULE", detailMessage, {
      order_id,
      reason,
    });
  },

  sessionClosed(session_id: string): AppError {
    return new AppError(
      "SESSION_CLOSED",
      "STATE_CONFLICT",
      "このオペレーター問い合わせセッションはターン数の上限に達したため終了済みです。恐れ入りますが、新しい問い合わせを起票してください。",
      { session_id },
    );
  },

  internal(message: string): AppError {
    return new AppError("INTERNAL_ERROR", "INTERNAL", message);
  },
};

/** unknown な例外を AppError に正規化する */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  const message = err instanceof Error ? err.message : String(err);
  return Errors.internal(message);
}
