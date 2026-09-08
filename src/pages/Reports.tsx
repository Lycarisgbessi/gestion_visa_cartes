import React, { useState, useEffect } from 'react';
import { Transaction } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { fetchApi } from '../lib/api';
import { Calendar } from 'lucide-react';

export default function Reports() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<any[]>([]);
  const [period, setPeriod] = useState('30d');

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const data = await fetchApi(`/transactions?period=${period}`) as Transaction[];
      setTransactions(data);
      processChartData(data, period);
    } catch (error) {
      console.error("Failed to load transactions", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, [period]);

  const processChartData = (data: Transaction[], currentPeriod: string) => {
    const stats: Record<string, { sales: number, withdrawals: number }> = {};

    data.forEach(t => {
      const date = parseISO(t.date);
      let key = '';

      if (currentPeriod === '24h') {
        key = format(date, 'HH:mm', { locale: fr });
      } else if (currentPeriod === '7d' || currentPeriod === '30d') {
        key = format(date, 'dd MMM', { locale: fr });
      } else {
        key = format(date, 'MMM yyyy', { locale: fr });
      }

      if (!stats[key]) {
        stats[key] = { sales: 0, withdrawals: 0 };
      }

      if (t.type === 'agency_sale' || t.type === 'partner_distribution') {
        stats[key].sales += t.quantity;
      } else if (t.type === 'bank_withdrawal') {
        stats[key].withdrawals += t.quantity;
      }
    });

    const chart = Object.entries(stats).map(([name, s]) => ({
      name,
      Ventes: s.sales,
      Retraits: s.withdrawals
    })).reverse(); // Show oldest to newest

    setChartData(chart);
  };

  const getTransactionLabel = (type: string) => {
    switch (type) {
      case 'bank_withdrawal': return 'Retrait Banque';
      case 'partner_distribution': return 'Distribution Partenaire';
      case 'agency_transfer': return 'Transfert Agence';
      case 'agency_sale': return 'Vente Agence';
      case 'partner_payment': return 'Paiement Partenaire';
      default: return type;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Rapports & Statistiques</h1>
        
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm">
          <Calendar size={18} className="text-gray-500" />
          <select 
            className="bg-transparent border-none focus:ring-0 text-sm font-medium text-gray-700 cursor-pointer outline-none"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option value="24h">Dernières 24 heures</option>
            <option value="7d">7 derniers jours</option>
            <option value="30d">30 derniers jours</option>
            <option value="3m">3 derniers mois</option>
            <option value="all">Depuis le début</option>
          </select>
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-[400px] flex flex-col">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Mouvements (Quantité)</h2>
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-gray-500">Chargement...</div>
        ) : chartData.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-gray-500">Aucune donnée disponible pour cette période</div>
        ) : (
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="Retraits" fill="#8884d8" name="Retraits Banque" />
                <Bar dataKey="Ventes" fill="#82ca9d" name="Ventes/Distributions" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Historique des Transactions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-6 py-3 font-medium">Date</th>
                <th className="px-6 py-3 font-medium">Type</th>
                <th className="px-6 py-3 font-medium">Description</th>
                <th className="px-6 py-3 font-medium">Quantité</th>
                <th className="px-6 py-3 font-medium">Montant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">Chargement...</td></tr>
              ) : transactions.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">Aucune transaction</td></tr>
              ) : (
                transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3">{new Date(t.date).toLocaleString()}</td>
                    <td className="px-6 py-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {getTransactionLabel(t.type)}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-gray-600">{t.description}</td>
                    <td className="px-6 py-3">{t.quantity > 0 ? t.quantity : '-'}</td>
                    <td className="px-6 py-3 font-medium">
                      {t.amount > 0 ? `${t.amount.toLocaleString()} GNF` : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
