import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { fetchSales, requestCancelSale, changePaymentMethod, AuthError } from '../services/api';
import { Sale, User } from '../types';
import SalesTable from './SalesTable';
import { Calendar, DollarSign, Users, Gamepad2, LogOut, RefreshCw } from 'lucide-react';

interface DashboardProps {
  token: string;
  user: User;
  onLogout: () => void;
}

const PENDING_STORAGE_KEY = 'pendingSaleCancellations';

const Dashboard: React.FC<DashboardProps> = ({ token, user, onLogout }) => {
  const today = new Date().toISOString().split('T')[0];
  
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingCancellationIds, setPendingCancellationIds] = useState<number[]>(() => {
    if (typeof window === 'undefined') {
      return [];
    }
    try {
      const stored = window.localStorage.getItem(PENDING_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      return [];
    }
  });
  const pendingIdsRef = useRef<Set<number>>(new Set(pendingCancellationIds));

  useEffect(() => {
    pendingIdsRef.current = new Set(pendingCancellationIds);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(PENDING_STORAGE_KEY, JSON.stringify(pendingCancellationIds));
      } catch (error) {
        console.error('Failed to persist pending cancellations', error);
      }
    }
  }, [pendingCancellationIds]);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchSales(token, startDate, endDate);
      const pendingIds = new Set(pendingIdsRef.current);
      
      // Update pending IDs based on server response - trust the backend
      data.forEach((sale) => {
        const isServerPending = sale.pending === true || sale.cancellation_status === 'pending';
        
        if (isServerPending) {
          // Server says it's pending, add to local tracking
          pendingIds.add(sale.id);
        } else if (pendingIds.has(sale.id)) {
          // Server says it's NOT pending anymore (approved, rejected, or just false), remove from local tracking
          pendingIds.delete(sale.id);
        }
      });
      
      const enriched = data.map((sale) => {
        const isPending = sale.pending === true || sale.cancellation_status === 'pending';
        return {
          ...sale,
          pendingCancellation: isPending,
          pending: isPending,
          // Don't override canceled if it's truly canceled
          canceled: sale.canceled ?? false,
        };
      });
      
      setPendingCancellationIds(Array.from(pendingIds));
      setSales(enriched);
    } catch (error) {
      // If token is invalid or expired, redirect to login via onLogout
      if (error instanceof AuthError) {
        onLogout();
        return;
      }
      console.error("Failed to fetch sales", error);
    } finally {
      setLoading(false);
    }
  }, [token, startDate, endDate]);

  const handleSaleCancel = useCallback(async (saleId: number, reason: string) => {
    // Step 1: Optimistic update - immediately set to pending
    setSales((prev) =>
      prev.map((sale) =>
        sale.id === saleId
          ? {
              ...sale,
              pendingCancellation: true,
              pending: true,
              canceled: false,
            }
          : sale
      )
    );
    setPendingCancellationIds((prev) => Array.from(new Set([...prev, saleId])));

    try {
      // Step 2: Make the API request
      const result = await requestCancelSale(token, saleId, reason);
      
      // Step 3: Interpret the server response correctly
      const serverStatus = result.sale?.cancellation_status;
      const isCanceled = result.canceled ?? false;
      
      let finalPending = false;
      let finalCanceled = false;
      
      if (serverStatus === 'pending') {
        // Cancellation request is pending approval
        finalPending = true;
        finalCanceled = false;
      } else if (serverStatus === 'approved' || (isCanceled && serverStatus !== 'rejected')) {
        // Cancellation was approved/completed
        finalPending = false;
        finalCanceled = true;
      } else if (serverStatus === 'rejected') {
        // Cancellation was rejected - restore to active
        finalPending = false;
        finalCanceled = false;
      } else {
        // Default: assume pending if no clear status but request succeeded
        finalPending = true;
        finalCanceled = false;
      }
      
      // Step 4: Update state with server response
      setSales((prev) =>
        prev.map((sale) =>
          sale.id === saleId
            ? {
                ...sale,
                ...result.sale,
                pendingCancellation: finalPending,
                pending: finalPending,
                canceled: finalCanceled,
              }
            : sale
        )
      );
      
      setPendingCancellationIds((prev) => {
        const next = new Set(prev);
        if (finalPending) {
          next.add(saleId);
        } else {
          next.delete(saleId);
        }
        return Array.from(next);
      });
      
    } catch (error) {
      // If token is invalid or expired, redirect to login via onLogout
      if (error instanceof AuthError) {
        onLogout();
        return;
      }
      console.error('Failed to cancel sale:', error);
      // Revert optimistic update on error
      loadData();
      throw error;
    }
  }, [token, loadData]);

  const handleChangePaymentMethod = useCallback(async (saleId: number, method: number) => {
    try {
      const result = await changePaymentMethod(token, saleId, method);
      if (result.success) {
        // Optimistic update first
        setSales((prev) =>
          prev.map((sale) =>
            sale.id === saleId
              ? { ...sale, ...(result.sale || {}), payment_method: method }
              : sale
          )
        );
        // Then refresh data to ensure consistency
        loadData();
      }
    } catch (error) {
      if (error instanceof AuthError) {
        onLogout();
        return;
      }
      console.error('Failed to change payment method:', error);
      alert('No se pudo cambiar el método de pago. Por favor intente nuevamente.');
    }
  }, [token, onLogout, loadData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeSales = useMemo(() => sales.filter((sale) => !sale.canceled), [sales]);

  const stats = useMemo(() => {
    const totalRevenue = activeSales.reduce((sum, sale) => sum + sale.amount, 0);
    const totalPlayers = activeSales.reduce((sum, sale) => sum + sale.player_count, 0);
    const totalGames = activeSales.length;
    
    return { totalRevenue, totalGames, totalPlayers };
  }, [activeSales]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Navigation Bar - Bootstrap style primary color */}
      <nav className="bg-primary text-white shadow-lg sticky top-0 z-30">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-white/20 p-2 rounded-lg">
              <Gamepad2 className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">VR360 Dash</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden md:inline text-sm font-medium text-blue-100">
              {user.name}
            </span>
            <button 
              onClick={onLogout}
              className="bg-white/10 hover:bg-white/20 p-2 rounded-lg transition-colors"
              aria-label="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-grow container mx-auto px-4 py-6 space-y-6">
        
        {/* Filters Section */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex flex-col md:flex-row md:items-end gap-4">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Start Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  type="date" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-sm"
                />
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">End Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  type="date" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-sm"
                />
              </div>
            </div>
            <button 
              onClick={loadData}
              disabled={loading}
              className="flex items-center justify-center gap-2 bg-primary hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-all disabled:opacity-70 shadow-sm active:transform active:scale-95"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4 relative overflow-hidden group">
            <div className="absolute right-0 top-0 h-full w-1 bg-success"></div>
            <div className="bg-green-50 p-3 rounded-full text-success group-hover:scale-110 transition-transform">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-800">${stats.totalRevenue.toLocaleString('en-US')}</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4 relative overflow-hidden group">
            <div className="absolute right-0 top-0 h-full w-1 bg-info"></div>
            <div className="bg-cyan-50 p-3 rounded-full text-info group-hover:scale-110 transition-transform">
              <Gamepad2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Total Games</p>
              <p className="text-2xl font-bold text-gray-800">{stats.totalGames}</p>
            </div>
          </div>

           <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4 relative overflow-hidden group">
            <div className="absolute right-0 top-0 h-full w-1 bg-warning"></div>
            <div className="bg-yellow-50 p-3 rounded-full text-warning group-hover:scale-110 transition-transform">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Total Players</p>
              <p className="text-2xl font-bold text-gray-800">{stats.totalPlayers}</p>
            </div>
          </div>
        </div>

        {/* Table */}
        <SalesTable sales={sales} onCancelSale={handleSaleCancel} onChangePaymentMethod={handleChangePaymentMethod} />

      </main>
    </div>
  );
};

export default Dashboard;