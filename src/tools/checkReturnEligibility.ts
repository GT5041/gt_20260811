import { z } from "zod";
import { getOrderById } from "../db.js";
import { Errors } from "../errors.js";
import { evaluateEligibility } from "../returnEligibility.js";

export const checkReturnEligibilityInputShape = {
  order_id: z.string().min(1).describe("注文ID（例: ORD-01-1）"),
};

export const checkReturnEligibilitySchema = z.object(checkReturnEligibilityInputShape);

export function checkReturnEligibility(
  input: z.infer<typeof checkReturnEligibilitySchema>,
) {
  const { order_id } = input;
  const order = getOrderById(order_id);
  if (!order) {
    throw Errors.orderNotFound(order_id);
  }

  return evaluateEligibility(order);
}
