import React, { useState, useEffect, useCallback } from 'react';
import { X, Cake, Plus, Trash2, Check, Pencil } from 'lucide-react';
import { BirthdayEvent, BirthdayEventInput, BirthdayDaySummary } from '../types';
import { fetchBirthdayEvents, registerBirthdayEvents, updateBirthdayEvent, deleteBirthdayEvent, AuthError } from '../services/api';

const formatEventDate = (iso: string): string => {
  const [y, m, d] = iso.split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
};

const todayISO = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

interface BirthdayEventsModalProps {
  isOpen: boolean;
  token: string;
  onClose: () => void;
  onAuthError: () => void;
}

interface Row {
  children: string;
  responsible: string;
}

const emptyRow = (): Row => ({ children: '', responsible: '' });

const BirthdayEventsModal: React.FC<BirthdayEventsModalProps> = ({ isOpen, token, onClose, onAuthError }) => {
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [eventDate, setEventDate] = useState<string>(todayISO());
  const [todayEvents, setTodayEvents] = useState<BirthdayEvent[]>([]);
  const [daySummaries, setDaySummaries] = useState<BirthdayDaySummary[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // Deletion flow (asks for a mandatory reason before removing).
  const [eventToDelete, setEventToDelete] = useState<BirthdayEvent | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  // Edit flow.
  const [eventToEdit, setEventToEdit] = useState<BirthdayEvent | null>(null);
  const [editChildren, setEditChildren] = useState('');
  const [editResponsible, setEditResponsible] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState('');

  const loadToday = useCallback(async () => {
    try {
      const { events, summary } = await fetchBirthdayEvents(token);
      setTodayEvents(events);
      setDaySummaries(summary);
    } catch (err) {
      if (err instanceof AuthError) {
        onAuthError();
        return;
      }
      // Non-fatal: keep the form usable even if the list fails to load.
      console.error('Failed to load birthday events', err);
    }
  }, [token, onAuthError]);

  useEffect(() => {
    if (isOpen) {
      setRows([emptyRow()]);
      setEventDate(todayISO());
      setError('');
      loadToday();
    }
  }, [isOpen, loadToday]);

  if (!isOpen) return null;

  const updateRow = (index: number, field: keyof Row, value: string) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  };

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);
  const removeRow = (index: number) => setRows((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));

  const totalChildren = rows.reduce((sum, r) => sum + (parseInt(r.children, 10) || 0), 0);

  const handleSubmit = async () => {
    setError('');
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
      await loadToday();
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

  const openDelete = (ev: BirthdayEvent) => {
    setEventToDelete(ev);
    setDeleteReason('');
    setDeleteError('');
  };

  const handleConfirmDelete = async () => {
    if (!eventToDelete) return;
    const reason = deleteReason.trim();
    if (!reason) {
      setDeleteError('Indica la razón para eliminar.');
      return;
    }

    setDeleting(true);
    try {
      await deleteBirthdayEvent(token, eventToDelete.id, reason);
      setEventToDelete(null);
      setDeleteReason('');
      await loadToday();
    } catch (err) {
      if (err instanceof AuthError) {
        onAuthError();
        return;
      }
      setDeleteError((err as Error).message || 'No se pudo eliminar el evento.');
    } finally {
      setDeleting(false);
    }
  };

  const openEdit = (ev: BirthdayEvent) => {
    setEventToEdit(ev);
    setEditChildren(String(ev.children_count));
    setEditResponsible(ev.responsible_name || '');
    setEditDate(ev.event_date);
    setEditError('');
  };

  const handleConfirmEdit = async () => {
    if (!eventToEdit) return;
    const children = parseInt(editChildren, 10) || 0;
    if (children <= 0) {
      setEditError('El número de niños debe ser mayor a 0.');
      return;
    }

    setEditing(true);
    try {
      await updateBirthdayEvent(token, eventToEdit.id, {
        children_count: children,
        responsible_name: editResponsible.trim() || undefined,
        event_date: editDate || undefined,
      });
      setEventToEdit(null);
      await loadToday();
    } catch (err) {
      if (err instanceof AuthError) {
        onAuthError();
        return;
      }
      setEditError((err as Error).message || 'No se pudo actualizar el evento.');
    } finally {
      setEditing(false);
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

          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-70"
          >
            {saving ? 'Guardando...' : `Registrar ${totalChildren > 0 ? `(${totalChildren} niños)` : ''}`}
          </button>

          {/* Pending tickets per day — updates as children ride */}
          {daySummaries.some((s) => s.registered > 0) && (
            <div className="pt-2">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Tickets por canjear</h3>
              <div className="space-y-1.5">
                {daySummaries.filter((s) => s.registered > 0).map((s) => (
                  <div key={s.date} className="flex justify-between items-center bg-gray-50 rounded-lg px-3 py-2 text-sm border border-gray-100 gap-2">
                    <div className="min-w-0">
                      <div className="text-[11px] text-gray-400">{formatEventDate(s.date)}</div>
                      <div className="text-gray-600 text-xs">
                        {s.redeemed}/{s.registered} canjeados
                      </div>
                    </div>
                    {s.pending > 0 ? (
                      <span className="shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                        {s.reconciled ? 'Faltaron' : 'Faltan'} {s.pending}
                      </span>
                    ) : (
                      <span className="shrink-0 flex items-center gap-1 text-emerald-600 text-xs font-semibold">
                        <Check className="w-3.5 h-3.5" /> Todos canjeados
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Today's registered events */}
          {todayEvents.length > 0 && (
            <div className="pt-2">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Últimos registros</h3>
              <div className="space-y-1.5">
                {todayEvents.map((ev) => (
                  <div key={ev.id} className="flex justify-between items-center bg-gray-50 rounded-lg px-3 py-2 text-sm border border-gray-100 gap-2">
                    <div className="min-w-0">
                      <div className="text-gray-700 truncate">
                        <span className="font-bold">{ev.children_count}</span> niños
                        {ev.responsible_name ? ` · ${ev.responsible_name}` : ''}
                      </div>
                      <div className="text-[11px] text-gray-400">{formatEventDate(ev.event_date)}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {ev.reconciled ? (
                        <span className="flex items-center gap-1 text-emerald-600 text-xs font-semibold">
                          <Check className="w-3.5 h-3.5" /> Conciliado
                        </span>
                      ) : (
                        <>
                          <button
                            onClick={() => openEdit(ev)}
                            className="p-1.5 rounded-lg text-primary hover:bg-blue-50 transition-colors"
                            aria-label="Editar evento"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openDelete(ev)}
                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                            aria-label="Eliminar evento"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit sub-modal */}
      {eventToEdit && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-primary px-5 py-3 flex items-center gap-2 text-white">
              <Pencil className="w-5 h-5" />
              <h3 className="text-base font-bold">Editar evento</h3>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Niños *</label>
                <input
                  type="number"
                  min="1"
                  inputMode="numeric"
                  value={editChildren}
                  onChange={(e) => setEditChildren(e.target.value)}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-sm font-medium"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Fecha del cumpleaños</label>
                <input
                  type="date"
                  value={editDate}
                  max={todayISO()}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-sm font-medium"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Responsable</label>
                <input
                  type="text"
                  value={editResponsible}
                  onChange={(e) => setEditResponsible(e.target.value)}
                  placeholder="Opcional"
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-sm"
                />
              </div>
              {editError && <p className="text-sm text-red-600">{editError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={() => setEventToEdit(null)}
                  disabled={editing}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 rounded-xl transition-all disabled:opacity-70"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmEdit}
                  disabled={editing}
                  className="flex-1 bg-primary hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl transition-all active:scale-95 disabled:opacity-70"
                >
                  {editing ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete reason sub-modal */}
      {eventToDelete && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-red-600 px-5 py-3 flex items-center gap-2 text-white">
              <Trash2 className="w-5 h-5" />
              <h3 className="text-base font-bold">Eliminar evento</h3>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-600">
                Vas a eliminar el evento de <span className="font-bold">{eventToDelete.children_count} niños</span>
                {eventToDelete.responsible_name ? ` (${eventToDelete.responsible_name})` : ''}. Indica la razón:
              </p>
              <textarea
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                rows={3}
                placeholder="Ej: registrado por error, evento cancelado..."
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all text-sm"
                autoFocus
              />
              {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={() => setEventToDelete(null)}
                  disabled={deleting}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 rounded-xl transition-all disabled:opacity-70"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={deleting}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-xl transition-all active:scale-95 disabled:opacity-70"
                >
                  {deleting ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BirthdayEventsModal;
