import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Package } from 'lucide-react';
import { Agency } from '../types';
import { fetchApi } from '../lib/api';

interface AgencySaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  agency: Agency | null;
}

export default function AgencySaleModal({ isOpen, onClose, agency }: AgencySaleModalProps) {
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [sellingPrices, setSellingPrices] = useState<Record<number, number>>({});
  const [agencyStock, setAgencyStock] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(false);
  const [stockLoading, setStockLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && agency) {
      loadAgencyStock();
      setQuantities({});
      setSellingPrices({});
      setError('');
    }
  }, [isOpen, agency]);

  const loadAgencyStock = async () => {
    setStockLoading(true);
    try {
      const data = await fetchApi(`/agencies/${agency?.id}/stock`);
      setAgencyStock(data);
    } catch (error) {
      console.error("Failed to load agency stock", error);
    } finally {
      setStockLoading(false);
    }
  };

  if (!isOpen || !agency) return null;

  // ✅ DYNAMIC: use actual card values from this agency's real stock
  const cardValues = Object.keys(agencyStock).map(Number).sort((a, b) => a - b);

  const handleQuantityChange = (value: number, qty: string) => {
    const parsedQty = parseInt(qty, 10);
    setQuantities(prev => ({ ...prev, [value]: isNaN(parsedQty) ? 0 : parsedQty }));
  };

  const handlePriceChange = (value: number, price: string) => {
    const parsedPrice = parseFloat(price);
    setSellingPrices(prev => ({ ...prev, [value]: isNaN(parsedPrice) ? 0 : parsedPrice }));
  };

  const totalCards = Object.values(quantities).reduce((sum: number, qty: number) => sum + (Number(qty) || 0), 0);
  const totalRevenue = Object.entries(quantities).reduce((sum: number, [value, qty]: [string, number]) => {
    const val = Number(value);
    return sum + (Number(qty) || 0) * (sellingPrices[val] || 0);
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const salesData = Object.entries(quantities)
      .filter(([_, qty]) => (qty as number) > 0)
      .map(([value, quantity]) => {
        const val = Number(value);
        return { value: val, quantity: quantity as number, sellingPrice: sellingPrices[val] || 0 };
      });

    if (salesData.length === 0) {
      setError("Veuillez spécifier au moins une quantité à vendre.");
      return;
    }

    for (const item of salesData) {
      if (!item.sellingPrice || item.sellingPrice <= 0) {
        setError(`Veuillez saisir un prix de vente pour les cartes de ${item.value.toLocaleString()} GNF.`);
        return;
      }
      if (item.quantity > (agencyStock[item.value] || 0)) {
        setError(`Stock insuffisant pour les cartes de ${item.value.toLocaleString()} GNF. Disponible : ${agencyStock[item.value] || 0}`);
        return;
      }
    }

    setLoading(true);
    try {
      await fetchApi(`/agencies/${agency.id}/sale`, {
        method: 'POST',
        body: JSON.stringify({ cards: salesData })
      });
      onClose();
    } catch (error: any) {
      setError(error.message || "Erreur lors de la vente");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Vente — {agency.name}</h2>
            <p className="text-sm text-gray-500 mt-0.5">Enregistrez les ventes du comptoir</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
            <X size={22} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg flex items-center gap-2 text-sm">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-800">
              <strong>ℹ️ Prix de vente :</strong> Saisissez le montant exact payé par le client pour chaque carte.
            </div>

            {stockLoading ? (
              <div className="flex items-center justify-center py-10 text-gray-500">
                <div className="w-6 h-6 border-2 border-green-400 border-t-transparent rounded-full animate-spin mr-3" />
                Chargement du stock agence...
              </div>
            ) : cardValues.length === 0 ? (
              <div className="text-center py-10 text-gray-500">
                <Package size={40} className="mx-auto mb-2 text-gray-300" />
                <p className="font-medium">Aucune carte disponible dans cette agence</p>
                <p className="text-sm mt-1">Approvisionnez l'agence d'abord.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-12 gap-3 text-xs font-semibold text-gray-500 uppercase px-1">
                  <div className="col-span-5">Carte</div>
                  <div className="col-span-3 text-center">Quantité</div>
                  <div className="col-span-4 text-center">Prix vente (GNF)</div>
                </div>

                {cardValues.map(value => (
                  <div key={value} className="grid grid-cols-12 gap-3 items-center bg-gray-50 rounded-xl p-3">
                    <div className="col-span-5">
                      <p className="text-sm font-semibold text-gray-800">{value.toLocaleString()} GNF</p>
                      <p className="text-xs text-gray-500">Dispo : <span className="text-green-600 font-medium">{agencyStock[value] || 0}</span></p>
                    </div>
                    <div className="col-span-3">
                      <input
                        type="number" min="0" max={agencyStock[value] || 0}
                        className="w-full border border-gray-200 rounded-lg px-2 py-2 text-center text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        value={quantities[value] || ''}
                        onChange={(e) => handleQuantityChange(value, e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div className="col-span-4">
                      <input
                        type="number" min="0"
                        className="w-full border border-gray-200 rounded-lg px-2 py-2 text-center text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        value={sellingPrices[value] || ''}
                        onChange={(e) => handlePriceChange(value, e.target.value)}
                        placeholder="0 GNF"
                      />
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          {cardValues.length > 0 && (
            <div className="shrink-0 p-6 border-t border-gray-100 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg px-3 py-2 text-center">
                  <p className="text-xs text-gray-500">Cartes vendues</p>
                  <p className="font-bold text-gray-900">{totalCards}</p>
                </div>
                <div className="bg-green-50 rounded-lg px-3 py-2 text-center">
                  <p className="text-xs text-green-600">Recettes totales</p>
                  <p className="font-bold text-green-700">{totalRevenue.toLocaleString()} GNF</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm">
                  Annuler
                </button>
                <button type="submit" disabled={loading || totalCards === 0} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 text-sm font-medium">
                  {loading ? 'Enregistrement...' : `Valider la vente`}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
