import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Package, CheckSquare, Square, Zap, Hand, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { Agency } from '../types';
import { fetchApi } from '../lib/api';

interface TransferToAgencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  agency: Agency | null;
}

interface AvailableCard {
  id: string;
  cardNumber: string;
  value: number;
  purchasePrice: number;
  expiryDate: string;
}

type Mode = 'auto' | 'manual';

export default function TransferToAgencyModal({ isOpen, onClose, agency }: TransferToAgencyModalProps) {
  const [mode, setMode] = useState<Mode>('auto');
  const [loading, setLoading] = useState(false);
  const [stockLoading, setStockLoading] = useState(false);
  const [error, setError] = useState('');

  // AUTO mode
  const [availableStock, setAvailableStock] = useState<Record<number, number>>({});
  const [quantities, setQuantities] = useState<Record<number, number>>({});

  // MANUAL mode
  const [allCards, setAllCards] = useState<AvailableCard[]>([]);
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedValues, setExpandedValues] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (isOpen && agency) {
      setMode('auto');
      setError('');
      setQuantities({});
      setSelectedCardIds(new Set());
      setSearchTerm('');
      loadStock();
    }
  }, [isOpen, agency]);

  const loadStock = async () => {
    setStockLoading(true);
    try {
      const [stockData, cardsData] = await Promise.all([
        fetchApi('/stock') as Promise<Record<number, number>>,
        fetchApi('/cards/available?location=main_stock') as Promise<AvailableCard[]>
      ]);
      setAvailableStock(stockData);
      setAllCards(cardsData);
      const firstValue = Object.keys(stockData).map(Number).sort((a, b) => a - b)[0];
      if (firstValue) setExpandedValues(new Set([firstValue]));
    } catch (err) {
      console.error("Failed to load stock", err);
    } finally {
      setStockLoading(false);
    }
  };

  if (!isOpen || !agency) return null;

  const cardValues = Object.keys(availableStock).map(Number).sort((a, b) => a - b);
  const cardsByValue = allCards.reduce<Record<number, AvailableCard[]>>((acc, card) => {
    if (!acc[card.value]) acc[card.value] = [];
    acc[card.value].push(card);
    return acc;
  }, {});

  const autoTotalCards = Object.values(quantities).reduce((sum: number, qty: number) => sum + (Number(qty) || 0), 0);
  const manualTotalCards = selectedCardIds.size;

  const toggleCard = (card: AvailableCard) => {
    setSelectedCardIds(prev => {
      const next = new Set(prev);
      if (next.has(card.id)) next.delete(card.id);
      else next.add(card.id);
      return next;
    });
  };

  const toggleValueGroup = (value: number) => {
    const cards = cardsByValue[value] || [];
    const allSelected = cards.every(c => selectedCardIds.has(c.id));
    setSelectedCardIds(prev => {
      const next = new Set(prev);
      if (allSelected) cards.forEach(c => next.delete(c.id));
      else cards.forEach(c => next.add(c.id));
      return next;
    });
  };

  const autoSelectForValue = (value: number, qty: number) => {
    const cards = (cardsByValue[value] || []).slice(0, qty);
    setSelectedCardIds(prev => {
      const next = new Set(prev);
      (cardsByValue[value] || []).forEach(c => next.delete(c.id));
      cards.forEach(c => next.add(c.id));
      return next;
    });
  };

  const filteredCards = (value: number) => {
    const cards = cardsByValue[value] || [];
    if (!searchTerm) return cards;
    return cards.filter(c => c.cardNumber.toLowerCase().includes(searchTerm.toLowerCase()));
  };

  const handleAutoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const transferData = Object.entries(quantities)
      .filter(([_, qty]) => (Number(qty) || 0) > 0)
      .map(([value, quantity]) => ({ value: Number(value), quantity: Number(quantity) }));

    if (transferData.length === 0) { setError("Veuillez spécifier au moins une quantité."); return; }
    for (const item of transferData) {
      if (item.quantity > (availableStock[item.value] || 0)) {
        setError(`Stock insuffisant pour ${item.value.toLocaleString()} GNF.`); return;
      }
    }

    setLoading(true);
    try {
      await fetchApi(`/agencies/${agency.id}/transfer`, {
        method: 'POST',
        body: JSON.stringify({ cards: transferData })
      });
      onClose();
    } catch (err: any) { setError(err.message || "Erreur lors du transfert"); }
    finally { setLoading(false); }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (selectedCardIds.size === 0) { setError("Sélectionnez au moins une carte."); return; }

    setLoading(true);
    try {
      await fetchApi(`/agencies/${agency.id}/transfer-selected`, {
        method: 'POST',
        body: JSON.stringify({ cardIds: Array.from(selectedCardIds) })
      });
      onClose();
    } catch (err: any) { setError(err.message || "Erreur lors du transfert"); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Approvisionner {agency.name}</h2>
            <p className="text-sm text-gray-500 mt-0.5">Transfert depuis le stock principal</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
            <X size={22} />
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="px-6 py-3 border-b border-gray-100 shrink-0">
          <div className="flex gap-2">
            <button type="button" onClick={() => setMode('auto')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${mode === 'auto' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              <Zap size={16} /> Auto-sélection
            </button>
            <button type="button" onClick={() => setMode('manual')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${mode === 'manual' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              <Hand size={16} /> Sélection manuelle
              {selectedCardIds.size > 0 && <span className="bg-white/30 text-white rounded-full px-1.5 text-xs">{selectedCardIds.size}</span>}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">
            {mode === 'auto' ? "Le système choisit automatiquement les premières cartes disponibles." : "Choisissez manuellement les numéros de cartes à envoyer."}
          </p>
        </div>

        <form onSubmit={mode === 'auto' ? handleAutoSubmit : handleManualSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg flex items-center gap-2 text-sm">
                <AlertCircle size={16} />{error}
              </div>
            )}

            {stockLoading ? (
              <div className="flex items-center justify-center py-12 text-gray-500">
                <div className="w-7 h-7 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mr-3" />
                Chargement du stock...
              </div>
            ) : cardValues.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Package size={44} className="mx-auto mb-2 text-gray-300" />
                <p className="font-medium">Aucune carte disponible en stock principal</p>
              </div>
            ) : mode === 'auto' ? (
              /* AUTO MODE */
              <>
                <p className="text-xs text-gray-500 mb-1">Indiquez la quantité à transférer par type de carte :</p>
                {cardValues.map(value => (
                  <div key={value} className="flex items-center justify-between gap-4 bg-gray-50 rounded-xl p-4">
                    <div className="flex-1">
                      <p className="text-sm font-bold text-gray-800">{value.toLocaleString()} GNF</p>
                      <p className="text-xs text-gray-500">Disponible : <span className="text-indigo-600 font-semibold">{availableStock[value] || 0}</span></p>
                    </div>
                    <input type="number" min="0" max={availableStock[value] || 0}
                      className="w-28 border border-gray-200 rounded-lg px-3 py-2 text-center text-sm focus:ring-2 focus:ring-indigo-500"
                      value={quantities[value] || ''}
                      onChange={e => setQuantities(p => ({ ...p, [value]: parseInt(e.target.value) || 0 }))}
                      placeholder="0"
                    />
                  </div>
                ))}
              </>
            ) : (
              /* MANUAL MODE */
              <>
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" placeholder="Rechercher un numéro de carte..."
                    className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                    value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>

                {cardValues.map(value => {
                  const cards = filteredCards(value);
                  const totalForValue = cardsByValue[value]?.length || 0;
                  const selectedCount = (cardsByValue[value] || []).filter(c => selectedCardIds.has(c.id)).length;
                  const allSelected = totalForValue > 0 && selectedCount === totalForValue;
                  const isExpanded = expandedValues.has(value);

                  return (
                    <div key={value} className="border border-gray-200 rounded-xl overflow-hidden">
                      <div className="flex items-center justify-between bg-gray-50 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <button type="button" onClick={() => toggleValueGroup(value)} className="text-gray-400 hover:text-indigo-600">
                            {allSelected ? <CheckSquare size={18} className="text-indigo-600" /> : <Square size={18} />}
                          </button>
                          <div>
                            <span className="font-bold text-gray-800">{value.toLocaleString()} GNF</span>
                            <span className="text-xs text-gray-500 ml-2">({selectedCount}/{totalForValue} sélectionnée(s))</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <input type="number" min="0" max={totalForValue}
                            placeholder="Qty"
                            title="Auto-sélectionner N premières cartes"
                            className="w-16 border border-gray-200 rounded px-2 py-1 text-xs text-center focus:ring-1 focus:ring-indigo-400"
                            onBlur={e => { if (e.target.value) autoSelectForValue(value, parseInt(e.target.value)); e.target.value = ''; }}
                          />
                          <button type="button" onClick={() => setExpandedValues(prev => {
                            const next = new Set(prev);
                            if (next.has(value)) next.delete(value); else next.add(value);
                            return next;
                          })} className="p-1 text-gray-400 hover:text-gray-700">
                            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
                          {cards.length === 0 ? (
                            <p className="text-center text-sm text-gray-400 py-3">Aucune carte correspondante</p>
                          ) : (
                            cards.map(card => (
                              <div key={card.id} onClick={() => toggleCard(card)}
                                className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors ${selectedCardIds.has(card.id) ? 'bg-indigo-50' : ''}`}>
                                <span className="text-indigo-600 shrink-0">
                                  {selectedCardIds.has(card.id) ? <CheckSquare size={16} /> : <Square size={16} className="text-gray-300" />}
                                </span>
                                <p className="font-mono text-sm font-semibold text-gray-900 flex-1">{card.cardNumber}</p>
                                <p className="text-xs text-gray-400">Exp. {new Date(card.expiryDate).toLocaleDateString('fr-FR')}</p>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>

          <div className="shrink-0 px-6 py-4 border-t border-gray-100 space-y-3">
            <div className="bg-indigo-50 rounded-xl px-4 py-2.5 flex justify-between items-center">
              <span className="text-sm text-indigo-700">
                {mode === 'auto' ? 'Cartes à transférer :' : 'Cartes sélectionnées :'}
              </span>
              <span className="font-bold text-indigo-900 text-lg">{mode === 'auto' ? autoTotalCards : manualTotalCards}</span>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 text-sm">
                Annuler
              </button>
              <button type="submit" disabled={loading || (mode === 'auto' ? autoTotalCards === 0 : manualTotalCards === 0)}
                className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 text-sm font-semibold">
                {loading ? 'Transfert...' : `Transférer ${mode === 'auto' ? autoTotalCards : manualTotalCards} carte(s)`}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
