import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { fetchSales, requestCancelSale, changePaymentMethod, splitSale, fetchBirthdayEvents, AuthError } from '../services/api';
import { Sale, User, BirthdayDaySummary } from '../types';
import SalesTable from './SalesTable';
import { Calendar, DollarSign, Users, Gamepad2, LogOut, RefreshCw, Banknote, CreditCard, Package, PlayCircle, Ticket, Calculator, Split, Cake } from 'lucide-react';
import WorkDayModal from './WorkDayModal';
import SplitPaymentModal from './SplitPaymentModal';
import BirthdayEventsModal from './BirthdayEventsModal';

interface DashboardProps {
  token: string;
  user: User;
  onLogout: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ token, user, onLogout }) => {
  const formatDate = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const today = formatDate(new Date());
  const yesterday = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return formatDate(d);
  })();
  const minDate = user.admin ? undefined : yesterday;
  const maxDate = user.admin ? undefined : today;

  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [sales, setSales] = useState<Sale[]>([]);
  const [birthdaySummary, setBirthdaySummary] = useState<BirthdayDaySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [isWorkDayModalOpen, setIsWorkDayModalOpen] = useState(false);
  const [isBirthdayModalOpen, setIsBirthdayModalOpen] = useState(false);
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
  const [selectedSaleForSplit, setSelectedSaleForSplit] = useState<Sale | null>(null);
  const [pendingCancellationIds, setPendingCancellationIds] = useState<number[]>([]);
  const pendingIdsRef = useRef<Set<number>>(new Set(pendingCancellationIds));

  useEffect(() => {
    pendingIdsRef.current = new Set(pendingCancellationIds);
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

      // Birthday reconciliation summary for the selected range (non-fatal).
      try {
        const { summary } = await fetchBirthdayEvents(token, startDate, endDate);
        setBirthdaySummary(summary);
      } catch (bErr) {
        if (bErr instanceof AuthError) throw bErr;
        console.error('Failed to fetch birthday summary', bErr);
      }
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

  const handleChangePaymentMethod = useCallback(async (saleId: number, method: number, vendorName?: string) => {
    try {
      const result = await changePaymentMethod(token, saleId, method, vendorName);
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

  const handleSplitSale = useCallback(async (saleId: number, amount: number, method: number, vendorName?: string) => {
    try {
      const result = await splitSale(token, saleId, amount, method, vendorName);
      if (result.success) {
        // Refresh data to show both sales
        loadData();
      }
    } catch (error) {
      if (error instanceof AuthError) {
        onLogout();
        return;
      }
      console.error('Failed to split sale:', error);
      alert((error as Error).message || 'No se pudo dividir la venta.');
    }
  }, [token, onLogout, loadData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-refresh every 1 minute
  useEffect(() => {
    const interval = setInterval(() => {
      loadData();
    }, 60000); // 60 seconds

    return () => clearInterval(interval);
  }, [loadData]);

  const activeSales = useMemo(() => sales.filter((sale) => !sale.canceled), [sales]);

  const stats = useMemo(() => {
    // Filter out demo sales for revenue calculation
    const revenueGeneratingSales = activeSales.filter((sale) => {
      const method = sale.payment_method;
      return !(method === 3 || method === 'demo');
    });

    const totalRevenue = revenueGeneratingSales.reduce((sum, sale) => sum + sale.amount, 0);
    const totalPlayers = activeSales.reduce((sum, sale) => sum + sale.player_count, 0);
    const totalGames = activeSales.length;

    // Calculate totals by payment method
    const byMethod = activeSales.reduce((acc, sale) => {
      const method = sale.payment_method;
      // Normalize method to string key
      let key = 'cash';
      if (method === 1 || method === 'transfer') key = 'transfer';
      else if (method === 2 || method === 'package') key = 'package';
      else if (method === 3 || method === 'demo') key = 'demo';
      else if (method === 4 || method === 'box_office') key = 'box_office';
      else key = 'cash'; // 0 or 'cash' or undefined

      acc[key] = (acc[key] || 0) + sale.amount;
      return acc;
    }, {} as Record<string, number>);

    return { totalRevenue, totalGames, totalPlayers, byMethod };
  }, [activeSales]);

  const birthdayStats = useMemo(() => {
    const registered = birthdaySummary.reduce((s, d) => s + d.registered, 0);
    const redeemed = birthdaySummary.reduce((s, d) => s + d.redeemed, 0);
    const pending = birthdaySummary.reduce((s, d) => s + d.pending, 0);
    // Past tense once every day in range is reconciled (the gap was already billed).
    const settled = birthdaySummary.length > 0 && birthdaySummary.every((d) => d.reconciled);
    return { registered, redeemed, pending, settled };
  }, [birthdaySummary]);

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
          <div className="flex flex-col md:flex-row md:items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Start Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  min={minDate}
                  max={maxDate}
                  className="w-full pl-10 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-sm"
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
                  min={minDate}
                  max={maxDate}
                  className="w-full pl-10 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-sm"
                />
              </div>
            </div>
            
            <div className="flex gap-2 w-full md:w-auto">
              <button
                onClick={() => setIsBirthdayModalOpen(true)}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-pink-600 hover:bg-pink-700 text-white px-4 py-2.5 rounded-lg font-bold transition-all shadow-md active:transform active:scale-95"
              >
                <Cake className="w-5 h-5" />
                <span>Cumpleaños</span>
              </button>
              {/* Oculto por ahora — descomentar para reactivar "Liquidar Día"
              <button
                onClick={() => setIsWorkDayModalOpen(true)}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg font-bold transition-all shadow-md active:transform active:scale-95"
              >
                <Calculator className="w-5 h-5" />
                <span>Liquidar Día</span>
              </button>
              */}
              <button
                onClick={loadData}
                disabled={loading}
                className="md:w-12 flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-600 p-2.5 rounded-lg border border-gray-200 transition-all disabled:opacity-70 active:transform active:scale-95"
                title="Refresh"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
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

        {/* Payment Method Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3">
            <div className="bg-emerald-50 p-2 rounded-lg text-emerald-600">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase">Efectivo</p>
              <p className="text-lg font-bold text-gray-800">${(stats.byMethod['cash'] || 0).toLocaleString('en-US')}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3">
            <div className="bg-purple-50 p-2 rounded-lg text-purple-600">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase">Transferencia</p>
              <p className="text-lg font-bold text-gray-800">${(stats.byMethod['transfer'] || 0).toLocaleString('en-US')}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3">
            <div className="bg-blue-50 p-2 rounded-lg text-blue-600">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase">Paquete</p>
              <p className="text-lg font-bold text-gray-800">${(stats.byMethod['package'] || 0).toLocaleString('en-US')}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3">
            <div className="bg-gray-50 p-2 rounded-lg text-gray-600">
              <PlayCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase">Demo</p>
              <p className="text-lg font-bold text-gray-800">${(stats.byMethod['demo'] || 0).toLocaleString('en-US')}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3">
            <div className="bg-amber-50 p-2 rounded-lg text-amber-600">
              <Ticket className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase">Taquilla</p>
              <p className="text-lg font-bold text-gray-800">${(stats.byMethod['box_office'] || 0).toLocaleString('en-US')}</p>
            </div>
          </div>

          {birthdayStats.registered > 0 && (
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3">
              <div className={`p-2 rounded-lg ${birthdayStats.pending > 0 ? 'bg-pink-50 text-pink-600' : 'bg-emerald-50 text-emerald-600'}`}>
                <Cake className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase">Cumpleaños por canjear</p>
                {birthdayStats.pending > 0 ? (
                  <p className="text-lg font-bold text-pink-600">{birthdayStats.settled ? 'Faltaron' : 'Faltan'} {birthdayStats.pending}</p>
                ) : (
                  <p className="text-lg font-bold text-emerald-600">Todos canjeados</p>
                )}
                <p className="text-[11px] text-gray-400">{birthdayStats.redeemed}/{birthdayStats.registered} canjeados</p>
              </div>
            </div>
          )}
        </div>

        {/* Table */}
        <SalesTable 
          sales={sales} 
          onCancelSale={handleSaleCancel} 
          onChangePaymentMethod={handleChangePaymentMethod} 
          onSplitSale={(sale) => {
            setSelectedSaleForSplit(sale);
            setIsSplitModalOpen(true);
          }}
        />

      </main>

      <WorkDayModal
        isOpen={isWorkDayModalOpen}
        onClose={() => setIsWorkDayModalOpen(false)}
        totalCash={stats.byMethod['cash'] || 0}
      />

      <BirthdayEventsModal
        isOpen={isBirthdayModalOpen}
        token={token}
        onClose={() => setIsBirthdayModalOpen(false)}
        onAuthError={onLogout}
      />

      {selectedSaleForSplit && (
        <SplitPaymentModal
          isOpen={isSplitModalOpen}
          sale={selectedSaleForSplit}
          onClose={() => {
            setIsSplitModalOpen(false);
            setSelectedSaleForSplit(null);
          }}
          onConfirm={handleSplitSale}
        />
      )}
    </div>
  );
};

export default Dashboard;
