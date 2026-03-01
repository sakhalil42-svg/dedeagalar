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
  credit_limit: number | null;
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
  credit_limit?: number | null;
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
export type DeliveryStatus = "in_transit" | "delivered";

export interface Delivery {
  id: string;
  sale_id: string | null;
  purchase_id: string | null;
  parcel_id: string | null;
  bale_count: number | null;
  delivery_date: string;
  ticket_no: string | null;
  gross_weight: number | null;
  tare_weight: number | null;
  net_weight: number;
  vehicle_plate: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  carrier_name: string | null;
  carrier_phone: string | null;
  freight_cost: number | null;
  freight_payer: FreightPayer | null;
  status: DeliveryStatus;
  notes: string | null;
  season_id: string | null;
  created_at: string;
}

export interface DeliveryInsert {
  sale_id?: string | null;
  purchase_id?: string | null;
  parcel_id?: string | null;
  bale_count?: number | null;
  delivery_date: string;
  ticket_no?: string | null;
  gross_weight?: number | null;
  tare_weight?: number | null;
  net_weight: number;
  vehicle_plate?: string | null;
  driver_name?: string | null;
  driver_phone?: string | null;
  carrier_name?: string | null;
  carrier_phone?: string | null;
  freight_cost?: number | null;
  freight_payer?: FreightPayer | null;
  status?: DeliveryStatus;
  notes?: string | null;
  season_id?: string | null;
}

export interface DeliveryUpdate extends Partial<DeliveryInsert> {}

// --- Purchases ---

export type PurchaseStatus = "pending" | "draft" | "confirmed" | "delivered" | "cancelled";

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
  purchase_no?: string;
  contact_id: string;
  feed_type_id: string;
  warehouse_id?: string | null;
  quantity: number;
  unit?: string;
  unit_price: number;
  total_amount?: number;
  status?: PurchaseStatus;
  purchase_date: string;
  due_date?: string | null;
  pricing_model?: PricingModel | null;
  notes?: string | null;
}

export interface PurchaseUpdate extends Partial<PurchaseInsert> {}

// --- Sales ---

export type SaleStatus = "pending" | "draft" | "confirmed" | "delivered" | "cancelled";

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
  season_id: string | null;
  notes: string | null;
  created_at: string;
  // joined
  contact?: Contact;
  feed_type?: FeedType;
  warehouse?: Warehouse;
}

export interface SaleInsert {
  sale_no?: string;
  contact_id: string;
  feed_type_id: string;
  warehouse_id?: string | null;
  quantity: number;
  unit?: string;
  unit_price: number;
  total_amount?: number;
  status?: SaleStatus;
  sale_date: string;
  due_date?: string | null;
  notes?: string | null;
  season_id?: string | null;
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
  season_id: string | null;
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
  payment_id: string | null;
  contact_id: string;
  type: CheckType;
  direction: CheckDirection;
  serial_no: string | null;
  bank_name: string | null;
  branch: string | null;
  amount: number;
  issue_date: string;
  due_date: string;
  status: CheckStatus;
  endorsed_to: string | null;
  season_id: string | null;
  notes: string | null;
  created_at: string;
  // joined
  contact?: Contact;
}

