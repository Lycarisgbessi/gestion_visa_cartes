import React, { useState } from 'react';
import { fetchApi } from '../lib/api';
import { ShieldAlert, Trash2, CheckCircle2 } from 'lucide-react';

export default function Settings() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [confirmText, setConfirmText] = useState('');

  const handleReset = async () => {
    if (confirmText !== 'REINITIALISER') {
      setError('Veuillez taper REINITIALISER pour confirmer.');
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccess(false);
    
    try {
      await fetchApi('/system/reset', { method: 'POST' });
      setSuccess(true);
      setConfirmText('');
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue lors de la réinitialisation.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900">Paramètres</h1>

      <div className="bg-white rounded-xl shadow-sm border border-red-100 overflow-hidden">
        <div className="bg-red-50 p-4 border-b border-red-100 flex items-center gap-3">
          <ShieldAlert className="text-red-600" size={24} />
          <div>
            <h2 className="text-lg font-bold text-red-900">Zone de Danger</h2>
            <p className="text-red-700 text-sm">Actions irréversibles concernant les données de l'application.</p>
          </div>
        </div>
        
        <div className="p-6">
          <h3 className="text-md font-semibold text-gray-900 mb-2">Réinitialiser l'outil</h3>
          <p className="text-gray-600 text-sm mb-6">
            Cette action va supprimer <strong>définitivement</strong> toutes les cartes, tous les partenaires, toutes les agences et tout l'historique des transactions. Cette action est irréversible.
          </p>

          {success && (
            <div className="bg-green-50 text-green-700 p-4 rounded-lg flex items-center gap-2 mb-4">
              <CheckCircle2 size={20} />
              Toutes les données ont été réinitialisées avec succès.
            </div>
          )}

          <div className="space-y-4">
            {error && <div className="text-red-500 text-sm bg-red-50 p-2 rounded">{error}</div>}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tapez <strong>REINITIALISER</strong> pour confirmer :
              </label>
              <input 
                type="text" 
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
                placeholder="REINITIALISER"
              />
            </div>
            <button
              onClick={handleReset}
              disabled={loading || confirmText !== 'REINITIALISER'}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              <Trash2 size={18} />
              {loading ? 'Réinitialisation...' : 'Effacer toutes les données'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
