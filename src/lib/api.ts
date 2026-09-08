import { supabase } from './supabase';

export async function fetchApi(endpoint: string, options?: RequestInit) {
  const method = options?.method || 'GET';
  const body = options?.body ? JSON.parse(options.body as string) : null;

  // Helper to parse endpoint
  const match = (pattern: RegExp) => endpoint.match(pattern);

  try {
    // --- Stats ---
    if (endpoint.startsWith('/stats') && method === 'GET') {
      const urlParams = new URLSearchParams(endpoint.split('?')[1]);
      const period = urlParams.get('period') || 'all';
      
      let startDate = new Date(0).toISOString();
      const now = new Date();
      if (period === '24h') {
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      } else if (period === '7d') {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      } else if (period === '30d') {
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      } else if (period === '3m') {
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
      }

      // 1. Snapshot stats (Stock & Debt)
      const [{ count: totalStock }, { count: withPartners }, { data: partners }] = await Promise.all([
        supabase.from('cards').select('*', { count: 'exact', head: true }).eq('status', 'in_stock'),
        supabase.from('cards').select('*', { count: 'exact', head: true }).eq('status', 'with_partner'),
        supabase.from('partners').select('totalDebt')
      ]);

      // 2. Sales in period
      const { data: salesTx } = await supabase.from('transactions')
        .select('quantity, cardIds')
        .in('type', ['agency_sale', 'partner_distribution'])
        .gte('date', startDate);

      const salesPeriodCount = salesTx?.reduce((sum, tx) => sum + (tx.quantity || 0), 0) || 0;
      const partnerDebt = partners?.reduce((sum, p) => sum + (Number(p.totalDebt) || 0), 0) || 0;

      // 3. Net Profit in period
      let netProfit = 0;
      if (salesTx && salesTx.length > 0) {
        // Extract all card IDs sold in this period
        const allCardIds = salesTx.flatMap(tx => tx.cardIds || []);
        if (allCardIds.length > 0) {
           // Fetch purchase and selling prices for these cards in chunks concurrently
           const chunkSize = 1000;
           const chunks = [];
           for (let i = 0; i < allCardIds.length; i += chunkSize) {
             chunks.push(allCardIds.slice(i, i + chunkSize));
           }
           
           const results = await Promise.all(chunks.map(chunk => 
             supabase.from('cards')
               .select('purchasePrice, sellingPrice')
               .in('id', chunk)
           ));
           
           results.forEach(({ data: profitCards }) => {
             netProfit += profitCards?.reduce((sum, c) => sum + (Number(c.sellingPrice) - Number(c.purchasePrice)), 0) || 0;
           });
        }
      }

      return { totalStock, withPartners, salesToday: salesPeriodCount, partnerDebt, netProfit };
    }

    // --- Stock ---
    if (endpoint === '/stock' && method === 'GET') {
      const { data } = await supabase.from('cards').select('value').eq('status', 'in_stock').eq('location', 'main_stock');
      const stockObj: Record<number, number> = {};
      data?.forEach(card => {
        stockObj[card.value] = (stockObj[card.value] || 0) + 1;
      });
      return stockObj;
    }

    // --- Cards ---
    if (endpoint.startsWith('/cards?') && method === 'GET') {
      const urlParams = new URLSearchParams(endpoint.split('?')[1]);
      const status = urlParams.get('status');
      const search = urlParams.get('search');
      const page = parseInt(urlParams.get('page') || '1');
      const limit = parseInt(urlParams.get('limit') || '100');
      const location = urlParams.get('location');
      const startDate = urlParams.get('startDate');
      const endDate = urlParams.get('endDate');

      // 1. Auto-expire cards that are in_stock and past expiry date
      const today = new Date().toISOString();
      await supabase
        .from('cards')
        .update({ status: 'expired' })
        .eq('status', 'in_stock')
        .lt('expiryDate', today);

      // 2. Build the query
      let query = supabase.from('cards').select('*', { count: 'exact' });
      if (status && status !== 'all') query = query.eq('status', status);
      if (location && location !== 'all') query = query.eq('location', location);
      if (search) query = query.ilike('cardNumber', `%${search}%`);
      
      if (startDate) {
        query = query.gte('entryDate', new Date(startDate).toISOString());
      }
      if (endDate) {
        // Set to end of day
        const endDay = new Date(endDate);
        endDay.setHours(23, 59, 59, 999);
        query = query.lte('entryDate', endDay.toISOString());
      }

      const { data, count, error } = await query
        .order('entryDate', { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      if (error) throw error;
      return { data, total: count, page, totalPages: Math.ceil((count || 0) / limit) };
    }

    // --- Cards available for selection (by value, location) ---
    if (endpoint.startsWith('/cards/available') && method === 'GET') {
      const urlParams = new URLSearchParams(endpoint.split('?')[1]);
      const value = urlParams.get('value');
      const location = urlParams.get('location') || 'main_stock';
      const agencyId = urlParams.get('agencyId');
      const partnerId = urlParams.get('partnerId');

      let query = supabase
        .from('cards')
        .select('id, cardNumber, value, purchasePrice, sellingPrice, expiryDate')
        .eq('status', 'in_stock')
        .eq('location', location);

      if (value) query = query.eq('value', Number(value));
      if (agencyId && location === 'agency') query = query.eq('agencyId', agencyId);
      if (partnerId && location === 'partner') query = query.eq('partnerId', partnerId);

      const { data, error } = await query.order('cardNumber', { ascending: true });
      if (error) throw error;
      return data || [];
    }

    if (endpoint === '/cards/batch' && method === 'POST') {
      const { bankName, date, value, purchasePrice, quantity, startNumber, expiryDate } = body;
      const cardsToInsert = [];
      const cleanStartNum = startNumber.replace(/\s+/g, '');
      let startNum;
      
      try {
        startNum = BigInt(cleanStartNum);
      } catch (e) {
        throw new Error("Numéro de carte invalide");
      }
      
      for (let i = 0; i < quantity; i++) {
        const nextNum = (startNum + BigInt(i)).toString();
        const paddedNum = nextNum.padStart(cleanStartNum.length, '0');
        cardsToInsert.push({
          cardNumber: paddedNum,
          value,
          entryDate: new Date(date).toISOString(),
          expiryDate: new Date(expiryDate).toISOString(),
          status: 'in_stock',
          location: 'main_stock',
          purchasePrice,
          sellingPrice: 0,
          bankName
        });
      }

      const chunkSize = 1000;
      const insertedCardIds = [];
      for (let i = 0; i < cardsToInsert.length; i += chunkSize) {
        const chunk = cardsToInsert.slice(i, i + chunkSize);
        const { data: insertedChunk, error: cardsError } = await supabase.from('cards').insert(chunk).select('id');
        if (cardsError) throw cardsError;
        if (insertedChunk) insertedCardIds.push(...insertedChunk.map(c => c.id));
      }

      const { error: txError } = await supabase.from('transactions').insert({
        type: 'bank_withdrawal',
        date: new Date(date).toISOString(),
        amount: purchasePrice * quantity,
        quantity,
        cardIds: insertedCardIds,
        description: `Retrait banque ${bankName}`
      });
      if (txError) throw txError;

      return { success: true };
    }

    let m = match(/^\/cards\/(\d+)\/status$/);
    if (m && method === 'PATCH') {
      const id = m[1];
      const { status, location } = body;
      const updateData: any = { status };
      if (location) {
        updateData.location = location;
        if (location === 'main_stock') {
          updateData.agencyId = null;
          updateData.partnerId = null;
          updateData.sellingPrice = 0;
        }
      }
      
      const { error } = await supabase.from('cards').update(updateData).eq('id', id);
      if (error) throw error;
      return { success: true };
    }

    m = match(/^\/cards\/(\d+)$/);
    if (m && method === 'PATCH') {
      const id = m[1];
      const { cardNumber, value, purchasePrice } = body;
      const { error } = await supabase.from('cards').update({ cardNumber, value, purchasePrice }).eq('id', id);
      if (error) throw error;
      return { success: true };
    }

    if (m && method === 'DELETE') {
      const id = m[1];
      const { error } = await supabase.from('cards').delete().eq('id', id);
      if (error) throw error;
      return { success: true };
    }

    if (endpoint === '/cards/bulk-delete' && method === 'POST') {
      const { ids } = body;
      const { error } = await supabase.from('cards').delete().in('id', ids);
      if (error) throw error;
      return { success: true };
    }

    if (endpoint === '/cards/bulk-transfer-partner' && method === 'POST') {
      const { ids, partnerId, sellingPrice } = body;
      await supabase.from('cards').update({ status: 'with_partner', location: 'partner', partnerId, sellingPrice }).in('id', ids);
      const totalAmount = ids.length * sellingPrice;
      await supabase.from('transactions').insert({
        type: 'partner_distribution',
        date: new Date().toISOString(),
        amount: totalAmount,
        quantity: ids.length,
        partnerId,
        cardIds: ids,
        description: `Distribution de ${ids.length} cartes au partenaire`
      });
      return { success: true };
    }

    if (endpoint === '/cards/bulk-transfer-agency' && method === 'POST') {
      const { ids, agencyId } = body;
      await supabase.from('cards').update({ location: 'agency', agencyId }).in('id', ids);
      await supabase.from('transactions').insert({
        type: 'agency_transfer',
        date: new Date().toISOString(),
        amount: 0,
        quantity: ids.length,
        cardIds: ids,
        agencyId,
        description: `Transfert de ${ids.length} cartes vers l'agence`
      });
      return { success: true };
    }

    // --- Partners ---
    if (endpoint === '/partners' && method === 'GET') {
      const { data, error } = await supabase.from('partners').select('*').order('createdAt', { ascending: false });
      if (error) throw error;
      return data;
    }

    if (endpoint === '/partners' && method === 'POST') {
      const { name, phone } = body;
      const { data, error } = await supabase.from('partners').insert({ name, phone }).select('id').single();
      if (error) throw error;
      return { id: data.id };
    }

    m = match(/^\/partners\/(\d+)\/distribute$/);
    if (m && method === 'POST') {
      const partnerId = m[1];
      const { cards, date } = body;

      let totalQuantity = 0;
      let totalAmount = 0;
      let allDistributedCardIds: number[] = [];

      for (const item of cards) {
        const { value, quantity, sellingPrice } = item;
        if (quantity <= 0) continue;

        const { data: availableCards } = await supabase.from('cards')
          .select('id')
          .eq('value', value)
          .eq('location', 'main_stock')
          .eq('status', 'in_stock')
          .limit(quantity);

        if (!availableCards || availableCards.length < quantity) {
          throw new Error(`Stock principal insuffisant pour les cartes de ${value.toLocaleString()} GNF. Demandé: ${quantity}, Disponible: ${availableCards?.length || 0}`);
        }

        const cardIds = availableCards.map(c => c.id);
        await supabase.from('cards').update({ status: 'with_partner', location: 'partner', partnerId, sellingPrice }).in('id', cardIds);
        
        allDistributedCardIds.push(...cardIds);
        totalQuantity += quantity;
        totalAmount += (sellingPrice * quantity);
      }

      if (totalQuantity > 0) {
        await supabase.from('transactions').insert({
          type: 'partner_distribution',
          date: new Date(date || new Date().toISOString()).toISOString(),
          amount: totalAmount,
          quantity: totalQuantity,
          partnerId,
          cardIds: allDistributedCardIds,
          description: `Distribution de ${totalQuantity} cartes au partenaire`
        });
      }
      return { success: true };
    }

    // --- Distribute by specific card IDs (manual card selection) ---
    m = match(/^\/partners\/(\d+)\/distribute-selected$/);
    if (m && method === 'POST') {
      const partnerId = m[1];
      const { selectedCards, date } = body;
      // selectedCards: Array of { cardId: number, sellingPrice: number }
      if (!selectedCards || selectedCards.length === 0) throw new Error('Aucune carte sélectionnée');

      const cardIds = selectedCards.map((c: any) => c.cardId);
      let totalAmount = 0;

      // Update each card individually with its own selling price (or do in groups by price)
      const byPrice: Record<number, number[]> = {};
      for (const { cardId, sellingPrice } of selectedCards) {
        if (!byPrice[sellingPrice]) byPrice[sellingPrice] = [];
        byPrice[sellingPrice].push(cardId);
        totalAmount += sellingPrice;
      }
      for (const [sellingPrice, ids] of Object.entries(byPrice)) {
        await supabase.from('cards')
          .update({ status: 'with_partner', location: 'partner', partnerId, sellingPrice: Number(sellingPrice) })
          .in('id', ids);
      }

      await supabase.from('transactions').insert({
        type: 'partner_distribution',
        date: new Date(date || new Date().toISOString()).toISOString(),
        amount: totalAmount,
        quantity: cardIds.length,
        partnerId,
        cardIds,
        description: `Distribution de ${cardIds.length} cartes au partenaire (sélection manuelle)`
      });
      return { success: true };
    }

    m = match(/^\/partners\/(\d+)\/payment$/);
    if (m && method === 'POST') {
      const partnerId = m[1];
      const { amount, date } = body;

      await supabase.from('transactions').insert({
        type: 'partner_payment',
        date: new Date(date).toISOString(),
        amount,
        quantity: 0,
        partnerId,
        description: 'Paiement reçu'
      });
      return { success: true };
    }

    m = match(/^\/partners\/(\d+)\/details$/);
    if (m && method === 'GET') {
      const partnerId = m[1];
      const { data: partner } = await supabase.from('partners').select('*').eq('id', partnerId).single();
      const { data: currentCards } = await supabase.from('cards').select('*').eq('partnerId', partnerId).eq('status', 'with_partner');
      const { data: transactions } = await supabase.from('transactions').select('*').eq('partnerId', partnerId).order('date', { ascending: false });

      // Optimize: Fetch all cards for all transactions in one go concurrently
      const allTxCardIds = (transactions || []).flatMap(tx => tx.cardIds || []);
      let allTxCards: any[] = [];
      
      if (allTxCardIds.length > 0) {
        const chunkSize = 1000;
        const chunks = [];
        for (let i = 0; i < allTxCardIds.length; i += chunkSize) {
          chunks.push(allTxCardIds.slice(i, i + chunkSize));
        }
        
        const results = await Promise.all(chunks.map(chunk => 
          supabase.from('cards').select('id, cardNumber, value, sellingPrice').in('id', chunk)
        ));
        
        results.forEach(({ data: cardsChunk }) => {
          if (cardsChunk) allTxCards.push(...cardsChunk);
        });
      }

      const cardsMap = new Map(allTxCards.map(c => [c.id, c]));

      const transactionsWithCards = (transactions || []).map(tx => {
        if (tx.cardIds && tx.cardIds.length > 0) {
          const cards = tx.cardIds.map((id: string) => cardsMap.get(id)).filter(Boolean);
          return { ...tx, cards };
        }
        return { ...tx, cards: [] };
      });

      return { partner, currentCards, transactions: transactionsWithCards };
    }

    // --- Delete Partner ---
    m = match(/^\/partners\/(\d+)$/);;
    if (m && method === 'DELETE') {
      const partnerId = m[1];
      // Return cards to main stock
      await supabase.from('cards')
        .update({ status: 'in_stock', location: 'main_stock', partnerId: null, sellingPrice: null })
        .eq('partnerId', partnerId);
      // Delete all partner transactions
      await supabase.from('transactions').delete().eq('partnerId', partnerId);
      // Delete partner
      await supabase.from('partners').delete().eq('id', partnerId);
      return { success: true };
    }

    // --- Agencies ---
    if (endpoint === '/agencies' && method === 'GET') {
      const { data, error } = await supabase.from('agencies').select('*').order('createdAt', { ascending: false });
      if (error) throw error;
      return data;
    }

    if (endpoint === '/agencies' && method === 'POST') {
      const { name, address } = body;
      const { data, error } = await supabase.from('agencies').insert({ name, address: address || '' }).select('id').single();
      if (error) throw error;
      return { id: data.id };
    }

    // --- Delete Agency ---
    m = match(/^\/agencies\/(\d+)$/);;
    if (m && method === 'DELETE') {
      const agencyId = m[1];
      // Return cards to main stock
      await supabase.from('cards')
        .update({ status: 'in_stock', location: 'main_stock', agencyId: null })
        .eq('agencyId', agencyId);
      // Delete all agency transactions
      await supabase.from('transactions').delete().eq('agencyId', agencyId);
      // Delete agency
      await supabase.from('agencies').delete().eq('id', agencyId);
      return { success: true };
    }

    if (endpoint === '/agencies/stock' && method === 'GET') {
      const { data } = await supabase.from('cards')
        .select('agencyId, value')
        .eq('location', 'agency')
        .eq('status', 'in_stock')
        .not('agencyId', 'is', null);
        
      const stocks: Record<string, Record<number, number>> = {};
      
      if (data) {
        data.forEach(card => {
          if (card.agencyId) {
            if (!stocks[card.agencyId]) {
              stocks[card.agencyId] = {};
            }
            stocks[card.agencyId][card.value] = (stocks[card.agencyId][card.value] || 0) + 1;
          }
        });
      }
      
      return stocks;
    }

    m = match(/^\/agencies\/(\d+)\/stock$/);
    if (m && method === 'GET') {
      const agencyId = m[1];
      const { data } = await supabase.from('cards').select('value').eq('location', 'agency').eq('agencyId', agencyId).eq('status', 'in_stock');
      const stockObj: Record<number, number> = {};
      data?.forEach(card => {
        stockObj[card.value] = (stockObj[card.value] || 0) + 1;
      });
      return stockObj;
    }

    m = match(/^\/agencies\/(\d+)\/details$/);
    if (m && method === 'GET') {
      const agencyId = m[1];
      const [{ data: agency }, { data: currentCards }, { data: transactions }] = await Promise.all([
        supabase.from('agencies').select('*').eq('id', agencyId).single(),
        supabase.from('cards').select('*').eq('location', 'agency').eq('agencyId', agencyId).eq('status', 'in_stock'),
        supabase.from('transactions').select('*').or(`agencyId.eq.${agencyId}`).in('type', ['agency_transfer', 'agency_sale']).order('date', { ascending: false })
      ]);

      // Enrich transactions with card details
      const allTxCardIds = (transactions || []).flatMap((tx: any) => tx.cardIds || []);
      let allTxCards: any[] = [];
      if (allTxCardIds.length > 0) {
        const chunkSize = 1000;
        const chunks = [];
        for (let i = 0; i < allTxCardIds.length; i += chunkSize) chunks.push(allTxCardIds.slice(i, i + chunkSize));
        const results = await Promise.all(chunks.map((chunk: any[]) => supabase.from('cards').select('id, cardNumber, value, sellingPrice').in('id', chunk)));
        results.forEach(({ data: cardsChunk }) => { if (cardsChunk) allTxCards.push(...cardsChunk); });
      }
      const cardsMap = new Map(allTxCards.map((c: any) => [c.id, c]));
      const transactionsWithCards = (transactions || []).map((tx: any) => ({
        ...tx,
        cards: (tx.cardIds || []).map((id: string) => cardsMap.get(id)).filter(Boolean)
      }));

      // Summary stats
      const totalTransferred = (transactions || []).filter((t: any) => t.type === 'agency_transfer').reduce((sum: number, t: any) => sum + t.quantity, 0);
      const totalSold = (transactions || []).filter((t: any) => t.type === 'agency_sale').reduce((sum: number, t: any) => sum + t.quantity, 0);
      const totalRevenue = (transactions || []).filter((t: any) => t.type === 'agency_sale').reduce((sum: number, t: any) => sum + t.amount, 0);

      return { agency, currentCards, transactions: transactionsWithCards, stats: { totalTransferred, totalSold, totalRevenue } };
    }

    // --- Transfer by specific card IDs to agency (manual card selection) ---
    m = match(/^\/agencies\/(\d+)\/transfer-selected$/);
    if (m && method === 'POST') {
      const agencyId = m[1];
      const { cardIds } = body;
      if (!cardIds || cardIds.length === 0) throw new Error('Aucune carte sélectionnée');

      await supabase.from('cards')
        .update({ location: 'agency', agencyId })
        .in('id', cardIds);

      await supabase.from('transactions').insert({
        type: 'agency_transfer',
        date: new Date().toISOString(),
        amount: 0,
        quantity: cardIds.length,
        cardIds,
        agencyId,
        description: `Transfert de ${cardIds.length} cartes vers l'agence (sélection manuelle)`
      });
      return { success: true };
    }

    m = match(/^\/agencies\/(\d+)\/transfer$/);
    if (m && method === 'POST') {
      const agencyId = m[1];
      const { cards } = body;

      let totalQuantity = 0;
      let allTransferredCardIds: number[] = [];

      for (const item of cards) {
        const { value, quantity } = item;
        if (quantity <= 0) continue;

        const { data: availableCards } = await supabase.from('cards')
          .select('id')
          .eq('value', value)
          .eq('location', 'main_stock')
          .eq('status', 'in_stock')
          .limit(quantity);

        if (!availableCards || availableCards.length < quantity) {
          throw new Error(`Stock insuffisant pour les cartes de ${value.toLocaleString()} GNF. Demandé: ${quantity}, Disponible: ${availableCards?.length || 0}`);
        }

        const cardIds = availableCards.map(c => c.id);
        await supabase.from('cards').update({ location: 'agency', agencyId }).in('id', cardIds);
        
        allTransferredCardIds.push(...cardIds);
        totalQuantity += quantity;
      }

      if (totalQuantity > 0) {
        await supabase.from('transactions').insert({
          type: 'agency_transfer',
          date: new Date().toISOString(),
          amount: 0,
          quantity: totalQuantity,
          cardIds: allTransferredCardIds,
          description: `Transfert vers Agence: ${totalQuantity} cartes`,
          agencyId
        });
      }
      return { success: true };
    }

    m = match(/^\/agencies\/(\d+)\/sale$/);
    if (m && method === 'POST') {
      const agencyId = m[1];
      const { cards } = body;

      let totalQuantity = 0;
      let totalAmount = 0;
      let allSoldCardIds: number[] = [];

      for (const item of cards) {
        const { value, quantity, sellingPrice } = item;
        if (quantity <= 0) continue;

        const { data: availableCards } = await supabase.from('cards')
          .select('id')
          .eq('value', value)
          .eq('location', 'agency')
          .eq('agencyId', agencyId)
          .eq('status', 'in_stock')
          .limit(quantity);

        if (!availableCards || availableCards.length < quantity) {
          throw new Error(`Stock insuffisant pour les cartes de ${value}$ dans l'agence. Demandé: ${quantity}, Disponible: ${availableCards?.length || 0}`);
        }

        const cardIds = availableCards.map(c => c.id);
        await supabase.from('cards').update({ status: 'sold', sellingPrice }).in('id', cardIds);
        
        allSoldCardIds.push(...cardIds);
        totalQuantity += quantity;
        totalAmount += (sellingPrice * quantity);
      }

      if (totalQuantity > 0) {
        await supabase.from('transactions').insert({
          type: 'agency_sale',
          date: new Date().toISOString(),
          amount: totalAmount,
          quantity: totalQuantity,
          cardIds: allSoldCardIds,
          description: `Vente Agence: ${totalQuantity} cartes`,
          agencyId
        });
      }
      return { success: true };
    }

    // --- Transactions ---
    if (endpoint.startsWith('/transactions') && method === 'GET') {
      const urlParams = new URLSearchParams(endpoint.split('?')[1]);
      const period = urlParams.get('period') || 'all';
      
      let query = supabase.from('transactions').select('*').order('date', { ascending: false });
      
      if (period !== 'all') {
        let startDate = new Date(0).toISOString();
        const now = new Date();
        if (period === '24h') {
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
        } else if (period === '7d') {
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        } else if (period === '30d') {
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        } else if (period === '3m') {
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
        }
        query = query.gte('date', startDate);
      } else {
        query = query.limit(500); // Limit to 500 for 'all' to prevent massive payloads
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    }

    // --- System ---
    if (endpoint === '/system/reset' && method === 'POST') {
      await supabase.from('transactions').delete().not('id', 'is', null);
      await supabase.from('cards').delete().not('id', 'is', null);
      await supabase.from('partners').delete().not('id', 'is', null);
      await supabase.from('agencies').delete().not('id', 'is', null);
      return { success: true };
    }

    throw new Error(`Endpoint not found: ${method} ${endpoint}`);
  } catch (error: any) {
    console.error('API Error:', error);
    throw new Error(error.message || 'Unknown error');
  }
}
