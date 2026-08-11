import { z } from "zod";
import { BANK_TRANSFER_INFO, findUser, getOrdersForUser } from "../db.js";
import { Errors } from "../errors.js";

export const getBillingStatusInputShape = {
  user_id: z.string().min(1).describe("ユーザーID（登録メールアドレス）"),
};

export const getBillingStatusSchema = z.object(getBillingStatusInputShape);

export function getBillingStatus(input: z.infer<typeof getBillingStatusSchema>) {
  const { user_id } = input;
  const user = findUser(user_id);
  if (!user) {
    throw Errors.userNotFound(user_id);
  }

  const orders = getOrdersForUser(user_id);
  const billing = orders.map((o) => ({
    order_id: o.order_id,
    product_name: o.product_name,
    order_date: o.order_date,
    amount_jpy: o.unit_price_jpy * o.quantity,
    billing_status: o.billing_status,
    payment_instructions:
      o.billing_status === "unpaid"
        ? {
            ...BANK_TRANSFER_INFO,
            amount_jpy: o.unit_price_jpy * o.quantity,
            note: `お振込みの際は、注文番号「${o.order_id}」を分かるようにご連絡ください。`,
          }
        : null,
  }));

  const unpaid_count = billing.filter((b) => b.billing_status === "unpaid").length;

  return {
    user: { user_id: user.user_id, name: user.name },
    unpaid_count,
    billing,
  };
}
