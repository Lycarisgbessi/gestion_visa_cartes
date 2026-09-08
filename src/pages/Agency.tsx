import React, { useState, useEffect } from 'react';
import { Agency as AgencyType } from '../types';
import AddAgencyModal from '../components/AddAgencyModal';
import TransferToAgencyModal from '../components/TransferToAgencyModal';
import AgencySaleModal from '../components/AgencySaleModal';
import AgencyDetailsModal from '../components/AgencyDetailsModal';
import { Store, ShoppingCart, Info, ArrowRightLeft, Eye, Trash2, AlertTriangle } from 'lucide-react';
import { fetchApi } from '../lib/api';
import { supabase } from '../lib/supabase';

export default function Agency() {
  const [agencies, setAgencies] = useState<AgencyType[]>([]);
  const [agencyStocks, setAgencyStocks] = useState<Record<string, Record<number, number>>>({});
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedAgency, setSelectedAgency] = useState<AgencyType | null>(null);
  const [deleteConfirmAgency, setDeleteConfirmAgency] = useState<AgencyType | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadAgencies = async () => {
    try {
      const data = await fetchApi('/agencies');
      setAgencies(data);
      const stocksData = await fetchApi('/agencies/stock');
      setAgencyStocks(stocksData);
    } catch (error) {
      console.error("Failed to load agencies", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAgencies();
    const agenciesSub = supabase
      .channel('agencies_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agencies' }, () => loadAgencies())
      .subscribe();
    const cardsSub = supabase
      .channel('agencies_cards_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cards' }, () => loadAgencies())
      .subscribe();
    return () => { supabase.removeChannel(agenciesSub); supabase.removeChannel(cardsSub); };
  }, []);

  const handleTransfer = (agency: AgencyType) => { setSelectedAgency(agency); setIsTransferModalOpen(true); };
  const handleSale = (agency: AgencyType) => { setSelectedAgency(agency); setIsSaleModalOpen(true); };
  const handleDetails = (agency: AgencyType) => { setSelectedAgency(agency); setIsDetailsModalOpen(true); };

  const handleModalClose = () => {
    setIsAddModalOpen(false);
    setIsTransferModalOpen(false);
    setIsSaleModalOpen(false);
    loadAgencies();
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmAgency) return;
    setDeleting(true);
    try {
      await fetchApi(`/agencies/${deleteConfirmAgency.id}`, { method: 'DELETE' });
      setDeleteConfirmAgency(null);
      loadAgencies();
    } catch (err) {
      console.error("Delete failed", err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
        <div className="flex items-start">
          <Info className="text-blue-500 mt-0.5 mr-3 shrink-0" size={20} />
          <div>
            <h3 className="text-sm font-bold text-blue-800">Gestion des Agences</h3>
            <p className="text-sm text-blue-700 mt-1">
              Utilisez <strong>Approvisionner</strong> pour transférer des cartes depuis le stock principal,
              puis enregistrez chaque <strong>Vente</strong> réalisée au comptoir.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agences</h1>
          <p className="text-sm text-gray-500 mt-0.5">{agencies.length} agence(s) enregistrée(s)</p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl hover:bg-indigo-700 transition-colors font-medium text-sm shadow-sm"
        >
          + Nouvelle Agence
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-16">
          <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : agencies.length === 0 ? (
        <div className="bg-white p-12 rounded-xl shadow-sm border border-gray-100 text-center text-gray-500">
          <Store size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="font-medium">Aucune agence enregistrée</p>
          <p className="text-sm mt-1">Créez votre première agence pour commencer.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {agencies.map((agency) => {
            const stock = agencyStocks[agency.id] || {};
            const totalCards = Object.values(stock).reduce((a: number, b) => a + (b as number), 0);
            return (
              <div key={agency.id} className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="p-5">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 bg-indigo-50 rounded-xl flex items-center justify-center">
                        <Store className="text-indigo-600" size={22} />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">{agency.name}</h3>
                        {agency.address && <p className="text-sm text-gray-400 mt-0.5">{agency.address}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleDetails(agency)}
                        className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Voir l'historique complet">
                        <Eye size={18} />
                      </button>
                      <button onClick={() => setDeleteConfirmAgency(agency)}
                        className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Supprimer l'agence">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Stock display */}
                  <div className="bg-gray-50 rounded-xl p-3 mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-semibold text-gray-500 uppercase">Stock actuel</span>
                      <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full">{totalCards} carte(s)</span>
                    </div>
                    {totalCards === 0 ? (
                      <p className="text-xs text-gray-400 italic">Aucun stock — approvisionner d'abord</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-1.5">
                        {Object.entries(stock).map(([value, count]) => (count as number) > 0 && (
                          <div key={value} className="flex justify-between text-xs">
                            <span className="text-gray-500">{Number(value).toLocaleString()} GNF</span>
                            <span className="font-bold text-gray-900">{count as number}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button onClick={() => handleTransfer(agency)}
                      className="flex-1 py-2 bg-indigo-50 text-indigo-700 text-sm font-medium rounded-lg hover:bg-indigo-100 transition-colors flex items-center justify-center gap-1.5">
                      <ArrowRightLeft size={15} /> Approvisionner
                    </button>
                    <button onClick={() => handleSale(agency)}
                      className="flex-1 py-2 bg-green-50 text-green-700 text-sm font-medium rounded-lg hover:bg-green-100 transition-colors flex items-center justify-center gap-1.5">
                      <ShoppingCart size={15} /> Vendre
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirmAgency && (
        <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center">
                <AlertTriangle className="text-red-500" size={24} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Supprimer l'agence ?</h3>
                <p className="text-sm text-gray-500">{deleteConfirmAgency.name}</p>
              </div>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-5 text-sm text-orange-800">
              ⚠ Les cartes en stock dans cette agence seront retournées au stock principal. Tout l'historique des ventes et transferts sera supprimé.
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirmAgency(null)}
                className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 text-sm font-medium">
                Annuler
              </button>
              <button onClick={handleDeleteConfirm} disabled={deleting}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 text-sm font-medium">
                {deleting ? 'Suppression...' : 'Supprimer définitivement'}
              </button>
            </div>
          </div>
        </div>
      )}

      <AddAgencyModal isOpen={isAddModalOpen} onClose={handleModalClose} />
      <TransferToAgencyModal isOpen={isTransferModalOpen} onClose={handleModalClose} agency={selectedAgency} />
      <AgencySaleModal isOpen={isSaleModalOpen} onClose={handleModalClose} agency={selectedAgency} />
      <AgencyDetailsModal isOpen={isDetailsModalOpen} onClose={() => setIsDetailsModalOpen(false)} agency={selectedAgency} />
    </div>
  );
}
