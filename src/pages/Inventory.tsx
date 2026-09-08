import React, { useState, useEffect } from 'react';
import { Card } from '../types';
import AddCardModal from '../components/AddCardModal';
import EditCardModal from '../components/EditCardModal';
import { Search, Filter, Download, Edit2, Trash2, CheckSquare, Square, X, ArrowRight, AlertTriangle } from 'lucide-react';
import { fetchApi } from '../lib/api';
import { supabase } from '../lib/supabase';

export default function Inventory() {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  // Multi-select
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<null | 'delete' | 'transfer-partner' | 'transfer-agency'>(null);
  // Bulk transfer state
  const [partners, setPartners] = useState<any[]>([]);
  const [agencies, setAgencies] = useState<any[]>([]);
  const [bulkPartnerId, setBulkPartnerId] = useState('');
  const [bulkAgencyId, setBulkAgencyId] = useState('');
  const [bulkSellingPrice, setBulkSellingPrice] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);

  const loadCards = async () => {
    setLoading(true);
    try {
      let url = `/cards?status=${statusFilter}&search=${searchTerm}&page=${page}&limit=50`;
      if (startDate) url += `&startDate=${startDate}`;
      if (endDate) url += `&endDate=${endDate}`;
      const result = await fetchApi(url) as { data: Card[], totalPages: number };
      setCards(result.data);
      setTotalPages(result.totalPages);
    } catch (error) {
      console.error("Failed to load cards", error);
    } finally {
      setLoading(false);
    }
  };

  const loadPartnersAndAgencies = async () => {
    const [p, a] = await Promise.all([fetchApi('/partners'), fetchApi('/agencies')]);
    setPartners(p || []);
    setAgencies(a || []);
  };

  useEffect(() => {
    loadCards();
    loadPartnersAndAgencies();
    const subscription = supabase
      .channel('inventory_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cards' }, () => loadCards())
      .subscribe();
    return () => { supabase.removeChannel(subscription); };
  }, [statusFilter, searchTerm, startDate, endDate, page]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === cards.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(cards.map(c => c.id)));
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setBulkAction(null);
    setBulkPartnerId('');
    setBulkAgencyId('');
    setBulkSellingPrice('');
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Supprimer définitivement ${selectedIds.size} cartes ?`)) return;
    setBulkLoading(true);
    try {
      await fetchApi('/cards/bulk-delete', { method: 'POST', body: JSON.stringify({ ids: Array.from(selectedIds) }) });
      clearSelection();
      loadCards();
    } catch (e) { alert("Erreur lors de la suppression"); }
    finally { setBulkLoading(false); }
  };

  const handleBulkTransferPartner = async () => {
    if (!bulkPartnerId || !bulkSellingPrice) return alert("Sélectionnez un partenaire et saisissez un prix de vente");
    setBulkLoading(true);
    try {
      await fetchApi('/cards/bulk-transfer-partner', {
        method: 'POST',
        body: JSON.stringify({ ids: Array.from(selectedIds), partnerId: bulkPartnerId, sellingPrice: Number(bulkSellingPrice) })
      });
      clearSelection();
      loadCards();
    } catch (e) { alert("Erreur lors du transfert"); }
    finally { setBulkLoading(false); }
  };

  const handleBulkTransferAgency = async () => {
    if (!bulkAgencyId) return alert("Sélectionnez une agence");
    setBulkLoading(true);
    try {
      await fetchApi('/cards/bulk-transfer-agency', {
        method: 'POST',
        body: JSON.stringify({ ids: Array.from(selectedIds), agencyId: bulkAgencyId })
      });
      clearSelection();
      loadCards();
    } catch (e) { alert("Erreur lors du transfert"); }
    finally { setBulkLoading(false); }
  };

  const handleExportCSV = () => {
    if (cards.length === 0) return;
    const csvContent = [
      ['Numéro', 'Valeur', 'Prix Achat', 'Banque', 'Date Entrée', 'Expiration', 'Statut'].join(','),
      ...cards.map(c => `${c.cardNumber},${c.value},${c.purchasePrice},${c.bankName},${new Date(c.entryDate).toLocaleDateString()},${new Date(c.expiryDate).toLocaleDateString()},${c.status}`)
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `inventaire_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const updateCardStatus = async (id: string, status: string, location?: string) => {
    try {
      await fetchApi(`/cards/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, location }) });
      loadCards();
    } catch { alert("Erreur lors de la mise à jour"); }
  };

  const deleteCard = async (id: string) => {
    if (!window.confirm("Supprimer cette carte définitivement ?")) return;
    try {
      await fetchApi(`/cards/${id}`, { method: 'DELETE' });
      loadCards();
    } catch { alert("Erreur lors de la suppression"); }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in_stock': return 'bg-green-100 text-green-800';
      case 'with_partner': return 'bg-blue-100 text-blue-800';
      case 'sold': return 'bg-gray-100 text-gray-800';
      case 'activated': return 'bg-purple-100 text-purple-800';
      case 'expired': return 'bg-red-100 text-red-800';
      case 'defective': return 'bg-orange-100 text-orange-800';
      case 'lost': return 'bg-gray-800 text-white';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'in_stock': return 'En Stock';
      case 'with_partner': return 'Chez Partenaire';
      case 'sold': return 'Vendue';
      case 'activated': return 'Activée';
      case 'expired': return 'Expirée';
      case 'defective': return 'Défectueuse';
      case 'lost': return 'Perdue';
      default: return status;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Gestion du Stock</h1>
        <div className="flex gap-2 w-full sm:w-auto">
          <button onClick={handleExportCSV} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2">
            <Download size={18} /> Exporter
          </button>
          <button onClick={() => setIsModalOpen(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors">
            + Nouveau Retrait Banque
          </button>
        </div>
      </div>

      {/* Bulk Action Banner */}
      {selectedIds.size > 0 && (
        <div className="bg-indigo-700 text-white rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-3 flex-1">
            <CheckSquare size={20} />
            <span className="font-semibold">{selectedIds.size} carte(s) sélectionnée(s)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setBulkAction('delete')} className="px-3 py-1.5 bg-red-500 hover:bg-red-600 rounded-lg text-sm font-medium flex items-center gap-1">
              <Trash2 size={14} /> Supprimer
            </button>
            <button onClick={() => setBulkAction('transfer-partner')} className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium flex items-center gap-1">
              <ArrowRight size={14} /> → Partenaire
            </button>
            <button onClick={() => setBulkAction('transfer-agency')} className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium flex items-center gap-1">
              <ArrowRight size={14} /> → Agence
            </button>
            <button onClick={clearSelection} className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Bulk Action Form */}
      {bulkAction === 'delete' && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-red-700">
            <AlertTriangle size={20} />
            <span className="font-medium">Supprimer définitivement {selectedIds.size} cartes ?</span>
          </div>
          <div className="flex gap-2">
            <button onClick={handleBulkDelete} disabled={bulkLoading} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
              {bulkLoading ? 'Suppression...' : 'Confirmer'}
            </button>
            <button onClick={() => setBulkAction(null)} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm">Annuler</button>
          </div>
        </div>
      )}

      {bulkAction === 'transfer-partner' && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-40">
            <label className="text-xs font-medium text-gray-600 block mb-1">Partenaire</label>
            <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={bulkPartnerId} onChange={e => setBulkPartnerId(e.target.value)}>
              <option value="">-- Choisir --</option>
              {partners.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-40">
            <label className="text-xs font-medium text-gray-600 block mb-1">Prix de vente (GNF)</label>
            <input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={bulkSellingPrice} onChange={e => setBulkSellingPrice(e.target.value)} placeholder="Ex: 500000" />
          </div>
          <button onClick={handleBulkTransferPartner} disabled={bulkLoading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {bulkLoading ? 'Transfert...' : `Transférer ${selectedIds.size} cartes`}
          </button>
          <button onClick={() => setBulkAction(null)} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm">Annuler</button>
        </div>
      )}

      {bulkAction === 'transfer-agency' && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-40">
            <label className="text-xs font-medium text-gray-600 block mb-1">Agence</label>
            <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={bulkAgencyId} onChange={e => setBulkAgencyId(e.target.value)}>
              <option value="">-- Choisir --</option>
              {agencies.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <button onClick={handleBulkTransferAgency} disabled={bulkLoading} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {bulkLoading ? 'Transfert...' : `Transférer ${selectedIds.size} cartes`}
          </button>
          <button onClick={() => setBulkAction(null)} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm">Annuler</button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input type="text" placeholder="Rechercher par numéro..." className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setPage(1); }} />
            </div>
            <div className="flex items-center gap-2">
              <Filter size={18} className="text-gray-400 shrink-0" />
              <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
                <option value="all">Tous les statuts</option>
                <option value="in_stock">En Stock</option>
                <option value="with_partner">Chez Partenaire</option>
                <option value="sold">Vendue</option>
                <option value="expired">Expirée</option>
                <option value="defective">Défectueuse</option>
                <option value="lost">Perdue</option>
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <span className="text-sm text-gray-500 font-medium">Entrée Du :</span>
            <input type="date" className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={startDate} onChange={e => { setStartDate(e.target.value); setPage(1); }} />
            <span className="text-sm text-gray-500 font-medium">Au :</span>
            <input type="date" className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={endDate} min={startDate} onChange={e => { setEndDate(e.target.value); setPage(1); }} />
            {(startDate || endDate) && (
              <button onClick={() => { setStartDate(''); setEndDate(''); setPage(1); }} className="text-xs text-gray-500 hover:text-red-500 underline">Effacer dates</button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-3 w-10">
                  <button onClick={toggleSelectAll} className="text-gray-400 hover:text-indigo-600">
                    {selectedIds.size === cards.length && cards.length > 0 ? <CheckSquare size={18} className="text-indigo-600" /> : <Square size={18} />}
                  </button>
                </th>
                <th className="px-4 py-3 font-medium">Numéro</th>
                <th className="px-4 py-3 font-medium">Valeur</th>
                <th className="px-4 py-3 font-medium">Prix Achat</th>
                <th className="px-4 py-3 font-medium">Banque</th>
                <th className="px-4 py-3 font-medium">Date Entrée</th>
                <th className="px-4 py-3 font-medium">Expiration</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={9} className="px-6 py-8 text-center text-gray-500">Chargement...</td></tr>
              ) : cards.length === 0 ? (
                <tr><td colSpan={9} className="px-6 py-8 text-center text-gray-500">Aucune carte trouvée</td></tr>
              ) : (
                cards.map(card => (
                  <tr key={card.id} className={`hover:bg-gray-50 transition-colors ${selectedIds.has(card.id) ? 'bg-indigo-50' : ''}`}>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleSelect(card.id)} className="text-gray-400 hover:text-indigo-600">
                        {selectedIds.has(card.id) ? <CheckSquare size={18} className="text-indigo-600" /> : <Square size={18} />}
                      </button>
                    </td>
                    <td className="px-4 py-3 font-mono font-medium text-gray-900">{card.cardNumber}</td>
                    <td className="px-4 py-3 font-semibold text-indigo-600">{card.value?.toLocaleString()} GNF</td>
                    <td className="px-4 py-3 text-gray-500">{card.purchasePrice?.toLocaleString()} GNF</td>
                    <td className="px-4 py-3">{card.bankName}</td>
                    <td className="px-4 py-3">{new Date(card.entryDate).toLocaleDateString('fr-FR')}</td>
                    <td className="px-4 py-3">{new Date(card.expiryDate).toLocaleDateString('fr-FR')}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(card.status)}`}>
                        {getStatusLabel(card.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <select className="text-xs border border-gray-200 rounded p-1 bg-white" onChange={e => { if (e.target.value) { const [s, l] = e.target.value.split('|'); updateCardStatus(card.id, s, l); e.target.value = ""; } }} defaultValue="">
                          <option value="" disabled>Action...</option>
                          {card.status !== 'in_stock' && <option value="in_stock|main_stock">Retour au stock</option>}
                          {card.status !== 'defective' && <option value="defective|main_stock">Défectueuse</option>}
                          {card.status !== 'lost' && <option value="lost|main_stock">Perdue</option>}
                        </select>
                        <button onClick={() => { setSelectedCard(card); setIsEditModalOpen(true); }} className="p-1 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded" title="Modifier">
                          <Edit2 size={15} />
                        </button>
                        <button onClick={() => deleteCard(card.id)} className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded" title="Supprimer">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && totalPages > 1 && (
          <div className="p-4 border-t border-gray-100 flex items-center justify-between">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border border-gray-200 rounded text-sm disabled:opacity-50">Précédent</button>
            <span className="text-sm text-gray-600">Page {page} sur {totalPages}</span>
            <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border border-gray-200 rounded text-sm disabled:opacity-50">Suivant</button>
          </div>
        )}
      </div>

      <AddCardModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); loadCards(); }} />
      <EditCardModal isOpen={isEditModalOpen} onClose={() => { setIsEditModalOpen(false); loadCards(); }} card={selectedCard} />
    </div>
  );
}
