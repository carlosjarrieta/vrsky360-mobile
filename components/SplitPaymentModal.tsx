import React, { useState } from 'react';
import { X, Split, Banknote, CreditCard, Package, PlayCircle, ArrowRight, AlertCircle } from 'lucide-react';
import { Sale } from '../types';

interface SplitPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale;
  onConfirm: (saleId: number, amount: number, method: number, vendorName?: string) => Promise<void>;
}

const PAYMENT_METHODS = [
  { label: 'Efectivo', value: 0, icon: Banknote },
  { label: 'Transferencia', value: 1, icon: CreditCard },
  { label: 'Paquete', value: 2, icon: Package },
  { label: 'Demo', value: 3, icon: PlayCircle },
];

const SplitPaymentModal: React.FC<SplitPaymentModalProps> = ({ isOpen, onClose, sale, onConfirm }) => {
  const [splitAmount, setSplitAmount] = useState<number>(sale.amount / 2);
  const [method, setMethod] = useState<number>(1); // Default to Transfer
  const [vendorName, setVendorName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (splitAmount <= 0 || splitAmount >= sale.amount) {
      setError(`El monto debe ser entre 0 y ${sale.amount.toLocaleString()}`);
      return;
    }

    if (method === 2 && !vendorName.trim()) {
      setError('El nombre del asesor es obligatorio para "Paquete"');
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      await onConfirm(sale.id, splitAmount, method, vendorName.trim());
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Error al dividir el pago');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4 py-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="bg-primary px-6 py-4 flex justify-between items-center text-white">
          <div className="flex items-center gap-2">
            <Split className="w-5 h-5" />
            <h2 className="text-lg font-bold">Dividir Pago</h2>
          </div>
          <button onClick={onClose} className="hover:text-white/80 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="text-center space-y-1">
            <p className="text-sm text-gray-500 font-medium">Original: {sale.game_name}</p>
            <p className="text-2xl font-black text-gray-800">${sale.amount.toLocaleString('en-US')}</p>
          </div>

          <div className="space-y-4">
            {/* Split Amount */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Monto para el Otro Medio</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400">$</span>
                <input
                  type="number"
                  value={splitAmount}
                  onChange={(e) => setSplitAmount(Number(e.target.value))}
                  className="w-full pl-8 pr-3 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-lg font-bold"
                />
              </div>
            </div>

            {/* Split Preview */}
            <div className="flex items-center justify-between gap-4 p-3 bg-blue-50/50 rounded-xl border border-blue-100">
              <div className="text-center flex-1">
                <p className="text-[10px] text-blue-600 font-bold uppercase">Original quedará</p>
                <p className="text-sm font-bold text-gray-700">${(sale.amount - splitAmount).toLocaleString()}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-blue-300" />
              <div className="text-center flex-1">
                <p className="text-[10px] text-emerald-600 font-bold uppercase">Nuevo será</p>
                <p className="text-sm font-bold text-gray-700">${splitAmount.toLocaleString()}</p>
              </div>
            </div>

            {/* Method Select */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Método de Pago Alternativo</label>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.filter(m => m.value !== 0 && m.value !== sale.payment_method).map((m) => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.value}
                      onClick={() => setMethod(m.value)}
                      className={`flex items-center gap-2 p-3 rounded-xl border transition-all ${
                        method === m.value 
                        ? 'border-primary bg-primary/5 text-primary' 
                        : 'border-gray-100 bg-white text-gray-600 hover:border-gray-200'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-xs font-bold">{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Vendor Name (only if package) */}
            {method === 2 && (
              <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-200">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Nombre del Asesor</label>
                <input
                  type="text"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-sm"
                  placeholder="Quien hizo la venta?"
                />
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-xl text-xs font-medium border border-red-100 italic">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 text-sm font-bold text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={isSubmitting}
              className="flex-[2] bg-primary hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? 'Procesando...' : 'Confirmar División'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SplitPaymentModal;
