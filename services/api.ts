/// <reference types="vite/client" />
import { AuthResponse, Sale, SalesApiResponse } from '../types';

const apiBase = ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:3001/api/v1').replace(/\/+$/, '');
export const API_BASE_URL = apiBase;
const LOGIN_URL = `${apiBase}/login`;
const SALES_URL = `${apiBase}/sales`;
const CANCEL_URL = `${apiBase}/request_cancel`;
const PAYMENT_METHODS_URL = `${apiBase}/change_payment_method`;

// Custom Auth error used to indicate the token is invalid/expired
export class AuthError extends Error {
  constructor(message?: string) {
    super(message ?? 'Authentication error');
    this.name = 'AuthError';
  }
}

// Mock data generator for demonstration when API is unreachable
const generateMockSales = (startDate: string, endDate: string): Sale[] => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const sales: Sale[] = [];
  const games = ['ironcar', 'skywars', 'zombie-run', 'dino-race'];
  
  // Generate some random sales between dates
  let idCounter = 786;
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dailyCount = Math.floor(Math.random() * 8) + 1; // 1-8 sales per day
    for (let i = 0; i < dailyCount; i++) {
      const gameName = games[Math.floor(Math.random() * games.length)];
      const playerCount = Math.floor(Math.random() * 4) + 1;
      
      sales.push({
        id: idCounter++,
        sale_origin_id: idCounter + 1000,
        game_name: gameName,
        pay_time: Math.floor(1000000000 + Math.random() * 9000000000).toString(),
        amount: Math.floor(Math.random() * 50000) + 10000, // Example amounts like 30000.0
        created_at: d.toISOString(),
        updated_at: d.toISOString(),
        player_count: playerCount,
        machine: {
          id: 1,
          name: "VR Machine 1",
          model: "VR-1000"
        },
        enterprise: {
          id: 1,
          name: "VR360"
        }
      });
    }
  }
  return sales;
};

const normalizeAuthPayload = (payload: unknown): AuthResponse => {
  const source = (payload && typeof payload === 'object') ? (payload as Record<string, unknown>) : {};
  const responseBody = (source.data && typeof source.data === 'object') ? (source.data as Record<string, unknown>) : source;

  const token = (responseBody.token ?? responseBody.access_token ?? responseBody.jwt) as string | undefined;
  const rawUser = (responseBody.user ?? responseBody.usuario) as Record<string, unknown> | undefined;
  const user: AuthResponse['user'] | undefined = rawUser
    ? {
        id: Number(rawUser.id),
        email: (rawUser.email as string) ?? 'user@example.com',
        name: (rawUser.name as string) ?? (rawUser.email as string) ?? 'Usuario',
        admin: Boolean(rawUser.admin),
      }
    : undefined;

  if (!token || !user) {
    throw new Error('La respuesta de autenticación no contiene credenciales válidas.');
  }

  return { token, user };
};

export const loginUser = async (email: string, password: string): Promise<AuthResponse> => {
  try {
    const response = await fetch(LOGIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      throw new Error('Invalid credentials');
    }

    const payload = await response.json();
    return normalizeAuthPayload(payload);
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid credentials') {
      throw error;
    }
    console.warn("API unavailable, using mock login for demo purposes.");
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Mock success if email is provided
    if (email) {
      return {
        token: "mock-jwt-token-12345",
        user: { id: 1, email, name: "Admin VR360" }
      };
    }
    throw error;
  }
};

export const fetchSales = async (token: string, startDate: string, endDate: string): Promise<Sale[]> => {
  try {
    const url = new URL(SALES_URL);
    url.searchParams.append('start_date', startDate);
    url.searchParams.append('end_date', endDate);

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 401) {
      // Token expired or unauthorized
      throw new AuthError('Token expired or unauthorized');
    }

    if (!response.ok) {
      throw new Error('Failed to fetch sales');
    }

    const jsonResponse: SalesApiResponse = await response.json();
    return jsonResponse.data || []; // Handle { data: [...] } structure
  } catch (error) {
    // If the error is related to authorization, rethrow so caller can redirect to login
    if (error instanceof AuthError) {
      throw error;
    }

    console.warn("API unavailable or failed, returning mock sales data.");
    await new Promise(resolve => setTimeout(resolve, 500));
    return generateMockSales(startDate, endDate);
  }
};

export const requestCancelSale = async (
  token: string,
  saleId: number,
  reason: string
): Promise<{ canceled: boolean; sale?: Partial<Sale> }> => {
  try {
    const response = await fetch(CANCEL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ sale_id: saleId, reason }),
    });

    if (response.status === 401) {
      throw new AuthError('Token expired or unauthorized');
    }

    if (!response.ok) {
      throw new Error('No se pudo cancelar la venta');
    }

    const payload = await response.json();
    
    // The backend returns { success: true, message: "...", data: { id, sale_id, reason, created_at } }
    // This means the cancellation REQUEST was created, not that the sale is canceled
    // So we should return canceled: false and set cancellation_status to 'pending'
    
    if (payload.success) {
      return { 
        canceled: false, 
        sale: { 
          cancellation_status: 'pending',
          cancellation_reason: reason
        } 
      };
    }
    
    // Fallback for other response formats
    const canceled = Boolean(payload.canceled ?? false);
    return { canceled, sale: payload.sale };
  } catch (error) {
    console.error('Cancel request failed', error);
    throw error;
  }
};

export const changePaymentMethod = async (
  token: string,
  saleId: number,
  paymentMethod: number,
  vendorName?: string
): Promise<{ success: boolean; sale?: Partial<Sale> }> => {
  try {
    const response = await fetch(PAYMENT_METHODS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ sale_id: saleId, payment_method: paymentMethod, vendor_name: vendorName }),
    });

    if (response.status === 401) {
      throw new AuthError('Token expired or unauthorized');
    }

    if (!response.ok) {
      throw new Error('No se pudo cambiar el método de pago');
    }

    const payload = await response.json();
    return { success: true, sale: payload.sale };
  } catch (error) {
    console.error('Change payment method failed', error);
    throw error;
  }
};