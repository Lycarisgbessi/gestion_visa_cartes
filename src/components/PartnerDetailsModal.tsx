import React, { useState, useEffect, useMemo } from 'react';
import { X, CreditCard, DollarSign, TrendingUp, Clock, Calendar, Package, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { Partner } from '../types';
import { fetchApi } from '../lib/api';

interface PartnerDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  partner: Partner | null;
}

interface Transaction {
  id: string;
  type: 'partner_distribution' | 'partner_payment';
  date: string;
  amount: number;
  quantity: number;
  cardIds?: string[];
  cards?: { id: string; cardNumber: string; value: number; sellingPrice: number }[];
  description?: string;
}

type PeriodKey = '24h' | '7d' | '30d' | '3m' | '6m' | '1y' | 'all' | 'custom';

interface PeriodOption {
  label: string;
  key: PeriodKey;
}

const PERIODS: PeriodOption[] = [
  { label: '24h', key: '24h' },
  { label: '7 jours', key: '7d' },
  { label: '30 jours', key: '30d' },
  { label: 'Trimestre', key: '3m' },
  { label: 'Semestre', key: '6m' },
  { label: '1 an', key: '1y' },
  { label: 'Tout', key: 'all' },
  { label: 'Personnalisé', key: 'custom' },
];

function getDateRange(period: PeriodKey, customFrom?: string, customTo?: string): { from: Date | null; to: Date } {
  const to = new Date();
  to.setHours(23, 59, 59, 999);
  if (period === 'all') return { from: null, to };
  if (period === 'custom' && customFrom) {
    const from = new Date(customFrom);
    from.setHours(0, 0, 0, 0);
    const toDate = customTo ? new Date(customTo) : new Date();
    toDate.setHours(23, 59, 59, 999);
    return { from, to: toDate };
  }
  const from = new Date();
  if (period === '24h') from.setHours(from.getHours() - 24);
  else if (period === '7d') from.setDate(from.getDate() - 7);
  else if (period === '30d') from.setDate(from.getDate() - 30);
  else if (period === '3m') from.setMonth(from.getMonth() - 3);
  else if (period === '6m') from.setMonth(from.getMonth() - 6);
  else if (period === '1y') from.setFullYear(from.getFullYear() - 1);
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

export default function PartnerDetailsModal({ isOpen, onClose, partner }: PartnerDetailsModalProps) {
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [currentCards, setCurrentCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState<PeriodKey>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [expandedTx, setExpandedTx] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'timeline' | 'cards' | 'summary'>('summary');

  useEffect(() => {
    if (isOpen && partner) {
      setActiveTab('summary');
      setPeriod('30d');
      setExpandedTx(new Set());
      loadDetails();
    }
  }, [isOpen, partner]);

  const loadDetails = async () => {
    if (!partner) return;
    setLoading(true);
    try {
      const data = await fetchApi(`/partners/${partner.id}/details`);
      setAllTransactions(data.transactions || []);
      setCurrentCards(data.currentCards || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const { from, to } = useMemo(() => getDateRange(period, customFrom, customTo), [period, customFrom, customTo]);

  const filteredTx = useMemo(() => {
    return allTransactions.filter(tx => {
      const d = new Date(tx.date);
      if (from && d < from) return false;
      if (d > to) return false;
      return true;
    });
  }, [allTransactions, from, to]);

  // Period stats
  const periodStats = useMemo(() => {
    let cardsReceived = 0;
    let amountDue = 0;
    let amountPaid = 0;
    let waves = 0;
    let payments = 0;

    filteredTx.forEach(tx => {
      if (tx.type === 'partner_distribution') {
        cardsReceived += tx.quantity;
        amountDue += tx.amount;
        waves++;
      } else if (tx.type === 'partner_payment') {
        amountPaid += tx.amount;
        payments++;
      }
    });

    return { cardsReceived, amountDue, amountPaid, remaining: amountDue - amountPaid, waves, payments };
  }, [filteredTx]);

  // Running balance for timeline
  const txWithBalance = useMemo(() => {
    // Work off all transactions to compute running balance snapshot at each period tx
    const allSorted = [...allTransactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let runBalance = 0;
    const balanceMap = new Map<string, number>();
    allSorted.forEach(tx => {
      if (tx.type === 'partner_distribution') runBalance += tx.amount;
      else runBalance -= tx.amount;
      balanceMap.set(tx.id, runBalance);
    });

    return [...filteredTx]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map(tx => ({ ...tx, runningBalance: balanceMap.get(tx.id) ?? 0 }));
  }, [filteredTx, allTransactions]);

  if (!isOpen || !partner) return null;

  const fmt = (n: number) => n.toLocaleString('fr-FR') + ' GNF';
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  const fmtTime = (d: string) => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const allTimeBalance = partner.totalDebt - partner.totalPaid;
  const isPaid = allTimeBalance <= 0;

  return (
    <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4">
      <div className="bg-gray-50 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[94vh] flex flex-col overflow-hidden">
        
        {/* ── Header ── */}
        <div className="bg-white px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{partner.name}</h2>
              <p className="text-sm text-gray-400 mt-0.5">{partner.phone}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${isPaid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {isPaid ? '✓ Soldé' : `⚠ ${fmt(allTimeBalance)} à récupérer`}
              </span>
              <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4">
            {(['summary', 'timeline', 'cards'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === tab ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                {tab === 'summary' ? '📊 Résumé' : tab === 'timeline' ? '📅 Historique' : `🃏 Cartes (${currentCards.length})`}
              </button>
            ))}
          </div>
        </div>

        {/* ── Period Filter Bar (shared by summary + timeline) ── */}
        {activeTab !== 'cards' && (
          <div className="bg-white border-b border-gray-100 px-4 py-2 shrink-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Calendar size={14} className="text-gray-400 mr-1" />
              {PERIODS.map(p => (
                <button key={p.key} onClick={() => setPeriod(p.key)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${period === p.key ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {p.label}
                </button>
              ))}
            </div>
            {period === 'custom' && (
              <div className="flex items-center gap-2 mt-2">
                <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-indigo-400" />
                <span className="text-gray-400 text-xs">→</span>
                <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-indigo-400" />
              </div>
            )}
          </div>
        )}

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* ── SUMMARY TAB ── */}
              {activeTab === 'summary' && (
                <div className="p-5 space-y-5">
                  {/* All-time KPIs */}
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Depuis la création — Toutes périodes</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <Stat icon={<TrendingUp size={16} className="text-indigo-500" />} label="Total dû" value={fmt(partner.totalDebt)} color="indigo" />
                      <Stat icon={<DollarSign size={16} className="text-green-500" />} label="Total payé" value={fmt(partner.totalPaid)} color="green" />
                      <Stat icon={<AlertCircle size={16} className="text-red-500" />} label="Reste dû" value={fmt(Math.max(0, allTimeBalance))} color="red" />
                      <Stat icon={<Package size={16} className="text-blue-500" />} label="Cartes actuelles" value={`${currentCards.length}`} color="blue" />
                    </div>
                  </div>

                  {/* Period stats */}
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase mb-2">
                      Sur la période sélectionnée — {PERIODS.find(p => p.key === period)?.label}
                    </p>
                    {filteredTx.length === 0 ? (
                      <div className="bg-white rounded-xl p-6 text-center text-gray-400 border border-gray-100">
                        <Clock size={32} className="mx-auto mb-2 text-gray-300" />
                        <p>Aucune activité sur cette période</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <Stat icon={<Package size={16} className="text-indigo-500" />} label="Cartes reçues" value={`${periodStats.cardsReceived}`} color="indigo" />
                        <Stat icon={<TrendingUp size={16} className="text-orange-500" />} label="Vagues de distrib." value={`${periodStats.waves}`} color="orange" />
                        <Stat icon={<Clock size={16} className="text-purple-500" />} label="Tranches de paiement" value={`${periodStats.payments}`} color="purple" />
                        <Stat icon={<TrendingUp size={16} className="text-red-500" />} label="Montant dû" value={fmt(periodStats.amountDue)} color="red" />
                        <Stat icon={<DollarSign size={16} className="text-green-500" />} label="Montant payé" value={fmt(periodStats.amountPaid)} color="green" />
                        <Stat icon={<AlertCircle size={16} className="text-amber-500" />} label="Solde période" value={fmt(Math.max(0, periodStats.remaining))} color={periodStats.remaining <= 0 ? 'green' : 'amber'} />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── TIMELINE TAB ── */}
              {activeTab === 'timeline' && (
                <div className="p-5">
                  {txWithBalance.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                      <Clock size={36} className="mx-auto mb-2 text-gray-300" />
                      <p>Aucune transaction sur cette période</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {txWithBalance.map(tx => {
                        const isDistrib = tx.type === 'partner_distribution';
                        const isExpanded = expandedTx.has(tx.id);
                        return (
                          <div key={tx.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                            <div
                              className={`flex items-start gap-3 p-4 cursor-pointer hover:bg-gray-50 ${isExpanded ? 'bg-gray-50' : ''}`}
                              onClick={() => {
                                setExpandedTx(prev => {
                                  const next = new Set(prev);
                                  if (next.has(tx.id)) next.delete(tx.id); else next.add(tx.id);
                                  return next;
                                });
                              }}
                            >
                              {/* Badge */}
                              <div className={`w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center text-xs font-bold ${isDistrib ? 'bg-indigo-100 text-indigo-700' : 'bg-green-100 text-green-700'}`}>
                                {isDistrib ? '📦' : '💵'}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <div>
                                    <p className="font-semibold text-sm text-gray-900">
                                      {isDistrib ? `Distribution — ${tx.quantity} carte(s)` : 'Paiement reçu'}
                                    </p>
                                    <p className="text-xs text-gray-400 mt-0.5">
                                      {fmtDate(tx.date)} à {fmtTime(tx.date)}
                                    </p>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <p className={`font-bold text-sm ${isDistrib ? 'text-red-600' : 'text-green-600'}`}>
                                      {isDistrib ? '+' : '−'}{fmt(tx.amount)}
                                    </p>
                                    <p className="text-xs text-gray-400">
                                      Solde: <span className={tx.runningBalance > 0 ? 'text-red-500 font-medium' : 'text-green-600 font-medium'}>
                                        {fmt(tx.runningBalance)}
                                      </span>
                                    </p>
                                  </div>
                                </div>
                              </div>

                              {isDistrib && tx.cards && tx.cards.length > 0 && (
                                <button className="text-gray-300 hover:text-gray-500 shrink-0">
                                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </button>
                              )}
                            </div>

                            {/* Expanded card list */}
                            {isExpanded && isDistrib && tx.cards && tx.cards.length > 0 && (
                              <div className="border-t border-gray-100 bg-gray-50 p-4">
                                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Cartes distribuées :</p>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto">
                                  {tx.cards.map(card => (
                                    <div key={card.id} className="flex items-center justify-between bg-white rounded-lg px-2.5 py-1.5 text-xs border border-gray-100">
                                      <span className="font-mono font-bold text-gray-800">{card.cardNumber}</span>
                                      <span className="text-gray-400">{card.value?.toLocaleString()} GNF</span>
                                    </div>
                                  ))}
                                </div>
                                <p className="text-xs text-gray-400 mt-2">Total : {tx.cards.length} carte(s) — {fmt(tx.amount)}</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── CARDS TAB ── */}
              {activeTab === 'cards' && (
                <div className="p-5">
                  {currentCards.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                      <CreditCard size={36} className="mx-auto mb-2 text-gray-300" />
                      <p>Aucune carte actuellement chez ce partenaire</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-gray-500 mb-3">{currentCards.length} carte(s) actuellement chez {partner.name} :</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {currentCards.map((card: any) => (
                          <div key={card.id} className="bg-white rounded-xl p-3 border border-gray-100">
                            <p className="font-mono font-bold text-sm text-gray-900">{card.cardNumber}</p>
                            <div className="flex justify-between text-xs text-gray-400 mt-1">
                              <span>{card.value?.toLocaleString()} GNF</span>
                              <span>Exp. {card.expiryDate ? new Date(card.expiryDate).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }) : '—'}</span>
                            </div>
                            {card.sellingPrice && (
                              <p className="text-xs text-indigo-600 font-medium mt-0.5">Prix : {card.sellingPrice.toLocaleString()} GNF</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    indigo: 'bg-indigo-50 border-indigo-100',
    green: 'bg-green-50 border-green-100',
    red: 'bg-red-50 border-red-100',
    blue: 'bg-blue-50 border-blue-100',
    orange: 'bg-orange-50 border-orange-100',
    purple: 'bg-purple-50 border-purple-100',
    amber: 'bg-amber-50 border-amber-100',
  };
  return (
    <div className={`rounded-xl p-3 border ${colors[color] || 'bg-gray-50 border-gray-100'}`}>
      <div className="flex items-center gap-1.5 mb-1">{icon}<p className="text-xs text-gray-500">{label}</p></div>
      <p className="font-bold text-sm text-gray-900 truncate">{value}</p>
    </div>
  );
}
