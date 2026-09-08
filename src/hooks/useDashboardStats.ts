import { useState, useEffect } from 'react';
import { fetchApi } from '../lib/api';

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

    const intervalId = setInterval(() => {
      loadStats();
    }, 10000); // Poll every 10 seconds

    return () => {
      clearInterval(intervalId);
    };
  }, [period]);

  return stats;
}
