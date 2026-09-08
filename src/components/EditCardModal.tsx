import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { fetchApi } from '../lib/api';
import { Card } from '../types';

interface EditCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  card: Card | null;
}

export default function EditCardModal({ isOpen, onClose, card }: EditCardModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    cardNumber: '',
    value: 0,
    purchasePrice: 0,
  });

  useEffect(() => {
    if (card) {
      setFormData({
        cardNumber: card.cardNumber,
        value: card.value,
        purchasePrice: card.purchasePrice,
      });
    }
  }, [card]);

  if (!isOpen || !card) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await fetchApi(`/cards/${card.id}`, {
        method: 'PATCH',
        body: JSON.stringify(formData)
      });
      onClose();
    } catch (error) {
      console.error("Error updating card:", error);
      alert("Erreur lors de la modification de la carte");
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
        
        <h2 className="text-xl font-bold mb-4">Modifier la Carte</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Numéro de série</label>
            <input 
              type="text" 
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2"
              value={formData.cardNumber}
              onChange={e => setFormData({...formData, cardNumber: e.target.value})}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Valeur faciale (GNF)</label>
              <input 
                type="number" 
                required
                min="0"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2"
                value={formData.value || ''}
                onChange={e => setFormData({...formData, value: Number(e.target.value)})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Prix d'achat (GNF)</label>
              <input 
                type="number" 
                required
                step="0.01"
                min="0"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2"
                value={formData.purchasePrice || ''}
                onChange={e => setFormData({...formData, purchasePrice: Number(e.target.value)})}
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {loading ? 'Enregistrement...' : 'Sauvegarder les modifications'}
          </button>
        </form>
      </div>
    </div>
  );
}