export interface CheckInsert {
  payment_id?: string | null;
  contact_id: string;
  type: CheckType;
  direction: CheckDirection;
  serial_no?: string | null;
  bank_name?: string | null;
  branch?: string | null;
  amount: number;
  issue_date: string;
  due_date: string;
  status?: CheckStatus;
  endorsed_to?: string | null;
  notes?: string | null;
  season_id?: string | null;
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

// --- Carriers (Nakliyeciler) ---

export interface Carrier {
  id: string;
  name: string;
  phone: string | null;
  phone2: string | null;
  city: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

export interface CarrierInsert {
  name: string;
  phone?: string | null;
  phone2?: string | null;
  city?: string | null;
  notes?: string | null;
  is_active?: boolean;
}

export interface CarrierUpdate extends Partial<CarrierInsert> {}

// --- Vehicles (Araçlar) ---

export type VehicleType = "tir" | "kamyon" | "romorsk";

export interface Vehicle {
  id: string;
  plate: string;
  carrier_id: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  vehicle_type: string;
  capacity_ton: number | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  // joined
  carrier?: Carrier;
}

export interface VehicleInsert {
  plate: string;
  carrier_id?: string | null;
  driver_name?: string | null;
  driver_phone?: string | null;
  vehicle_type?: string;
  capacity_ton?: number | null;
  notes?: string | null;
  is_active?: boolean;
}

export interface VehicleUpdate extends Partial<VehicleInsert> {}

// --- Carrier Transactions ---

export type CarrierTxType = "freight_charge" | "payment";

export interface CarrierTransaction {
  id: string;
  carrier_id: string;
  type: CarrierTxType;
  amount: number;
  description: string | null;
  reference_id: string | null;
  transaction_date: string;
  season_id: string | null;
  payment_method: string | null;
  created_at: string;
}

export interface CarrierTransactionInsert {
  carrier_id: string;
  type: CarrierTxType;
  amount: number;
  description?: string | null;
  reference_id?: string | null;
  transaction_date?: string;
  payment_method?: string | null;
  season_id?: string | null;
}

export interface CarrierBalance {
  id: string;
  name: string;
  phone: string | null;
  total_freight: number;
  total_paid: number;
  balance: number;
}

// --- Seasons ---

export interface Season {
  id: string;
  name: string;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
}

export interface SeasonInsert {
  name: string;
  start_date?: string;
  end_date?: string | null;
  is_active?: boolean;
  notes?: string | null;
}

export interface SeasonUpdate extends Partial<SeasonInsert> {}

// --- Parcels (Tarla/Parsel) ---

export type ParcelStatus = "active" | "baling" | "completed" | "cancelled";
export type ParcelPaymentType = "per_dekar" | "per_bale";
export type BalingProvider = "own" | "contractor";
export type CropType = "bugday_sapi" | "arpa_sapi";

export interface Parcel {
  id: string;
  contact_id: string;
  parcel_name: string;
  city: string | null;
  district: string | null;
  village: string | null;
  region: string | null;
  crop_type: CropType;
  feed_type_id: string | null;
  area_dekar: number | null;

  payment_type: ParcelPaymentType;
  price_per_dekar: number | null;
  price_per_bale: number | null;
  owner_total_cost: number;

  baling_provider: BalingProvider;
  contractor_id: string | null;
  contractor_cost_per_bale: number | null;
  baling_date: string | null;

  total_bales: number;
  shipped_bales: number;
  remaining_bales: number;

  storage_location: string | null;
  warehouse_id: string | null;

  status: ParcelStatus;
  season_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;

  // joined
  contact?: Contact;
  feed_type?: FeedType;
  contractor?: Contact;
  warehouse?: Warehouse;
}

export interface ParcelInsert {
  contact_id: string;
  parcel_name: string;
  city?: string | null;
  district?: string | null;
  village?: string | null;
  region?: string | null;
  crop_type?: CropType;
  feed_type_id?: string | null;
  area_dekar?: number | null;

  payment_type?: ParcelPaymentType;
  price_per_dekar?: number | null;
  price_per_bale?: number | null;

  baling_provider?: BalingProvider;
  contractor_id?: string | null;
  contractor_cost_per_bale?: number | null;
  baling_date?: string | null;

  total_bales?: number;

  storage_location?: string | null;
  warehouse_id?: string | null;

  status?: ParcelStatus;
  season_id?: string | null;
  notes?: string | null;
}

export interface ParcelUpdate extends Partial<ParcelInsert> {}

export interface ParcelProfitability {
  parcel_id: string;
  parcel_name: string;
  region: string | null;
  city: string | null;
  crop_type: CropType;
  contact_id: string;
  owner_name: string;
  total_bales: number;
  shipped_bales: number;
  remaining_bales: number;
  season_id: string | null;
  owner_total_cost: number;
  status: ParcelStatus;
  contractor_cost: number;
  total_revenue: number;
  total_weight_shipped: number;
  delivery_count: number;
  total_freight: number;
  avg_bale_weight: number;
  profit: number;
}

export interface RegionProfitability {
  region: string;
  season_id: string | null;
  parcel_count: number;
  total_bales: number;
  total_revenue: number;
  total_owner_cost: number;
  total_contractor_cost: number;
  total_freight: number;
  total_profit: number;
  profit_margin_pct: number;
  avg_bale_weight: number;
}

// --- Dashboard ---

export interface MonthlyData {
  month: string;
  purchases: number;
  sales: number;
}
