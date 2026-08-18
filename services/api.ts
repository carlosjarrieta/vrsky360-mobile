/// <reference types="vite/client" />
import { AuthResponse, BirthdayEvent, BirthdayEventInput, BirthdayEventsApiResponse, BirthdayEventsResult, Sale, SalesApiResponse, SalesFetchResult } from '../types';

const apiBase = ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:3001/api/v1').replace(/\/+$/, '');
export const API_BASE_URL = apiBase;
const LOGIN_URL = `${apiBase}/login`;
const SALES_URL = `${apiBase}/sales`;
const CANCEL_URL = `${apiBase}/request_cancel`;
const PAYMENT_METHODS_URL = `${apiBase}/change_payment_method`;
const SPLIT_SALE_URL = `${apiBase}/sales/split`;
const BIRTHDAY_EVENTS_URL = `${apiBase}/birthday_events`;

// Custom Auth error used to indicate the token is invalid/expired
export class AuthError extends Error {
  constructor(message?: string) {
    super(message ?? 'Authentication error');
    this.name = 'AuthError';
  }
}

// Network-level failure (server down, no connectivity). Never masked with mock
// data: the operator must know the app is offline, not see invented sales.
export const CONNECTION_ERROR_MESSAGE = 'No se pudo conectar con el servidor. Verifica tu conexión e intenta de nuevo.';

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
  let response: Response;
  try {
    response = await fetch(LOGIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new Error(CONNECTION_ERROR_MESSAGE);
  }

  if (response.status === 401 || response.status === 403 || response.status === 422) {
    throw new Error('Correo o contraseña incorrectos.');
  }
  if (!response.ok) {
    throw new Error('Error del servidor al iniciar sesión. Intenta de nuevo.');
  }

  const payload = await response.json();
  return normalizeAuthPayload(payload);
};

// Devuelve las ventas y, para operadores (no admin), los datos de su máquina:
// el backend los manda en `meta.machine` y de ahí sale el precio de paquete.
export const fetchSales = async (token: string, startDate: string, endDate: string): Promise<SalesFetchResult> => {
  const url = new URL(SALES_URL);
  url.searchParams.append('start_date', startDate);
  url.searchParams.append('end_date', endDate);

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
  } catch {
    throw new Error(CONNECTION_ERROR_MESSAGE);
  }

  if (response.status === 401) {
    // Token expired or unauthorized
    throw new AuthError('Token expired or unauthorized');
  }

  if (!response.ok) {
    throw new Error('No se pudieron cargar las ventas. Intenta de nuevo.');
  }

  const jsonResponse: SalesApiResponse = await response.json();
  return {
    sales: jsonResponse.data || [], // Handle { data: [...] } structure
    machine: jsonResponse.meta?.machine,
  };
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
      const errorData = await response.json().catch(() => ({} as { error?: string }));
      throw new Error(errorData.error || 'No se pudo cancelar la venta');
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
      // El backend responde { success: false, error: '...' }; en particular un 409
      // cuando el día de la venta ya quedó facturado en un corte de liquidación.
      const errorData = await response.json().catch(() => ({} as { error?: string }));
      throw new Error(errorData.error || 'No se pudo cambiar el método de pago');
    }

    const payload = await response.json();
    // Backend returns the recalculated sale (amount + owner/operator split) under `data`.
    return { success: true, sale: payload.data };
  } catch (error) {
    console.error('Change payment method failed', error);
    throw error;
  }
};

export const splitSale = async (
  token: string,
  saleId: number,
  amount: number,
  paymentMethod: number,
  vendorName?: string
): Promise<{ success: boolean; data: any }> => {
  try {
    const response = await fetch(SPLIT_SALE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        sale_id: saleId,
        amount,
        payment_method: paymentMethod,
        vendor_name: vendorName
      }),
    });

    if (response.status === 401) {
      throw new AuthError('Token expired or unauthorized');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'No se pudo dividir la venta');
    }

    const payload = await response.json();
    return { success: true, data: payload.data };
  } catch (error) {
    console.error('Split sale failed:', error);
    throw error;
  }
};

// Recent birthday events + per-day reconciliation summary for the operator's
// machine. No mock fallback: if it can't load we want the operator to see it.
export const fetchBirthdayEvents = async (
  token: string,
  startDate?: string,
  endDate?: string
): Promise<BirthdayEventsResult> => {
  const url = new URL(BIRTHDAY_EVENTS_URL);
  if (startDate) url.searchParams.append('start_date', startDate);
  if (endDate) url.searchParams.append('end_date', endDate);

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (response.status === 401) {
    throw new AuthError('Token expired or unauthorized');
  }
  if (!response.ok) {
    throw new Error('No se pudieron cargar los cumpleaños');
  }

  const payload: BirthdayEventsApiResponse = await response.json();
  return { events: payload.data || [], summary: payload.summary || [] };
};

// Edits an active birthday event (correct children count / responsible).
export const updateBirthdayEvent = async (
  token: string,
  id: number,
  changes: BirthdayEventInput
): Promise<BirthdayEvent> => {
  const response = await fetch(`${BIRTHDAY_EVENTS_URL}/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(changes),
  });

  if (response.status === 401) {
    throw new AuthError('Token expired or unauthorized');
  }
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'No se pudo actualizar el evento');
  }

  const payload = await response.json();
  return payload.data as BirthdayEvent;
};

// Soft-deletes a birthday event. A reason is mandatory and is stored on the
// backend for audit (the event is not physically removed).
export const deleteBirthdayEvent = async (
  token: string,
  id: number,
  reason: string
): Promise<void> => {
  const response = await fetch(`${BIRTHDAY_EVENTS_URL}/${id}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ reason }),
  });

  if (response.status === 401) {
    throw new AuthError('Token expired or unauthorized');
  }
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'No se pudo eliminar el evento');
  }
};

// Registers one or more birthday events in a single batch.
export const registerBirthdayEvents = async (
  token: string,
  events: BirthdayEventInput[]
): Promise<BirthdayEvent[]> => {
  const response = await fetch(BIRTHDAY_EVENTS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ events }),
  });

  if (response.status === 401) {
    throw new AuthError('Token expired or unauthorized');
  }
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'No se pudieron registrar los cumpleaños');
  }

  const payload: BirthdayEventsApiResponse = await response.json();
  return payload.data || [];
};