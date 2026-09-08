import { useState } from 'react';
import { useDashboardStats } from '../hooks/useDashboardStats';
import { CreditCard, Users, ShoppingCart, DollarSign, TrendingUp, Info, Store, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const [period, setPeriod] = useState('all');
  const { totalStock, withPartners, salesToday, partnerDebt, netProfit, loading } = useDashboardStats(period);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
        
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

      {loading ? (
        <div className="p-8 text-center text-gray-500">Chargement du tableau de bord...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Stock Total</h3>
              <p className="text-2xl font-bold text-gray-900 mt-2">{totalStock}</p>
            </div>
            <div className="p-3 bg-indigo-50 rounded-full">
              <CreditCard className="text-indigo-600" size={24} />
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Chez Partenaires</h3>
              <p className="text-2xl font-bold text-gray-900 mt-2">{withPartners}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-full">
              <Users className="text-blue-600" size={24} />
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Ventes ({period === 'all' ? 'Total' : period})</h3>
              <p className="text-2xl font-bold text-gray-900 mt-2">{salesToday}</p>
            </div>
            <div className="p-3 bg-green-50 rounded-full">
              <ShoppingCart className="text-green-600" size={24} />
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Dette Partenaires</h3>
              <p className="text-2xl font-bold text-red-600 mt-2">{partnerDebt.toLocaleString()} GNF</p>
            </div>
            <div className="p-3 bg-red-50 rounded-full">
              <DollarSign className="text-red-600" size={24} />
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Bénéfice Net ({period === 'all' ? 'Total' : period})</h3>
              <p className="text-2xl font-bold text-emerald-600 mt-2">{netProfit?.toLocaleString() || 0} GNF</p>
            </div>
            <div className="p-3 bg-emerald-50 rounded-full">
              <TrendingUp className="text-emerald-600" size={24} />
            </div>
          </div>

        </div>
      )}

      <div className="mt-8 bg-indigo-50 rounded-xl p-6 border border-indigo-100">
        <h2 className="text-lg font-bold text-indigo-900 mb-4 flex items-center gap-2">
          <Info size={20} />
          Comment fonctionne VisaManager Pro ? (Guide Rapide)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
          
          <Link to="/inventory" className="bg-white p-5 rounded-xl shadow-sm border border-indigo-50 hover:shadow-md transition-shadow relative z-10 block">
            <div className="w-10 h-10 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold text-lg mb-3">1</div>
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <CreditCard size={18} className="text-indigo-600" />
              Alimenter le Stock
            </h3>
            <p className="text-sm text-gray-600 mt-2">
              Allez dans <strong>Stock</strong> pour enregistrer les nouvelles cartes retirées de la banque. C'est votre réserve principale.
            </p>
          </Link>

          <Link to="/partners" className="bg-white p-5 rounded-xl shadow-sm border border-indigo-50 hover:shadow-md transition-shadow relative z-10 block">
            <div className="w-10 h-10 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold text-lg mb-3">2</div>
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <Users size={18} className="text-indigo-600" />
              Gérer les Partenaires
            </h3>
            <p className="text-sm text-gray-600 mt-2">
              Allez dans <strong>Partenaires</strong> pour leur confier des cartes à vendre (crée une dette) et encaisser leur argent plus tard.
            </p>
          </Link>

          <Link to="/agency" className="bg-white p-5 rounded-xl shadow-sm border border-indigo-50 hover:shadow-md transition-shadow relative z-10 block">
            <div className="w-10 h-10 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold text-lg mb-3">3</div>
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <Store size={18} className="text-indigo-600" />
              Vendre en Agence
            </h3>
            <p className="text-sm text-gray-600 mt-2">
              Allez dans <strong>Agence</strong> pour transférer des cartes depuis le stock principal et enregistrer vos ventes directes au comptoir.
            </p>
          </Link>

        </div>
      </div>
    </div>
  );
}
