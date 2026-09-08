import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Partner } from '../types';
import { fetchApi } from '../lib/api';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  partner: Partner | null;
}

export default function PaymentModal({ isOpen, onClose, partner }: PaymentModalProps) {
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  if (!isOpen || !partner) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await fetchApi(`/partners/${partner.id}/payment`, {
        method: 'POST',
        body: JSON.stringify({
          amount: Number(amount),
          date
        })
      });
      onClose();
      setAmount('');
    } catch (error) {
      console.error("Error processing payment:", error);
      alert("Erreur lors du paiement");
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
        
        <h2 className="text-xl font-bold mb-4">Encaisser Paiement - {partner.name}</h2>
        
        <div className="mb-6 bg-gray-50 p-4 rounded-lg">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-500">Dette Totale:</span>
            <span className="font-medium text-red-600">{partner.totalDebt.toLocaleString()} GNF</span>
          </div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-500">Déjà Payé:</span>
            <span className="font-medium text-green-600">{partner.totalPaid.toLocaleString()} GNF</span>
          </div>
          <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-200">
            <span>Reste à Payer:</span>
            <span>{(partner.totalDebt - partner.totalPaid).toLocaleString()} GNF</span>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Date</label>
            <input 
              type="date" 
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2"
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Montant (GNF)</label>
            <input 
              type="number" 
              required
              step="0.01"
              min="0.01"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2"
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
          >
            {loading ? 'Traitement...' : 'Encaisser'}
          </button>
        </form>
      </div>
    </div>
  );
}

