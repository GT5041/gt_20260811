import { randomUUID } from "node:crypto";
import { z } from "zod";
import { findUser, getOrderById, markOrderReturned } from "../db.js";
import { Errors } from "../errors.js";
import { evaluateEligibility } from "../returnEligibility.js";
import { sendReturnNotification } from "../mail.js";

export const processReturnInputShape = {
  order_id: z.string().min(1).describe("返品対象の注文ID"),
  reason: z.string().min(1).describe("返品理由（ユーザーからの聴き取り内容）"),
};

export const processReturnSchema = z.object(processReturnInputShape);

export function processReturn(input: z.infer<typeof processReturnSchema>) {
  const { order_id, reason } = input;

  const order = getOrderById(order_id);
  if (!order) {
    throw Errors.orderNotFound(order_id);
  }

  // check_return_eligibility を経ずに直接呼ばれる場合に備え、サーバー側でも再検証する
  const eligibility = evaluateEligibility(order);
  if (!eligibility.eligible) {
    throw Errors.returnNotEligible(
      order_id,
      eligibility.reason === "ALREADY_RETURNED" ? "ALREADY_RETURNED" : "EXPIRED",
      eligibility.message,
    );
  }

  const user = findUser(order.user_id);
  if (!user) {
    // データ不整合（本来は起こり得ない）
    throw Errors.internal(`order ${order_id} references unknown user ${order.user_id}`);
  }

  markOrderReturned(order_id);
  const return_id = `RET-${randomUUID().slice(0, 8).toUpperCase()}`;
  const email = sendReturnNotification(user, order, return_id, reason);

  return {
    return_id,
    order_id,
    reason,
    processed_at: new Date().toISOString(),
    notification: email,
  };
}
