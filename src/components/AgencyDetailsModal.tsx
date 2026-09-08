import React, { useState, useEffect } from 'react';
import { X, CreditCard, History, Store, ArrowRightLeft, ShoppingCart, TrendingUp } from 'lucide-react';
import { Agency } from '../types';
import { fetchApi } from '../lib/api';

interface AgencyDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  agency: Agency | null;
}

export default function AgencyDetailsModal({ isOpen, onClose, agency }: AgencyDetailsModalProps) {
  const [currentCards, setCurrentCards] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [agencyStats, setAgencyStats] = useState({ totalTransferred: 0, totalSold: 0, totalRevenue: 0 });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'summary' | 'cards' | 'history'>('summary');

  useEffect(() => {
    if (isOpen && agency) {
      setActiveTab('summary');
      loadDetails();
    }
  }, [isOpen, agency]);

  const loadDetails = async () => {
    setLoading(true);
    try {
      const result = await fetchApi(`/agencies/${agency?.id}/details`) as any;
      setCurrentCards(result.currentCards || []);
      setTransactions(result.transactions || []);
      setAgencyStats(result.stats || { totalTransferred: 0, totalSold: 0, totalRevenue: 0 });
    } catch (error) {
      console.error("Failed to load agency details", error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !agency) return null;

  const Summary = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
          <p className="text-xs font-medium text-indigo-600 uppercase">Stock Actuel</p>
          <p className="text-2xl font-bold text-indigo-700 mt-1">{currentCards.length}</p>
          <p className="text-xs text-indigo-500 mt-1">cartes en vitrine</p>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <p className="text-xs font-medium text-blue-600 uppercase">Total Reçu</p>
          <p className="text-2xl font-bold text-blue-700 mt-1">{agencyStats.totalTransferred}</p>
          <p className="text-xs text-blue-500 mt-1">cartes transférées</p>
        </div>
        <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
          <p className="text-xs font-medium text-orange-600 uppercase">Total Vendues</p>
          <p className="text-2xl font-bold text-orange-700 mt-1">{agencyStats.totalSold}</p>
          <p className="text-xs text-orange-500 mt-1">cartes écoulées</p>
        </div>
        <div className="bg-green-50 border border-green-100 rounded-xl p-4">
          <p className="text-xs font-medium text-green-600 uppercase">Chiffre d'Affaires</p>
          <p className="text-xl font-bold text-green-700 mt-1">{agencyStats.totalRevenue.toLocaleString()}</p>
          <p className="text-xs text-green-500 mt-1">GNF encaissés</p>
        </div>
      </div>

      <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><TrendingUp size={18} /> Performance Globale</h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Taux d'écoulement</span>
            <span className="font-bold text-gray-900">
              {agencyStats.totalTransferred > 0 ? Math.round((agencyStats.totalSold / agencyStats.totalTransferred) * 100) : 0}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-indigo-500 h-2 rounded-full"
              style={{ width: `${agencyStats.totalTransferred > 0 ? Math.min(100, Math.round((agencyStats.totalSold / agencyStats.totalTransferred) * 100)) : 0}%` }}
            />
          </div>
          <p className="text-xs text-gray-400">{agencyStats.totalSold} vendues sur {agencyStats.totalTransferred} reçues</p>
        </div>
      </div>

      {agency.address && (
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
          <p className="text-sm text-gray-500">📍 Adresse : <span className="font-medium text-gray-800">{agency.address}</span></p>
        </div>
      )}
    </div>
  );

  const CardsTab = () => (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-gray-500">
          <tr>
            <th className="px-4 py-3 font-medium">N° Carte</th>
            <th className="px-4 py-3 font-medium">Valeur</th>
            <th className="px-4 py-3 font-medium">Date de Transfert</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {currentCards.length === 0 ? (
            <tr><td colSpan={3} className="px-4 py-10 text-center text-gray-400">L'agence n'a pas de stock en ce moment</td></tr>
          ) : (
            currentCards.map((card: any) => (
              <tr key={card.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono font-medium text-gray-900">{card.cardNumber}</td>
                <td className="px-4 py-3 text-indigo-700 font-semibold">{card.value?.toLocaleString()} GNF</td>
                <td className="px-4 py-3 text-gray-500">{new Date(card.entryDate).toLocaleDateString('fr-FR')}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  const HistoryTab = () => (
    <div className="space-y-3">
      {transactions.length === 0 ? (
        <div className="text-center text-gray-400 py-10">Aucune opération enregistrée pour cette agence</div>
      ) : (
        transactions.map((tx: any) => (
          <div key={tx.id} className={`rounded-xl border p-4 ${tx.type === 'agency_sale' ? 'bg-green-50 border-green-100' : 'bg-blue-50 border-blue-100'}`}>
            <div className="flex justify-between items-start flex-wrap gap-2">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  {tx.type === 'agency_sale' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-200 text-green-800">
                      <ShoppingCart size={12} /> Vente Client
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-200 text-blue-800">
                      <ArrowRightLeft size={12} /> Approvisionnement
                    </span>
                  )}
                  <span className="text-xs text-gray-500">{new Date(tx.date).toLocaleString('fr-FR')}</span>
                </div>
                {tx.description && <p className="text-sm text-gray-600 mt-1">{tx.description}</p>}
              </div>
              <div className="text-right">
                <p className={`text-lg font-bold ${tx.type === 'agency_sale' ? 'text-green-700' : 'text-blue-700'}`}>
                  {tx.type === 'agency_sale' ? `+${(tx.amount || 0).toLocaleString()} GNF` : `${tx.quantity} cartes`}
                </p>
                {tx.type === 'agency_sale' && tx.quantity > 0 && (
                  <p className="text-xs text-gray-500">{tx.quantity} cartes vendues</p>
                )}
              </div>
            </div>

            {tx.cards && tx.cards.length > 0 && (
              <div className="mt-3 bg-white rounded-lg p-3 border border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Détail ({tx.cards.length} cartes) :</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {tx.cards.map((card: any) => (
                    <div key={card.id} className="text-xs bg-gray-50 border border-gray-200 rounded px-2 py-1 flex justify-between">
                      <span className="font-mono">{card.cardNumber}</span>
                      <span className="font-medium text-indigo-600 ml-2">{card.value?.toLocaleString()} GNF</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col">
        <div className="flex justify-between items-center px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-xl"><Store size={22} className="text-indigo-600" /></div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{agency.name}</h2>
              {agency.address && <p className="text-sm text-gray-500">📍 {agency.address}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={22} />
          </button>
        </div>

        <div className="flex border-b border-gray-200 px-6">
          {[
            { key: 'summary', label: '📊 Résumé' },
            { key: 'cards', label: `🃏 Stock (${currentCards.length})` },
            { key: 'history', label: `📋 Historique (${transactions.length})` },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-3"></div>
                <p className="text-gray-500">Chargement du dossier agence...</p>
              </div>
            </div>
          ) : activeTab === 'summary' ? <Summary /> : activeTab === 'cards' ? <CardsTab /> : <HistoryTab />}
        </div>
      </div>
    </div>
  );
}

