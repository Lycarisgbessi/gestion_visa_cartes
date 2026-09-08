import React, { useState } from 'react';
import { X } from 'lucide-react';
import { fetchApi } from '../lib/api';

interface AddCardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AddCardModal({ isOpen, onClose }: AddCardModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    bankName: '',
    date: new Date().toISOString().split('T')[0],
    value: 10,
    purchasePrice: 0,
    quantity: 1,
    startNumber: '',
    expiryDate: ''
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await fetchApi('/cards/batch', {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      onClose();
    } catch (error) {
      console.error("Error adding cards:", error);
      alert("Erreur lors de l'ajout des cartes");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-700">
          <X size={24} />
        </button>
        
        <h2 className="text-xl font-bold mb-4">Nouveau Retrait Banque</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Banque</label>
            <p className="text-xs text-gray-500 mb-1">Nom de l'institution où vous avez récupéré les cartes.</p>
            <input 
              type="text" 
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2"
              value={formData.bankName}
              onChange={e => setFormData({...formData, bankName: e.target.value})}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Date Retrait</label>
              <p className="text-xs text-gray-500 mb-1">Date d'acquisition du lot.</p>
              <input 
                type="date" 
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2"
                value={formData.date}
                onChange={e => setFormData({...formData, date: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Date Expiration</label>
              <p className="text-xs text-gray-500 mb-1">Date de fin de validité des cartes.</p>
              <input 
                type="date" 
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2"
                value={formData.expiryDate}
                onChange={e => setFormData({...formData, expiryDate: e.target.value})}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Valeur faciale (GNF)</label>
              <p className="text-xs text-gray-500 mb-1">Montant imprimé sur la carte.</p>
              <input 
                type="number" 
                required
                min="0"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2"
                value={formData.value || ''}
                onChange={e => setFormData({...formData, value: Number(e.target.value)})}
                placeholder="ex: 150000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Prix d'achat banque (GNF)</label>
              <p className="text-xs text-gray-500 mb-1">Prix réel payé à la banque.</p>
              <input 
                type="number" 
                required
                step="0.01"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2"
                value={formData.purchasePrice}
                onChange={e => setFormData({...formData, purchasePrice: Number(e.target.value)})}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Quantité</label>
              <p className="text-xs text-gray-500 mb-1">Nombre total de cartes retirées.</p>
              <input 
                type="number" 
                required
                min="1"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2"
                value={formData.quantity}
                onChange={e => setFormData({...formData, quantity: Number(e.target.value)})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">N° Début</label>
              <p className="text-xs text-gray-500 mb-1">Numéro de série de la 1ère carte.</p>
              <input 
                type="number" 
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2"
                value={formData.startNumber}
                onChange={e => setFormData({...formData, startNumber: e.target.value})}
                placeholder="ex: 10001"
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {loading ? 'Enregistrement...' : 'Enregistrer le retrait'}
          </button>
        </form>
      </div>
    </div>
  );
}

