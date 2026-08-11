import type { Order, User } from "./types.js";

export interface SentEmail {
  to: string;
  subject: string;
  body: string;
  sent_at: string;
}

// 実際の送信は行わず、プロセス内メモリにログを残すシミュレーション実装。
const sentEmails: SentEmail[] = [];

export function sendReturnNotification(
  user: User,
  order: Order,
  return_id: string,
  reason: string,
): SentEmail {
  const email: SentEmail = {
    to: user.user_id,
    subject: `【返品受付完了のお知らせ】注文番号 ${order.order_id}`,
    body: [
      `${user.name} 様`,
      "",
      "以下の注文について、返品を受け付けましたのでお知らせいたします。",
      "",
      `返品受付番号: ${return_id}`,
      `注文番号: ${order.order_id}`,
      `商品名: ${order.product_name} x${order.quantity}`,
      `注文日: ${order.order_date}`,
      `返品理由: ${reason}`,
      "",
      "今後の返金・返送手続きについては別途ご案内いたします。",
    ].join("\n"),
    sent_at: new Date().toISOString(),
  };
  sentEmails.push(email);
  return email;
}

export function listSentEmails(): SentEmail[] {
  return sentEmails;
}
