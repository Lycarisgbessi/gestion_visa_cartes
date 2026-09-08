import React, { useState, useEffect } from 'react';
import { Partner } from '../types';
import AddPartnerModal from '../components/AddPartnerModal';
import DistributeCardsModal from '../components/DistributeCardsModal';
import PaymentModal from '../components/PaymentModal';
import PartnerDetailsModal from '../components/PartnerDetailsModal';
// import { supabase } from '../lib/supabase';
import { Phone, User, Info, Eye, Trash2, AlertTriangle } from 'lucide-react';
import { fetchApi } from '../lib/api';

export default function Partners() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [isDistributeModalOpen, setIsDistributeModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  // Delete confirmation
  const [deleteConfirmPartner, setDeleteConfirmPartner] = useState<Partner | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadPartners = async () => {
    try {
      const data = await fetchApi('/partners');
      setPartners(data);
    } catch (error) {
      console.error("Failed to load partners", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPartners();
    const intervalId = setInterval(() => {
      loadPartners();
    }, 10000);

    return () => clearInterval(intervalId);
  }, []);

  const handleDistribute = (partner: Partner) => { setSelectedPartner(partner); setIsDistributeModalOpen(true); };
  const handlePayment = (partner: Partner) => { setSelectedPartner(partner); setIsPaymentModalOpen(true); };
  const handleDetails = (partner: Partner) => { setSelectedPartner(partner); setIsDetailsModalOpen(true); };

  const handleModalClose = () => {
    setIsAddModalOpen(false);
    setIsDistributeModalOpen(false);
    setIsPaymentModalOpen(false);
    setIsDetailsModalOpen(false);
    loadPartners();
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmPartner) return;
    setDeleting(true);
    try {
      await fetchApi(`/partners/${deleteConfirmPartner.id}`, { method: 'DELETE' });
      setDeleteConfirmPartner(null);
      loadPartners();
    } catch (err) {
      console.error("Delete failed", err);
    } finally {
      setDeleting(false);
    }
  };

  const remaining = (partner: Partner) => partner.totalDebt - partner.totalPaid;

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
        <div className="flex items-start">
          <Info className="text-blue-500 mt-0.5 mr-3 shrink-0" size={20} />
          <div>
            <h3 className="text-sm font-bold text-blue-800">Gestion des Partenaires</h3>
            <p className="text-sm text-blue-700 mt-1">
              Utilisez <strong>Donner Cartes</strong> pour confier du stock (crée une dette), 
              <strong> Encaisser</strong> pour les paiements, et <strong>Détails</strong> pour voir l'historique complet par période.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Partenaires</h1>
          <p className="text-sm text-gray-500 mt-0.5">{partners.length} partenaire(s) enregistré(s)</p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl hover:bg-indigo-700 transition-colors font-medium text-sm shadow-sm"
        >
          + Nouveau Partenaire
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-16">
          <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : partners.length === 0 ? (
        <div className="bg-white p-12 rounded-xl shadow-sm border border-gray-100 text-center text-gray-500">
          <User size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="font-medium">Aucun partenaire enregistré</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {partners.map((partner) => {
            const balance = remaining(partner);
            const isPaid = balance <= 0;
            return (
              <div key={partner.id} className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow overflow-hidden">
                <div className="p-5">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                        <User className="text-indigo-600" size={20} />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">{partner.name}</h3>
                        <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                          <Phone size={11} />
                          {partner.phone}
                        </div>
                      </div>
                    </div>
                    {/* Delete button */}
                    <button
                      onClick={() => setDeleteConfirmPartner(partner)}
                      className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Supprimer le partenaire"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {/* Balance status */}
                  <div className="mb-4">
                    <div className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-block ${isPaid ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {isPaid ? '✓ Soldé' : `⚠ Reste à payer : ${balance.toLocaleString()} GNF`}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-gray-50 rounded-lg p-2.5">
                      <p className="text-xs text-gray-400 uppercase font-medium">Total pris</p>
                      <p className="text-sm font-bold text-gray-900 mt-0.5">{partner.totalDebt.toLocaleString()} GNF</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2.5">
                      <p className="text-xs text-gray-400 uppercase font-medium">Total payé</p>
                      <p className="text-sm font-bold text-green-700 mt-0.5">{partner.totalPaid.toLocaleString()} GNF</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="grid grid-cols-3 gap-1.5">
                    <button onClick={() => handleDistribute(partner)}
                      className="py-2 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-lg hover:bg-indigo-100 transition-colors">
                      Donner Cartes
                    </button>
                    <button onClick={() => handlePayment(partner)}
                      className="py-2 bg-green-50 text-green-700 text-xs font-medium rounded-lg hover:bg-green-100 transition-colors">
                      Encaisser
                    </button>
                    <button onClick={() => handleDetails(partner)}
                      className="py-2 bg-gray-50 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-100 transition-colors flex items-center justify-center gap-1">
                      <Eye size={13} /> Détails
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirmPartner && (
        <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center">
                <AlertTriangle className="text-red-500" size={24} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Supprimer le partenaire ?</h3>
                <p className="text-sm text-gray-500">{deleteConfirmPartner.name}</p>
              </div>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-5 text-sm text-orange-800">
              ⚠ Les cartes actuellement chez ce partenaire seront retournées au stock principal. Tout l'historique sera supprimé.
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirmPartner(null)}
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

      <AddPartnerModal isOpen={isAddModalOpen} onClose={handleModalClose} />
      <DistributeCardsModal isOpen={isDistributeModalOpen} onClose={handleModalClose} partner={selectedPartner} />
      <PaymentModal isOpen={isPaymentModalOpen} onClose={handleModalClose} partner={selectedPartner} />
      <PartnerDetailsModal isOpen={isDetailsModalOpen} onClose={handleModalClose} partner={selectedPartner} />
    </div>
  );
}
