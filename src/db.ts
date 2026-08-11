import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { Order, OrderDb, User } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, "..", "data", "orders.json");

// ローカル JSON を「注文DB（+請求データ）」に見立てる。
// プロセス起動時に一度だけ読み込み、以降の返品処理はメモリ上の状態を更新する
// （このサンプルではプロセス終了とともに状態はリセットされる）。
const db: OrderDb = JSON.parse(readFileSync(DATA_PATH, "utf-8")) as OrderDb;

export const RETURN_WINDOW_MONTHS = 1;

export const BANK_TRANSFER_INFO = {
  company_name: "XX株式会社",
  bank_name: "〇〇銀行",
  branch_name: "××支店",
  account_type: "普通",
  account_number: "XXXXXXX",
} as const;

/** 動作確認用に「今日」を固定できるようにする（未設定時は実時刻を使用） */
export function getToday(): Date {
  const override = process.env.MCP_TODAY;
  if (override) {
    return new Date(`${override}T00:00:00`);
  }
  return new Date();
}

function normalizeUserId(user_id: string): string {
  return user_id.trim().toLowerCase();
}

export function findUser(user_id: string): User | undefined {
  const normalized = normalizeUserId(user_id);
  return db.users.find((u) => normalizeUserId(u.user_id) === normalized);
}

export function getOrdersForUser(user_id: string): Order[] {
  const normalized = normalizeUserId(user_id);
  return db.orders.filter((o) => normalizeUserId(o.user_id) === normalized);
}

export function getOrderById(order_id: string): Order | undefined {
  return db.orders.find((o) => o.order_id === order_id);
}

export function markOrderReturned(order_id: string): Order {
  const order = getOrderById(order_id);
  if (!order) {
    throw new Error(`order not found: ${order_id}`);
  }
  order.returned = true;
  return order;
}

/** 注文日から1ヶ月後の返品期限日を計算する */
export function computeReturnDeadline(order_date: string): Date {
  const d = new Date(`${order_date}T00:00:00`);
  const deadline = new Date(d);
  deadline.setMonth(deadline.getMonth() + RETURN_WINDOW_MONTHS);
  return deadline;
}

export function daysBetween(from: Date, to: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((to.getTime() - from.getTime()) / msPerDay);
}
