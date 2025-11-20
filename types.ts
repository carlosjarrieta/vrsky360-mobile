export interface User {
  id: number;
  email: string;
  name: string;
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
}

export interface SalesApiResponse {
  data: Sale[];
}

export interface ApiError {
  message: string;
}