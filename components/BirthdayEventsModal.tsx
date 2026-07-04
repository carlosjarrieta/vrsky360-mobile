import React, { useState, useEffect } from 'react';
import { X, Cake, Plus, Trash2, Check, List } from 'lucide-react';
import { BirthdayEventInput } from '../types';
import { registerBirthdayEvents, AuthError } from '../services/api';

const todayISO = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

interface BirthdayEventsModalProps {
  isOpen: boolean;
  token: string;
  onClose: () => void;
  onAuthError: () => void;
  onShowList: () => void;
}

interface Row {
  children: string;
  responsible: string;
}

const emptyRow = (): Row => ({ children: '', responsible: '' });

// Registration-only modal. The list of registered events, pending tickets and
// edit/delete actions live in BirthdayListView (full page, reachable via onShowList).
const BirthdayEventsModal: React.FC<BirthdayEventsModalProps> = ({ isOpen, token, onClose, onAuthError, onShowList }) => {
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [eventDate, setEventDate] = useState<string>(todayISO());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      setRows([emptyRow()]);
      setEventDate(todayISO());
      setError('');
      setSuccessMessage('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const updateRow = (index: number, field: keyof Row, value: string) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  };

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);
  const removeRow = (index: number) => setRows((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));

  const totalChildren = rows.reduce((sum, r) => sum + (parseInt(r.children, 10) || 0), 0);

  const handleSubmit = async () => {
    setError('');
    setSuccessMessage('');
    const events: BirthdayEventInput[] = rows
      .map((r) => ({
        children_count: parseInt(r.children, 10) || 0,
        responsible_name: r.responsible.trim() || undefined,
        event_date: eventDate,
      }))
      .filter((e) => e.children_count > 0);

    if (events.length === 0) {
      setError('Ingresa el número de niños de al menos un evento.');
      return;
    }

    setSaving(true);
    try {
      await registerBirthdayEvents(token, events);
      setRows([emptyRow()]);
      setSuccessMessage(`Registrado: ${events.reduce((s, e) => s + e.children_count, 0)} niños.`);
    } catch (err) {
      if (err instanceof AuthError) {
        onAuthError();
        return;
      }
      setError((err as Error).message || 'No se pudieron registrar los cumpleaños.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-primary px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2 text-white">
            <Cake className="w-5 h-5" />
            <h2 className="text-lg font-bold">Registrar Cumpleaños</h2>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          <p className="text-xs text-gray-500 leading-tight">
            Registra los paquetes de cumpleaños vendidos. Elige la fecha del cumpleaños e indica cuántos niños se vendieron por evento; el responsable es opcional.
          </p>

          {/* Celebration date — applies to all events in this batch */}
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Fecha del cumpleaños</label>
            <input
              type="date"
              value={eventDate}
              max={todayISO()}
              onChange={(e) => setEventDate(e.target.value)}
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-sm font-medium"
            />
          </div>

          {/* Dynamic rows */}
          <div className="space-y-3">
            {rows.map((row, index) => (
              <div key={index} className="flex gap-2 items-end">
                <div className="w-24">
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Niños *</label>
                  <input
                    type="number"
                    min="1"
                    inputMode="numeric"
                    value={row.children}
                    onChange={(e) => updateRow(index, 'children', e.target.value)}
                    placeholder="30"
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-sm font-medium"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Responsable</label>
                  <input
                    type="text"
                    value={row.responsible}
                    onChange={(e) => updateRow(index, 'responsible', e.target.value)}
                    placeholder="Opcional"
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-sm"
                  />
                </div>
                <button
                  onClick={() => removeRow(index)}
                  disabled={rows.length === 1}
                  className="mb-0.5 p-2.5 rounded-xl text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                  aria-label="Eliminar evento"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={addRow}
            className="flex items-center gap-1.5 text-primary font-semibold text-sm hover:underline"
          >
            <Plus className="w-4 h-4" /> Agregar otro evento
          </button>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {successMessage && (
            <p className="flex items-center gap-1.5 text-sm text-emerald-600 font-semibold">
              <Check className="w-4 h-4" /> {successMessage}
            </p>
          )}

          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-70"
          >
            {saving ? 'Guardando...' : `Registrar ${totalChildren > 0 ? `(${totalChildren} niños)` : ''}`}
          </button>

          <button
            onClick={onShowList}
            className="w-full flex items-center justify-center gap-2 border border-gray-200 text-gray-700 hover:bg-gray-50 font-semibold py-2.5 rounded-xl transition-all text-sm"
          >
            <List className="w-4 h-4" /> Ver cumpleaños registrados
          </button>
        </div>
      </div>
    </div>
  );
};

export default BirthdayEventsModal;
