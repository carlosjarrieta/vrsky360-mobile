import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { fetchSales, AuthError } from '../services/api';
import { Sale, User, Machine } from '../types';
import SalesTable from './SalesTable';
import { Calendar, DollarSign, Users, Gamepad2, LogOut, RefreshCw, Banknote, CreditCard, Package, PlayCircle, Building2, Filter } from 'lucide-react';

interface AdminDashboardProps {
    token: string;
    user: User;
    onLogout: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ token, user, onLogout }) => {
    const today = (() => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    })();

    const [startDate, setStartDate] = useState(today);
    const [endDate, setEndDate] = useState(today);
    const [sales, setSales] = useState<Sale[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedMachine, setSelectedMachine] = useState<number | null>(null);
    const [showMachineDetail, setShowMachineDetail] = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchSales(token, startDate, endDate);
            setSales(data);
        } catch (error) {
            if (error instanceof AuthError) {
                onLogout();
                return;
            }
            console.error("Failed to fetch sales", error);
        } finally {
            setLoading(false);
        }
    }, [token, startDate, endDate, onLogout]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Filter sales by selected machine if applicable
    const filteredSales = useMemo(() => {
        if (!selectedMachine) return sales;
        return sales.filter(sale => {
            const machineId = sale.machine_id ?? sale.machine?.id;
            return machineId === selectedMachine;
        });
    }, [sales, selectedMachine]);

    const activeSales = useMemo(() => filteredSales.filter((sale) => !sale.canceled), [filteredSales]);

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
            let key = 'cash';
            if (method === 1 || method === 'transfer') key = 'transfer';
            else if (method === 2 || method === 'package') key = 'package';
            else if (method === 3 || method === 'demo') key = 'demo';
            else key = 'cash';

            acc[key] = (acc[key] || 0) + sale.amount;
            return acc;
        }, {} as Record<string, number>);

        return { totalRevenue, totalGames, totalPlayers, byMethod };
    }, [activeSales]);

    // Stats by machine
    const machineStats = useMemo(() => {
        const statsByMachine = new Map<number, {
            machineId: number;
            machineName: string;
            revenue: number;
            games: number;
            players: number;
            byMethod: Record<string, number>;
        }>();

        sales.forEach(sale => {
            // Use machine_id and machine_name from the API response
            const machineId = sale.machine_id ?? sale.machine?.id;
            const machineName = sale.machine_name ?? sale.machine?.name ?? 'Unknown';

            if (!machineId || sale.canceled) return;

            const method = sale.payment_method;
            const isDemo = method === 3 || method === 'demo';

            if (!statsByMachine.has(machineId)) {
                statsByMachine.set(machineId, {
                    machineId,
                    machineName,
                    revenue: 0,
                    games: 0,
                    players: 0,
                    byMethod: {
                        cash: 0,
                        transfer: 0,
                        package: 0,
                        demo: 0,
                    },
                });
            }

            const stats = statsByMachine.get(machineId)!;

            // Add to total revenue (excluding demos)
            if (!isDemo) {
                stats.revenue += sale.amount;
            }

            stats.games += 1;
            stats.players += sale.player_count;

            // Calculate by payment method
            let methodKey = 'cash';
            if (method === 1 || method === 'transfer') methodKey = 'transfer';
            else if (method === 2 || method === 'package') methodKey = 'package';
            else if (method === 3 || method === 'demo') methodKey = 'demo';
            else methodKey = 'cash';

            stats.byMethod[methodKey] += sale.amount;
        });

        return Array.from(statsByMachine.values()).sort((a, b) => b.revenue - a.revenue);
    }, [sales]);

    const handleMachineClick = (machineId: number) => {
        setSelectedMachine(machineId);
        setShowMachineDetail(true);
    };

    const handleBackToOverview = () => {
        setSelectedMachine(null);
        setShowMachineDetail(false);
    };

    // Redirect if not admin
    if (!user.admin) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="bg-white p-8 rounded-xl shadow-lg text-center">
                    <h2 className="text-2xl font-bold text-gray-800 mb-4">Acceso Denegado</h2>
                    <p className="text-gray-600 mb-6">No tienes permisos de administrador para acceder a esta sección.</p>
                    <button
                        onClick={onLogout}
                        className="bg-primary hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-all"
                    >
                        Volver al Login
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Navigation Bar */}
            <nav className="bg-primary text-white shadow-lg sticky top-0 z-30">
                <div className="container mx-auto px-4 py-3 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="bg-white/20 p-2 rounded-lg">
                            <Building2 className="w-6 h-6 text-white" />
                        </div>
                        <h1 className="text-xl font-bold tracking-tight">Admin Dashboard</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="hidden md:inline text-sm font-medium text-blue-100">
                            {user.name} (Admin)
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
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Fecha Inicio</label>
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
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Fecha Fin</label>
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
                            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Actualizar'}
                        </button>
                        {showMachineDetail && (
                            <button
                                onClick={handleBackToOverview}
                                className="flex items-center justify-center gap-2 bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg font-medium transition-all shadow-sm active:transform active:scale-95"
                            >
                                <Filter className="w-4 h-4" />
                                Ver Todo
                            </button>
                        )}
                    </div>
                </div>

                {/* Conditional Rendering: Overview or Machine Detail */}
                {!showMachineDetail ? (
                    <>
                        {/* Global Stats Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4 relative overflow-hidden group">
                                <div className="absolute right-0 top-0 h-full w-1 bg-success"></div>
                                <div className="bg-green-50 p-3 rounded-full text-success group-hover:scale-110 transition-transform">
                                    <DollarSign className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500 font-medium">Ingresos Totales</p>
                                    <p className="text-2xl font-bold text-gray-800">${stats.totalRevenue.toLocaleString('en-US')}</p>
                                </div>
                            </div>

                            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4 relative overflow-hidden group">
                                <div className="absolute right-0 top-0 h-full w-1 bg-info"></div>
                                <div className="bg-cyan-50 p-3 rounded-full text-info group-hover:scale-110 transition-transform">
                                    <Gamepad2 className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500 font-medium">Total Juegos</p>
                                    <p className="text-2xl font-bold text-gray-800">{stats.totalGames}</p>
                                </div>
                            </div>

                            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4 relative overflow-hidden group">
                                <div className="absolute right-0 top-0 h-full w-1 bg-warning"></div>
                                <div className="bg-yellow-50 p-3 rounded-full text-warning group-hover:scale-110 transition-transform">
                                    <Users className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500 font-medium">Total Jugadores</p>
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
                        </div>

                        {/* Machine Stats Table */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="p-4 border-b border-gray-100">
                                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                    <Building2 className="w-5 h-5 text-primary" />
                                    Ventas por Máquina y Método de Pago
                                </h2>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Máquina</th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Banknote className="w-3 h-3" />
                                                    Efectivo
                                                </div>
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                                <div className="flex items-center justify-end gap-1">
                                                    <CreditCard className="w-3 h-3" />
                                                    Transfer
                                                </div>
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Package className="w-3 h-3" />
                                                    Paquete
                                                </div>
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                                <div className="flex items-center justify-end gap-1">
                                                    <PlayCircle className="w-3 h-3" />
                                                    Demo
                                                </div>
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Total</th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Juegos</th>
                                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {machineStats.map((stat) => (
                                            <tr key={stat.machineId} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-4 py-3 text-sm font-medium text-gray-800">
                                                    {stat.machineName}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-right font-medium text-emerald-600">
                                                    ${(stat.byMethod.cash || 0).toLocaleString('en-US')}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-right font-medium text-purple-600">
                                                    ${(stat.byMethod.transfer || 0).toLocaleString('en-US')}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-right font-medium text-blue-600">
                                                    ${(stat.byMethod.package || 0).toLocaleString('en-US')}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-right font-medium text-gray-600">
                                                    ${(stat.byMethod.demo || 0).toLocaleString('en-US')}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-right font-bold text-green-700">
                                                    ${stat.revenue.toLocaleString('en-US')}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-right text-gray-800">
                                                    <div>{stat.games}</div>
                                                    <div className="text-xs text-gray-500">{stat.players} jugadores</div>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <button
                                                        onClick={() => handleMachineClick(stat.machineId)}
                                                        className="text-primary hover:text-blue-700 font-medium text-sm underline"
                                                    >
                                                        Ver Detalle
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {machineStats.length === 0 && (
                                            <tr>
                                                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                                                    No hay datos disponibles para el rango de fechas seleccionado
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        {/* Machine Detail View */}
                        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                            <h2 className="text-xl font-bold text-gray-800 mb-4">
                                Detalle de Ventas - {machineStats.find(m => m.machineId === selectedMachine)?.machineName}
                            </h2>

                            {/* Stats for selected machine */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4 relative overflow-hidden group">
                                    <div className="absolute right-0 top-0 h-full w-1 bg-success"></div>
                                    <div className="bg-green-50 p-3 rounded-full text-success group-hover:scale-110 transition-transform">
                                        <DollarSign className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500 font-medium">Ingresos</p>
                                        <p className="text-2xl font-bold text-gray-800">${stats.totalRevenue.toLocaleString('en-US')}</p>
                                    </div>
                                </div>

                                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4 relative overflow-hidden group">
                                    <div className="absolute right-0 top-0 h-full w-1 bg-info"></div>
                                    <div className="bg-cyan-50 p-3 rounded-full text-info group-hover:scale-110 transition-transform">
                                        <Gamepad2 className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500 font-medium">Juegos</p>
                                        <p className="text-2xl font-bold text-gray-800">{stats.totalGames}</p>
                                    </div>
                                </div>

                                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4 relative overflow-hidden group">
                                    <div className="absolute right-0 top-0 h-full w-1 bg-warning"></div>
                                    <div className="bg-yellow-50 p-3 rounded-full text-warning group-hover:scale-110 transition-transform">
                                        <Users className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500 font-medium">Jugadores</p>
                                        <p className="text-2xl font-bold text-gray-800">{stats.totalPlayers}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Payment Method Stats for selected machine */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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
                            </div>
                        </div>

                        {/* Sales Table for selected machine */}
                        <SalesTable
                            sales={filteredSales}
                            onCancelSale={async () => { }}
                            onChangePaymentMethod={async () => { }}
                        />
                    </>
                )}

            </main>
        </div>
    );
};

export default AdminDashboard;
