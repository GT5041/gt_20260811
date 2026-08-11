import { computeReturnDeadline, daysBetween, getToday } from "./db.js";
import type { Order } from "./types.js";

export interface EligibilityResult {
  order_id: string;
  order_date: string;
  deadline_date: string;
  days_elapsed: number;
  already_returned: boolean;
  eligible: boolean;
  reason: "OK" | "EXPIRED" | "ALREADY_RETURNED";
  message: string;
}

/** 「注文日から1ヶ月以内」の返品可否をチェックする（正常系のビジネス判定であり、エラーではない） */
export function evaluateEligibility(order: Order): EligibilityResult {
  const today = getToday();
  const deadline = computeReturnDeadline(order.order_date);
  const days_elapsed = daysBetween(new Date(`${order.order_date}T00:00:00`), today);
  const within_window = today.getTime() <= deadline.getTime();

  if (order.returned) {
    return {
      order_id: order.order_id,
      order_date: order.order_date,
      deadline_date: deadline.toISOString().slice(0, 10),
      days_elapsed,
      already_returned: true,
      eligible: false,
      reason: "ALREADY_RETURNED",
      message: "この注文はすでに返品処理済みです。",
    };
  }

  if (!within_window) {
    return {
      order_id: order.order_id,
      order_date: order.order_date,
      deadline_date: deadline.toISOString().slice(0, 10),
      days_elapsed,
      already_returned: false,
      eligible: false,
      reason: "EXPIRED",
      message: `注文日（${order.order_date}）から1ヶ月の返品受付期間を過ぎているため、返品を承ることができません。`,
    };
  }

  return {
    order_id: order.order_id,
    order_date: order.order_date,
    deadline_date: deadline.toISOString().slice(0, 10),
    days_elapsed,
    already_returned: false,
    eligible: true,
    reason: "OK",
    message: "返品受付期間内のため、返品を承ることが可能です。",
  };
}
