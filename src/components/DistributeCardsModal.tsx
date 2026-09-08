import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Package, CheckSquare, Square, Zap, Hand, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { Partner } from '../types';
import { fetchApi } from '../lib/api';

interface DistributeCardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  partner: Partner | null;
}

interface AvailableCard {
  id: string;
  cardNumber: string;
  value: number;
  purchasePrice: number;
  sellingPrice: number;
  expiryDate: string;
}

type Mode = 'auto' | 'manual';

export default function DistributeCardsModal({ isOpen, onClose, partner }: DistributeCardsModalProps) {
  const [mode, setMode] = useState<Mode>('auto');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [stockLoading, setStockLoading] = useState(false);
  const [error, setError] = useState('');

  // --- AUTO mode state ---
  const [availableStock, setAvailableStock] = useState<Record<number, number>>({});
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [sellingPrices, setSellingPrices] = useState<Record<number, number>>({});

  // --- MANUAL mode state ---
  const [allCards, setAllCards] = useState<AvailableCard[]>([]);
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());
  const [cardSellingPrices, setCardSellingPrices] = useState<Record<string, number>>({});
  const [groupSellingPrice, setGroupSellingPrice] = useState<Record<number, number>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedValues, setExpandedValues] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (isOpen) {
      setMode('auto');
      setError('');
      setDate(new Date().toISOString().split('T')[0]);
      setQuantities({});
      setSellingPrices({});
      setSelectedCardIds(new Set());
      setCardSellingPrices({});
      setGroupSellingPrice({});
      setSearchTerm('');
      loadStock();
    }
  }, [isOpen]);

  const loadStock = async () => {
    setStockLoading(true);
    try {
      const [stockData, cardsData] = await Promise.all([
        fetchApi('/stock') as Promise<Record<number, number>>,
        fetchApi('/cards/available?location=main_stock') as Promise<AvailableCard[]>
      ]);
      setAvailableStock(stockData);
      setAllCards(cardsData);
      // Auto-expand first value group
      const firstValue = Object.keys(stockData).map(Number).sort((a, b) => a - b)[0];
      if (firstValue) setExpandedValues(new Set([firstValue]));
    } catch (err) {
      console.error("Failed to load stock", err);
    } finally {
      setStockLoading(false);
    }
  };

  if (!isOpen || !partner) return null;

  const cardValues = Object.keys(availableStock).map(Number).sort((a, b) => a - b);
  const cardsByValue = allCards.reduce<Record<number, AvailableCard[]>>((acc, card) => {
    if (!acc[card.value]) acc[card.value] = [];
    acc[card.value].push(card);
    return acc;
  }, {});

  // Auto mode calculations
  const autoTotalCards = Object.values(quantities).reduce((sum: number, qty: number) => sum + (Number(qty) || 0), 0);
  const autoTotalAmount = Object.entries(quantities).reduce((sum: number, [value, qty]: [string, number]) => {
    const val = Number(value);
    return sum + (Number(qty) || 0) * (sellingPrices[val] || 0);
  }, 0);

  // Manual mode calculations
  const manualTotalCards = selectedCardIds.size;
  const manualTotalAmount = Array.from(selectedCardIds).reduce((sum, id) => sum + (cardSellingPrices[id] || 0), 0);

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

  const applyGroupPrice = (value: number) => {
    const price = groupSellingPrice[value];
    if (!price) return;
    const cards = cardsByValue[value] || [];
    setCardSellingPrices(prev => {
      const next = { ...prev };
      cards.forEach(c => { next[c.id] = price; });
      return next;
    });
  };

  const autoSelectForValue = (value: number, qty: number) => {
    const cards = (cardsByValue[value] || []).slice(0, qty);
    setSelectedCardIds(prev => {
      const next = new Set(prev);
      // first remove all of this value
      (cardsByValue[value] || []).forEach(c => next.delete(c.id));
      // then add the first qty
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
    const distributionData = Object.entries(quantities)
      .filter(([_, qty]) => (Number(qty) || 0) > 0)
      .map(([value, quantity]) => {
        const val = Number(value);
        return { value: val, quantity: Number(quantity), sellingPrice: sellingPrices[val] || 0 };
      });

    if (distributionData.length === 0) { setError("Veuillez spécifier au moins une quantité."); return; }
    for (const item of distributionData) {
      if (!item.sellingPrice) { setError(`Prix manquant pour les cartes de ${item.value.toLocaleString()} GNF.`); return; }
      if (item.quantity > (availableStock[item.value] || 0)) {
        setError(`Stock insuffisant pour ${item.value.toLocaleString()} GNF.`); return;
      }
    }

    setLoading(true);
    try {
      await fetchApi(`/partners/${partner.id}/distribute`, {
        method: 'POST',
        body: JSON.stringify({ cards: distributionData, date })
      });
      onClose();
    } catch (err: any) { setError(err.message || "Erreur lors de la distribution"); }
    finally { setLoading(false); }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (selectedCardIds.size === 0) { setError("Sélectionnez au moins une carte."); return; }
    const missingPrice = Array.from(selectedCardIds).find(id => !cardSellingPrices[id]);
    if (missingPrice) {
      const card = allCards.find(c => c.id === missingPrice);
      setError(`Prix de vente manquant pour la carte ${card?.cardNumber}.`);
      return;
    }

    const selectedCards = Array.from(selectedCardIds).map(id => ({
      cardId: id,
      sellingPrice: cardSellingPrices[id]
    }));

    setLoading(true);
    try {
      await fetchApi(`/partners/${partner.id}/distribute-selected`, {
        method: 'POST',
        body: JSON.stringify({ selectedCards, date })
      });
      onClose();
    } catch (err: any) { setError(err.message || "Erreur lors de la distribution"); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Donner Cartes à {partner.name}</h2>
            <p className="text-sm text-gray-500 mt-0.5">Distribution depuis le stock principal</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
            <X size={22} />
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="px-6 py-3 border-b border-gray-100 shrink-0">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode('auto')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${mode === 'auto' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              <Zap size={16} />
              Auto-sélection
            </button>
            <button
              type="button"
              onClick={() => setMode('manual')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${mode === 'manual' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              <Hand size={16} />
              Sélection manuelle
              {selectedCardIds.size > 0 && (
                <span className="bg-white/30 text-white rounded-full px-1.5 text-xs">{selectedCardIds.size}</span>
              )}
            </button>
          </div>
        </div>

        <form onSubmit={mode === 'auto' ? handleAutoSubmit : handleManualSubmit} className="flex flex-col flex-1 overflow-hidden">
          {/* Date */}
          <div className="px-6 py-3 shrink-0 border-b border-gray-50">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-600 shrink-0">Date de distribution :</label>
              <input type="date" required className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500"
                value={date} onChange={e => setDate(e.target.value)} />
            </div>
          </div>

          {/* Content */}
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
                <p className="font-medium">Aucune carte disponible en stock</p>
              </div>
            ) : mode === 'auto' ? (
              /* ── AUTO MODE ── */
              <>
                <p className="text-xs text-gray-500 mb-1">Saisissez la quantité et le prix de vente par type de carte :</p>
                <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-gray-500 uppercase px-2">
                  <div className="col-span-4">Carte</div>
                  <div className="col-span-4 text-center">Quantité</div>
                  <div className="col-span-4 text-center">Prix / carte (GNF)</div>
                </div>
                {cardValues.map(value => (
                  <div key={value} className="grid grid-cols-12 gap-2 items-center bg-gray-50 rounded-xl p-3">
                    <div className="col-span-4">
                      <p className="text-sm font-bold text-gray-800">{value.toLocaleString()} GNF</p>
                      <p className="text-xs text-gray-500">Dispo : <span className="text-indigo-600 font-semibold">{availableStock[value] || 0}</span></p>
                    </div>
                    <div className="col-span-4">
                      <input type="number" min="0" max={availableStock[value] || 0}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-center text-sm focus:ring-2 focus:ring-indigo-500"
                        value={quantities[value] || ''}
                        onChange={e => setQuantities(p => ({ ...p, [value]: parseInt(e.target.value) || 0 }))}
                        placeholder="0"
                      />
                    </div>
                    <div className="col-span-4">
                      <input type="number" min="0"
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-center text-sm focus:ring-2 focus:ring-indigo-500"
                        value={sellingPrices[value] || ''}
                        onChange={e => setSellingPrices(p => ({ ...p, [value]: parseFloat(e.target.value) || 0 }))}
                        placeholder="0"
                      />
                    </div>
                  </div>
                ))}
              </>
            ) : (
              /* ── MANUAL MODE ── */
              <>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="text" placeholder="Rechercher un numéro de carte..."
                      className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                      value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>

                {cardValues.map(value => {
                  const cards = filteredCards(value);
                  const totalForValue = cardsByValue[value]?.length || 0;
                  const selectedCount = (cardsByValue[value] || []).filter(c => selectedCardIds.has(c.id)).length;
                  const allSelected = totalForValue > 0 && selectedCount === totalForValue;
                  const isExpanded = expandedValues.has(value);

                  return (
                    <div key={value} className="border border-gray-200 rounded-xl overflow-hidden">
                      {/* Group header */}
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
                          {/* Quick auto-select qty for this value */}
                          <input type="number" min="0" max={totalForValue}
                            placeholder="Qty auto"
                            className="w-20 border border-gray-200 rounded px-2 py-1 text-xs text-center focus:ring-1 focus:ring-indigo-400"
                            onBlur={e => { if (e.target.value) autoSelectForValue(value, parseInt(e.target.value)); e.target.value = ''; }}
                            title="Entrez un nombre pour auto-sélectionner les premières cartes"
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

                      {/* Group price setter */}
                      {selectedCount > 0 && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border-t border-indigo-100">
                          <span className="text-xs text-indigo-600 shrink-0">{selectedCount} sélectionnée(s) — Prix de vente unitaire :</span>
                          <input type="number" min="0"
                            className="flex-1 border border-indigo-200 rounded px-2 py-1 text-xs text-center focus:ring-1 focus:ring-indigo-400"
                            value={groupSellingPrice[value] || ''}
                            onChange={e => setGroupSellingPrice(p => ({ ...p, [value]: parseFloat(e.target.value) || 0 }))}
                            placeholder="Prix GNF"
                          />
                          <button type="button" onClick={() => applyGroupPrice(value)}
                            className="px-2 py-1 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-700">
                            Appliquer
                          </button>
                        </div>
                      )}

                      {/* Card list */}
                      {isExpanded && (
                        <div className="divide-y divide-gray-50 max-h-60 overflow-y-auto">
                          {cards.length === 0 ? (
                            <p className="text-center text-sm text-gray-400 py-3">Aucune carte correspondante</p>
                          ) : (
                            cards.map(card => (
                              <div key={card.id}
                                onClick={() => toggleCard(card)}
                                className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors ${selectedCardIds.has(card.id) ? 'bg-indigo-50' : ''}`}
                              >
                                <span className="text-indigo-600 shrink-0">
                                  {selectedCardIds.has(card.id) ? <CheckSquare size={16} /> : <Square size={16} className="text-gray-300" />}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="font-mono text-sm font-semibold text-gray-900">{card.cardNumber}</p>
                                  <p className="text-xs text-gray-400">Exp. {new Date(card.expiryDate).toLocaleDateString('fr-FR')}</p>
                                </div>
                                {selectedCardIds.has(card.id) && (
                                  <input
                                    type="number" min="0"
                                    className="w-28 border border-indigo-200 rounded px-2 py-1 text-xs text-right focus:ring-1 focus:ring-indigo-400"
                                    value={cardSellingPrices[card.id] || ''}
                                    onChange={e => { e.stopPropagation(); setCardSellingPrices(p => ({ ...p, [card.id]: parseFloat(e.target.value) || 0 })); }}
                                    onClick={e => e.stopPropagation()}
                                    placeholder="Prix GNF"
                                  />
                                )}
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

          {/* Footer */}
          <div className="shrink-0 px-6 py-4 border-t border-gray-100 space-y-3">
            {/* Summary */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-xl px-4 py-2 text-center">
                <p className="text-xs text-gray-500">Cartes sélectionnées</p>
                <p className="font-bold text-gray-900 text-lg">{mode === 'auto' ? autoTotalCards : manualTotalCards}</p>
              </div>
              <div className="bg-red-50 rounded-xl px-4 py-2 text-center">
                <p className="text-xs text-red-500">Dette générée</p>
                <p className="font-bold text-red-700">{(mode === 'auto' ? autoTotalAmount : manualTotalAmount).toLocaleString()} GNF</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 text-sm">
                Annuler
              </button>
              <button type="submit" disabled={loading || (mode === 'auto' ? autoTotalCards === 0 : manualTotalCards === 0)}
                className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 text-sm font-semibold">
                {loading ? 'Traitement...' : `Valider — ${mode === 'auto' ? autoTotalCards : manualTotalCards} carte(s)`}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
