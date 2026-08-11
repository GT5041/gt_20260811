import { z } from "zod";
import { findUser, getOrdersForUser } from "../db.js";
import { Errors } from "../errors.js";

export const lookupOrderInputShape = {
  user_id: z.string().min(1).describe("ユーザーID（登録メールアドレス）"),
};

export const lookupOrderSchema = z.object(lookupOrderInputShape);

export function lookupOrder(input: z.infer<typeof lookupOrderSchema>) {
  const { user_id } = input;
  const user = findUser(user_id);
  if (!user) {
    throw Errors.userNotFound(user_id);
  }

  const orders = getOrdersForUser(user_id).map((o) => ({
    order_id: o.order_id,
    product_name: o.product_name,
    quantity: o.quantity,
    unit_price_jpy: o.unit_price_jpy,
    order_date: o.order_date,
    billing_status: o.billing_status,
    returned: o.returned,
  }));

  return {
    user: { user_id: user.user_id, name: user.name },
    order_count: orders.length,
    orders,
  };
}
