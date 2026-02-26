export type ContactType = "supplier" | "customer" | "both";

export interface Contact {
  id: string;
  type: ContactType;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  notes: string | null;
  created_at: string;
}

export interface ContactInsert {
  type: ContactType;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  notes?: string | null;
}

export interface ContactUpdate extends Partial<ContactInsert> {}

export interface Account {
  id: string;
  contact_id: string;
  balance: number;
  total_debit: number;
  total_credit: number;
  created_at: string;
}

export interface FeedType {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export interface FeedTypeInsert {
  name: string;
  description?: string | null;
  is_active?: boolean;
}

export interface FeedTypeUpdate extends Partial<FeedTypeInsert> {}

export interface Warehouse {
  id: string;
  name: string;
  location: string | null;
  capacity: number | null;
  is_active: boolean;
  created_at: string;
}

export interface WarehouseInsert {
  name: string;
  location?: string | null;
  capacity?: number | null;
  is_active?: boolean;
}

export interface WarehouseUpdate extends Partial<WarehouseInsert> {}

// --- Delivery (Kantar Fişi / Sevkiyat) ---

export type FreightPayer = "customer" | "me" | "supplier";
export type PricingModel = "nakliye_dahil" | "tir_ustu";

export interface Delivery {
  id: string;
  sale_id: string | null;
  purchase_id: string | null;
  delivery_date: string;
  ticket_no: string | null;
  gross_weight: number | null;
  tare_weight: number | null;
  net_weight: number;
  vehicle_plate: string | null;
  driver_name: string | null;
  carrier_name: string | null;
  carrier_phone: string | null;
  freight_cost: number | null;
  freight_payer: FreightPayer | null;
  notes: string | null;
  created_at: string;
}

export interface DeliveryInsert {
  sale_id?: string | null;
  purchase_id?: string | null;
  delivery_date: string;
  ticket_no?: string | null;
  gross_weight?: number | null;
  tare_weight?: number | null;
  net_weight: number;
  vehicle_plate?: string | null;
  driver_name?: string | null;
  carrier_name?: string | null;
  carrier_phone?: string | null;
  freight_cost?: number | null;
  freight_payer?: FreightPayer | null;
  notes?: string | null;
}

export interface DeliveryUpdate extends Partial<DeliveryInsert> {}

// --- Purchases ---

export type PurchaseStatus = "draft" | "confirmed" | "delivered" | "cancelled";

export interface Purchase {
  id: string;
  purchase_no: string;
  contact_id: string;
  feed_type_id: string;
  warehouse_id: string | null;
  quantity: number;
  unit: string;
  unit_price: number;
  total_amount: number;
  status: PurchaseStatus;
  purchase_date: string;
  due_date: string | null;
  pricing_model: PricingModel | null;
  notes: string | null;
  created_at: string;
  // joined
  contact?: Contact;
  feed_type?: FeedType;
  warehouse?: Warehouse;
}

export interface PurchaseInsert {
  contact_id: string;
  feed_type_id: string;
  warehouse_id?: string | null;
  quantity: number;
  unit?: string;
  unit_price: number;
  status?: PurchaseStatus;
  purchase_date: string;
  due_date?: string | null;
  pricing_model?: PricingModel | null;
  notes?: string | null;
}

export interface PurchaseUpdate extends Partial<PurchaseInsert> {}

// --- Sales ---

export type SaleStatus = "draft" | "confirmed" | "delivered" | "cancelled";

export interface Sale {
  id: string;
  sale_no: string;
  contact_id: string;
  feed_type_id: string;
  warehouse_id: string | null;
  quantity: number;
  unit: string;
  unit_price: number;
  total_amount: number;
  delivered_quantity: number;
  is_freight_deducted: boolean;
  status: SaleStatus;
  sale_date: string;
  due_date: string | null;
  notes: string | null;
  created_at: string;
  // joined
  contact?: Contact;
  feed_type?: FeedType;
  warehouse?: Warehouse;
}

export interface SaleInsert {
  contact_id: string;
  feed_type_id: string;
  warehouse_id?: string | null;
  quantity: number;
  unit?: string;
  unit_price: number;
  status?: SaleStatus;
  sale_date: string;
  due_date?: string | null;
  notes?: string | null;
}

export interface SaleUpdate extends Partial<SaleInsert> {}

// --- Account Transactions ---

export type TransactionDirection = "debit" | "credit";

export interface AccountTransaction {
  id: string;
  account_id: string;
  type: TransactionDirection;
  amount: number;
  balance_after: number;
  description: string | null;
  reference_type: string | null;
  reference_id: string | null;
  transaction_date: string;
  created_at: string;
}

// --- Account Summary (v_account_summary view) ---

export interface AccountSummary {
  account_id: string;
  contact_id: string;
  contact_name: string;
  contact_type: ContactType;
  balance: number;
  total_debit: number;
  total_credit: number;
}

// --- Payments ---

export type PaymentDirection = "inbound" | "outbound";
export type PaymentMethod = "cash" | "bank_transfer" | "check" | "promissory_note";

export interface Payment {
  id: string;
  contact_id: string;
  account_id: string;
  direction: PaymentDirection;
  method: PaymentMethod;
  amount: number;
  payment_date: string;
  description: string | null;
  reference_type: string | null;
  reference_id: string | null;
  created_at: string;
  // joined
  contact?: Contact;
}

export interface PaymentInsert {
  contact_id: string;
  account_id: string;
  direction: PaymentDirection;
  method: PaymentMethod;
  amount: number;
  payment_date: string;
  description?: string | null;
  reference_type?: string | null;
  reference_id?: string | null;
}

export interface PaymentUpdate extends Partial<PaymentInsert> {}

// --- Checks (Çek / Senet) ---

export type CheckType = "check" | "promissory_note";
export type CheckDirection = "received" | "given";
export type CheckStatus = "pending" | "deposited" | "cleared" | "bounced" | "endorsed" | "cancelled";

export interface Check {
  id: string;
  contact_id: string;
  check_type: CheckType;
  direction: CheckDirection;
  check_no: string | null;
  bank_name: string | null;
  branch_name: string | null;
  amount: number;
  issue_date: string;
  due_date: string;
  status: CheckStatus;
  endorsed_to: string | null;
  notes: string | null;
  created_at: string;
  // joined
  contact?: Contact;
}

export interface CheckInsert {
  contact_id: string;
  check_type: CheckType;
  direction: CheckDirection;
  check_no?: string | null;
  bank_name?: string | null;
  branch_name?: string | null;
  amount: number;
  issue_date: string;
  due_date: string;
  status?: CheckStatus;
  endorsed_to?: string | null;
  notes?: string | null;
}

export interface CheckUpdate extends Partial<CheckInsert> {}

// --- Due Items (vade takvimi) ---

export interface DueItem {
  id: string;
  type: "payment" | "check";
  contact_name: string;
  amount: number;
  due_date: string;
  status: string;
  description: string | null;
}

// --- Inventory ---

export interface InventorySummary {
  id: string;
  warehouse_id: string;
  feed_type_id: string;
  warehouse_name: string;
  feed_type_name: string;
  quantity_kg: number;
  unit_cost: number;
  total_value: number;
  last_updated: string;
}

export type MovementType = "purchase_in" | "sale_out" | "adjustment" | "return";

export interface InventoryMovement {
  id: string;
  inventory_id: string;
  movement_type: MovementType;
  quantity_change: number;
  unit_cost: number;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  created_at: string;
}

// --- Dashboard ---

export interface MonthlyData {
  month: string;
  purchases: number;
  sales: number;
}
