import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft, Cake, Search, Check, Pencil, Trash2, Loader2, Calendar } from 'lucide-react';
import { BirthdayEvent, BirthdayDaySummary } from '../types';
import { fetchBirthdayEvents, updateBirthdayEvent, deleteBirthdayEvent, AuthError } from '../services/api';

const formatEventDate = (iso: string): string => {
  const [y, m, d] = iso.split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
};

const toISO = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const todayISO = (): string => toISO(new Date());

const startOfMonthISO = (): string => {
  const d = new Date();
  d.setDate(1);
  return toISO(d);
};

interface BirthdayListViewProps {
  token: string;
  onBack: () => void;
  onAuthError: () => void;
}

// Full-page list of registered birthday events with search, date range,
// pending-tickets summary and edit/delete for events not yet reconciled.
const BirthdayListView: React.FC<BirthdayListViewProps> = ({ token, onBack, onAuthError }) => {
  const [events, setEvents] = useState<BirthdayEvent[]>([]);
  const [daySummaries, setDaySummaries] = useState<BirthdayDaySummary[]>([]);
  const [startDate, setStartDate] = useState(startOfMonthISO());
  const [endDate, setEndDate] = useState(todayISO());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
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

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const { events: data, summary } = await fetchBirthdayEvents(token, startDate, endDate);
      setEvents(data);
      setDaySummaries(summary);
    } catch (err) {
      if (err instanceof AuthError) {
        onAuthError();
        return;
      }
      setLoadError((err as Error).message || 'No se pudieron cargar los cumpleaños.');
    } finally {
      setLoading(false);
    }
  }, [token, startDate, endDate, onAuthError]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const filteredEvents = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return events;
    return events.filter((ev) =>
      (ev.responsible_name || '').toLowerCase().includes(term) ||
      formatEventDate(ev.event_date).includes(term) ||
      String(ev.children_count).includes(term)
    );
  }, [events, search]);

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
      await loadEvents();
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
      await loadEvents();
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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Page header with back arrow */}
      <header className="bg-primary text-white sticky top-0 z-30 shadow-md">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors"
            aria-label="Regresar"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2">
            <Cake className="w-5 h-5" />
            <h1 className="text-lg font-bold">Cumpleaños</h1>
          </div>
        </div>
      </header>

      <main className="flex-grow container mx-auto px-4 py-6 space-y-6 max-w-2xl">
        {/* Search + date range */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por responsable, fecha o niños..."
              className="w-full pl-10 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-sm"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Desde</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  value={startDate}
                  max={endDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full pl-9 pr-2 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm"
                />
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Hasta</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  max={todayISO()}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full pl-9 pr-2 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {loadError && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md flex items-center justify-between gap-3">
            <p className="text-sm text-red-700 font-medium">{loadError}</p>
            <button onClick={loadEvents} className="text-sm font-semibold text-red-700 underline whitespace-nowrap">
              Reintentar
            </button>
          </div>
        )}

        {/* Pending tickets per day. Reconciled days are excluded: their gap was
            already billed via the venta global, so nothing is redeemable there. */}
        {daySummaries.some((s) => s.pending > 0 && !s.reconciled) && (
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Tickets por canjear</h3>
            <div className="space-y-1.5">
              {daySummaries.filter((s) => s.pending > 0 && !s.reconciled).map((s) => (
                <div key={s.date} className="flex justify-between items-center bg-white rounded-lg px-3 py-2 text-sm border border-gray-100 gap-2 shadow-sm">
                  <div className="min-w-0">
                    <div className="text-[11px] text-gray-400">{formatEventDate(s.date)}</div>
                    <div className="text-gray-600 text-xs">
                      {s.redeemed}/{s.registered} canjeados
                    </div>
                  </div>
                  <span className="shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                    Faltan {s.pending}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Registered events */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Registros</h3>
            <span className="text-xs text-gray-400">{filteredEvents.length} evento(s)</span>
          </div>

          {loading ? (
            <div className="flex justify-center py-10 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : filteredEvents.length > 0 ? (
            <div className="space-y-1.5">
              {filteredEvents.map((ev) => (
                <div key={ev.id} className="flex justify-between items-center bg-white rounded-lg px-3 py-2.5 text-sm border border-gray-100 gap-2 shadow-sm">
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
          ) : (
            <div className="bg-white rounded-lg border border-gray-100 px-3 py-8 text-center text-sm text-gray-400">
              {search.trim() ? 'Sin resultados para la búsqueda.' : 'Sin cumpleaños registrados en este periodo.'}
            </div>
          )}
        </div>
      </main>

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

export default BirthdayListView;
