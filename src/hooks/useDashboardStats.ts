import { useState, useEffect } from 'react';
import { fetchApi } from '../lib/api';
import { supabase } from '../lib/supabase';

export function useDashboardStats(period: string = 'all') {
  const [stats, setStats] = useState({
    totalStock: 0,
    withPartners: 0,
    salesToday: 0,
    partnerDebt: 0,
    netProfit: 0,
    loading: true
  });

  const loadStats = async () => {
    setStats(prev => ({ ...prev, loading: true }));
    try {
      const data = await fetchApi(`/stats?period=${period}`);
      setStats({ ...data, loading: false });
    } catch (error) {
      console.error("Failed to load stats", error);
      setStats(prev => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    loadStats();

    // Set up real-time subscription
    const cardsSubscription = supabase
      .channel('public:cards')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cards' }, () => {
        loadStats();
      })
      .subscribe();

    const transactionsSubscription = supabase
      .channel('public:transactions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
        loadStats();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(cardsSubscription);
      supabase.removeChannel(transactionsSubscription);
    };
  }, [period]);

  return stats;
}
