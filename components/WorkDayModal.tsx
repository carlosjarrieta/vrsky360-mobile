import React, { useState, useEffect } from 'react';
import { X, Clock, Calculator, Banknote, ArrowRight } from 'lucide-react';

interface WorkDayModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalCash: number;
}

const WorkDayModal: React.FC<WorkDayModalProps> = ({ isOpen, onClose, totalCash }) => {
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [calculations, setCalculations] = useState({
    hours: 0,
    payment: 0,
    toConsign: 0
  });

  const HOURLY_RATE = 7000;

  const parseTime = (timeStr: string) => {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const roundTime = (totalMinutes: number, interval: number, direction: 'floor' | 'ceil') => {
    const remainder = totalMinutes % interval;
    if (remainder === 0) return totalMinutes;
    
    if (direction === 'floor') {
      return totalMinutes - remainder;
    } else {
      return totalMinutes + (interval - remainder);
    }
  };

  useEffect(() => {
    if (!startTime || !endTime) {
      setCalculations({ hours: 0, payment: 0, toConsign: totalCash });
      return;
    }

    let startMinutes = parseTime(startTime);
    let endMinutes = parseTime(endTime);

    // Rounding rules: Entry floor 30, Exit ceil 30
    startMinutes = roundTime(startMinutes, 30, 'floor');
    endMinutes = roundTime(endMinutes, 30, 'ceil');

    let diffMinutes = endMinutes - startMinutes;
    if (diffMinutes < 0) diffMinutes += 24 * 60;

    const hours = diffMinutes / 60;
    const payment = hours * HOURLY_RATE;
    const toConsign = totalCash - payment;

    setCalculations({
      hours,
      payment,
      toConsign
    });
  }, [startTime, endTime, totalCash]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="bg-primary px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2 text-white">
            <Calculator className="w-5 h-5" />
            <h2 className="text-lg font-bold">Liquidación de Jornada</h2>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Inputs Section */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Hora Entrada</label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-sm font-medium"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Hora Salida</label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-sm font-medium"
                />
              </div>
            </div>
          </div>

          {/* Results Area */}
          <div className="bg-gray-50 rounded-2xl p-4 space-y-4 border border-gray-100">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">Horas trabajadas:</span>
              <span className="font-bold text-primary">{calculations.hours} h</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">Valor Pago Asesor:</span>
              <span className="font-bold text-red-600">-${calculations.payment.toLocaleString('en-US')}</span>
            </div>
            
            <div className="h-px bg-gray-200 my-2" />
            
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-gray-400 uppercase">Efectivo en Caja</span>
                <span className="text-sm font-medium text-gray-800">${totalCash.toLocaleString('en-US')}</span>
              </div>
              <div className="flex justify-items-center gap-2 items-center py-2">
                <div className="flex-1 h-px bg-gray-200"></div>
                <ArrowRight className="w-4 h-4 text-gray-300" />
                <div className="flex-1 h-px bg-gray-200"></div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-gray-700">Total a Consignar</span>
                <span className="text-xl font-black text-emerald-600">
                  ${calculations.toConsign.toLocaleString('en-US')}
                </span>
              </div>
            </div>
          </div>

          <p className="text-[10px] text-gray-400 text-center leading-tight">
            * El valor de la hora está fijado en $7,000 COP.<br/>
            * Entrada redondeada hacia abajo y salida hacia arriba (cada 30 min).
          </p>

          <button
            onClick={onClose}
            className="w-full bg-primary hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all shadow-md active:scale-95"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkDayModal;
