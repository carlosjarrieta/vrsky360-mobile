export interface User {
  id: number;
  email: string;
  name: string;
  admin?: boolean;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Machine {
  id: number;
  name: string;
  model: string;
}

export interface Enterprise {
  id: number;
  name: string;
}

export interface Sale {
  id: number;
  sale_origin_id: number;
  game_name: string;
  pay_time: string;
  amount: number;
  created_at: string; // ISO Date string
  updated_at: string;
  player_count: number;
  machine: Machine;
  enterprise: Enterprise;
  game_image_url?: string;
  canceled?: boolean;
  cancellation_reason?: string;
  cancellation_status?: 'pending' | 'approved' | 'rejected';
  pendingCancellation?: boolean;
  pending?: boolean;
  payment_method?: string | number;
  machine_id?: number;
  machine_name?: string;
  owner_amount?: number;
  operator_amount?: number;
  original_amount?: number;
  adjustment?: boolean;
  vendor_name?: string;
}

export interface SalesApiResponse {
  data: Sale[];
}

// A single birthday event the operator registers (one row in the form).
export interface BirthdayEventInput {
  children_count: number;
  responsible_name?: string;
  note?: string;
  event_date?: string; // YYYY-MM-DD; defaults to today on the backend
}

export interface BirthdayEvent {
  id: number;
  event_date: string;
  children_count: number;
  responsible_name?: string | null;
  note?: string | null;
  reconciled: boolean;
  created_at: string;
}

// Per-day reconciliation: how many tickets sold vs redeemed vs still pending.
export interface BirthdayDaySummary {
  date: string;
  registered: number;
  redeemed: number;
  pending: number;
}

export interface BirthdayEventsApiResponse {
  success: boolean;
  data: BirthdayEvent[];
  summary?: BirthdayDaySummary[];
}

export interface BirthdayEventsResult {
  events: BirthdayEvent[];
  summary: BirthdayDaySummary[];
}

export interface ApiError {
  message: string;
}