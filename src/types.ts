export interface User {
  user_id: string;
  name: string;
}

export interface Product {
  code: string;
  name: string;
  unit_price_jpy: number;
}

export type BillingStatus = "paid" | "unpaid";

export interface Order {
  order_id: string;
  user_id: string;
  product_code: string;
  product_name: string;
  quantity: number;
  unit_price_jpy: number;
  order_date: string; // YYYY-MM-DD
  billing_status: BillingStatus;
  returned: boolean;
}

export interface OrderDb {
  users: User[];
  products: Product[];
  orders: Order[];
}
