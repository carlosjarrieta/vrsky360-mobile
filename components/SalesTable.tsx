import React, { useState } from 'react';
import { Sale } from '../types';
import { ArrowDownCircle, Users } from 'lucide-react';
import { API_BASE_URL } from '../services/api';

const resolveGameImageUrl = (imageUrl?: string) => {
  if (!imageUrl) return undefined;
  return imageUrl.startsWith('http')
    ? imageUrl
    : `${API_BASE_URL}/${imageUrl.replace(/^\/+/, '')}`;
};

interface SalesTableProps {
  sales: Sale[];
  onCancelSale: (saleId: number, reason: string) => Promise<void>;
}

const SalesTable: React.FC<SalesTableProps> = ({ sales, onCancelSale }) => {
  const [activeSale, setActiveSale] = useState<Sale | null>(null);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  const openModal = (sale: Sale) => {
    setActiveSale(sale);
    setReason('');
    setModalError('');
  };

  const closeModal = () => {
    setActiveSale(null);
    setReason('');
    setModalError('');
    setIsSubmitting(false);
  };

  const handleConfirm = async () => {
    if (!activeSale) return;
    if (!reason.trim()) {
      setModalError('Describe brevemente por qué cancelas esta venta.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onCancelSale(activeSale.id, reason.trim());
      closeModal();
    } catch (error) {
      setModalError((error as Error).message || 'No se pudo cancelar la venta.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalImageUrl = activeSale ? resolveGameImageUrl(activeSale.game_image_url) : undefined;
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mt-6">
      <div className="p-4 border-b border-gray-100 flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-800">Recent Games</h3>
        <span className="text-sm text-gray-500">{sales.length} records</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-gray-500 uppercase bg-gray-50">
            <tr>
              <th className="px-4 py-3">Date / Time</th>
              <th className="px-4 py-3">Game</th>
              <th className="px-4 py-3 text-center">Players</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {sales.length > 0 ? (
              sales.slice().reverse().map((sale) => {
                const imageUrl = resolveGameImageUrl(sale.game_image_url);
                const isPending = sale.pending ?? sale.pendingCancellation;
                const rowStateClass = sale.canceled
                  ? 'bg-red-50 text-gray-500 hover:bg-red-50'
                  : isPending
                    ? 'bg-amber-50 text-amber-900 hover:bg-amber-50'
                    : 'hover:bg-gray-50';
                const actionDisabled = sale.canceled || isPending;
                const actionLabel = sale.canceled
                  ? 'Venta cancelada'
                  : isPending
                    ? 'Solicitud pendiente'
                    : 'Solicitar cancelación';

                return (
                  <tr
                    key={sale.id}
                    className={`border-b border-gray-50 transition-colors ${rowStateClass}`}
                  >
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">
                      <div className="flex flex-col">
                        <span>{new Date(sale.created_at).toISOString().split('T')[0]}</span>
                        <span className="text-xs text-gray-400">{new Date(sale.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                      <div className="flex flex-col items-start gap-2">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={`${sale.game_name} cover`}
                            className="w-16 h-16 rounded-xl object-cover shadow-sm border border-gray-100"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-xl bg-gray-100 border border-dashed border-gray-200 flex items-center justify-center text-xs text-gray-400">
                            {sale.game_name?.charAt(0).toUpperCase()}
                          </div>
                        )}
                        {isPending && (
                          <span className="text-[10px] font-semibold tracking-wide uppercase bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                            Solicitud pendiente
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                        <Users className="w-3 h-3" />
                        {sale.player_count}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right font-bold text-gray-800">
                      ${sale.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <button
                        type="button"
                        onClick={() => openModal(sale)}
                        disabled={actionDisabled}
                        className={`text-xs font-semibold px-3 py-2 rounded-full border transition ${actionDisabled
                          ? 'border-gray-200 bg-gray-100 text-gray-500 pointer-events-none'
                          : 'border-primary bg-white text-primary hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
                        }`}
                      >
                        {actionLabel}
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <ArrowDownCircle className="w-8 h-8 text-gray-300" />
                    No sales found for this period.
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {activeSale && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4 py-6">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-200">
            <div className="p-6 space-y-4">
              <div className="flex flex-col items-center gap-3 text-center">
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Cancelar venta</p>
                {modalImageUrl ? (
                  <img
                    src={modalImageUrl}
                    alt={`${activeSale.game_name} cover`}
                    className="w-32 h-32 rounded-2xl object-cover shadow-lg border border-gray-100"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-2xl bg-gray-100 border border-dashed border-gray-200 flex items-center justify-center text-3xl text-gray-400 font-semibold">
                    {activeSale.game_name?.charAt(0).toUpperCase()}
                  </div>
                )}
                <p className="text-xs text-gray-400">ID #{activeSale.sale_origin_id} • {new Date(activeSale.created_at).toLocaleString()}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Motivo de cancelación</label>
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={4}
                  className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700 focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20 outline-none"
                  placeholder="Explica brevemente por qué estás cancelando esta venta"
                />
                {modalError && <p className="mt-2 text-xs text-red-600">{modalError}</p>}
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm font-semibold text-gray-600 rounded-xl border border-gray-200 hover:bg-gray-100"
                >
                  Volver
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={isSubmitting}
                  className={`px-4 py-2 text-sm font-semibold rounded-xl text-white transition ${isSubmitting ? 'bg-primary/70 cursor-wait' : 'bg-primary hover:bg-blue-700'}`}
                >
                  {isSubmitting ? 'Cancelando...' : 'Confirmar cancelación'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesTable;