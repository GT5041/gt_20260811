// ダミー注文データ生成スクリプト（一度きりの実行用）
import { writeFileSync } from "node:fs";

const users = [
  { user_id: "Ami.Muratsubaki@protiviti.com", name: "Ami Muratsubaki" },
  { user_id: "goshi.tanaka@protiviti.com", name: "Goshi Tanaka" },
  { user_id: "takeharu.mokudai@protiviti.com", name: "Takeharu Mokudai" },
  { user_id: "amigo.murata@protiviti.com", name: "Amigo Murata" },
  { user_id: "takehiro.mokujai@protiviti.com", name: "Mokujyai Takehiro" },
];

const products = [
  { code: "COKE500", name: "コカ・コーラ(500ml) 12本入りパック", unit_price_jpy: 1800 },
  { code: "SOKENBI350", name: "爽健美茶(350ml) 24本入りパック", unit_price_jpy: 2400 },
  { code: "GYUDON18", name: "吉野家牛丼お得パック 18個入り", unit_price_jpy: 5400 },
];

const orderDates = ["2026-08-01", "2026-07-01", "2026-06-01"];

const orders = [];
users.forEach((u, i) => {
  orderDates.forEach((date, d) => {
    const product = products[(i + d) % 3];
    const billing_status = (i + d) % 2 === 0 ? "unpaid" : "paid";
    orders.push({
      order_id: `ORD-${String(i + 1).padStart(2, "0")}-${d + 1}`,
      user_id: u.user_id,
      product_code: product.code,
      product_name: product.name,
      quantity: 1,
      unit_price_jpy: product.unit_price_jpy,
      order_date: date,
      billing_status,
      returned: false,
    });
  });
});

const data = { users, products, orders };
writeFileSync(new URL("../data/orders.json", import.meta.url), JSON.stringify(data, null, 2) + "\n");
console.log(`generated ${orders.length} orders`);
