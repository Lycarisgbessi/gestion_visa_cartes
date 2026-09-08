import { neon } from '@neondatabase/serverless';

const sql = neon('postgresql://neondb_owner:npg_MsVK3A6JhwUn@ep-solitary-credit-ax2c9uwj-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require');

export async function fetchApi(endpoint: string, options?: RequestInit) {
  const method = options?.method || 'GET';
  const body = options?.body ? JSON.parse(options.body as string) : null;
  const match = (pattern: RegExp) => endpoint.match(pattern);

  try {
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

      const totalStockRes = await sql`SELECT COUNT(*) as count FROM cards WHERE status = 'in_stock'`;
      const withPartnersRes = await sql`SELECT COUNT(*) as count FROM cards WHERE status = 'with_partner'`;
      const partnersRes = await sql`SELECT "totalDebt" FROM partners`;
      
      const salesTx = await sql`SELECT quantity, "cardIds" FROM transactions WHERE type IN ('agency_sale', 'partner_distribution') AND date >= ${startDate}::timestamp`;
      
      const totalStock = Number(totalStockRes[0].count);
      const withPartners = Number(withPartnersRes[0].count);
      const partnerDebt = partnersRes.reduce((sum, p) => sum + (Number(p.totalDebt) || 0), 0);
      const salesPeriodCount = salesTx.reduce((sum, tx) => sum + (Number(tx.quantity) || 0), 0);

      let netProfit = 0;
      if (salesTx.length > 0) {
        const allCardIds = salesTx.flatMap(tx => tx.cardIds || []);
        if (allCardIds.length > 0) {
           const profitCards = await sql`SELECT "purchasePrice", "sellingPrice" FROM cards WHERE id = ANY(${allCardIds}::int[])`;
           netProfit += profitCards.reduce((sum, c) => sum + (Number(c.sellingPrice) - Number(c.purchasePrice)), 0);
        }
      }

      return { totalStock, withPartners, salesToday: salesPeriodCount, partnerDebt, netProfit };
    }

    if (endpoint === '/stock' && method === 'GET') {
      const data = await sql`SELECT value FROM cards WHERE status = 'in_stock' AND location = 'main_stock'`;
      const stockObj: Record<number, number> = {};
      data.forEach(card => {
        const val = Number(card.value);
        stockObj[val] = (stockObj[val] || 0) + 1;
      });
      return stockObj;
    }

    if (endpoint.startsWith('/cards?') && method === 'GET') {
      const urlParams = new URLSearchParams(endpoint.split('?')[1]);
      const status = urlParams.get('status');
      const search = urlParams.get('search');
      const page = parseInt(urlParams.get('page') || '1');
      const limit = parseInt(urlParams.get('limit') || '100');
      const location = urlParams.get('location');
      const startDate = urlParams.get('startDate');
      const endDate = urlParams.get('endDate');

      await sql`UPDATE cards SET status = 'expired' WHERE status = 'in_stock' AND "expiryDate" < NOW()`;

      let conditions = [];
      let params: any[] = [];
      let paramIdx = 1;

      if (status && status !== 'all') { conditions.push(`status = $${paramIdx++}`); params.push(status); }
      if (location && location !== 'all') { conditions.push(`location = $${paramIdx++}`); params.push(location); }
      if (search) { conditions.push(`"cardNumber" ILIKE $${paramIdx++}`); params.push(`%${search}%`); }
      if (startDate) { conditions.push(`"entryDate" >= $${paramIdx++}`); params.push(new Date(startDate).toISOString()); }
      if (endDate) {
        const endDay = new Date(endDate); endDay.setHours(23, 59, 59, 999);
        conditions.push(`"entryDate" <= $${paramIdx++}`); params.push(endDay.toISOString());
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const countRes = await sql(`SELECT COUNT(*) as count FROM cards ${whereClause}`, params);
      const total = Number(countRes[0].count);
      
      const data = await sql(`SELECT * FROM cards ${whereClause} ORDER BY "entryDate" DESC LIMIT $${paramIdx} OFFSET $${paramIdx+1}`, [...params, limit, (page - 1) * limit]);
      
      return { data, total, page, totalPages: Math.ceil(total / limit) };
    }

    if (endpoint.startsWith('/cards/available') && method === 'GET') {
      const urlParams = new URLSearchParams(endpoint.split('?')[1]);
      const value = urlParams.get('value');
      const location = urlParams.get('location') || 'main_stock';
      const agencyId = urlParams.get('agencyId');
      const partnerId = urlParams.get('partnerId');

      let conditions = [`status = 'in_stock'`, `location = $1`];
      let params: any[] = [location];
      let pIdx = 2;

      if (value) { conditions.push(`value = $${pIdx++}`); params.push(Number(value)); }
      if (agencyId && location === 'agency') { conditions.push(`"agencyId" = $${pIdx++}`); params.push(Number(agencyId)); }
      if (partnerId && location === 'partner') { conditions.push(`"partnerId" = $${pIdx++}`); params.push(Number(partnerId)); }

      const data = await sql(`SELECT id, "cardNumber", value, "purchasePrice", "sellingPrice", "expiryDate" FROM cards WHERE ${conditions.join(' AND ')} ORDER BY "cardNumber" ASC`, params);
      return data || [];
    }

    if (endpoint === '/cards/batch' && method === 'POST') {
      const { bankName, date, value, purchasePrice, quantity, startNumber, expiryDate } = body;
      const cleanStartNum = startNumber.replace(/\s+/g, '');
      let startNum;
      try { startNum = BigInt(cleanStartNum); } catch (e) { throw new Error("Numéro de carte invalide"); }
      
      const insertedCardIds = [];
      
      const entryDateIso = new Date(date).toISOString();
      const expiryDateIso = new Date(expiryDate).toISOString();

      const chunkSize = 1000;
      for (let i = 0; i < quantity; i += chunkSize) {
        const chunkEnd = Math.min(i + chunkSize, quantity);
        let insertValues = [];
        let params = [];
        let pIdx = 1;
        
        for (let j = i; j < chunkEnd; j++) {
          const paddedNum = (startNum + BigInt(j)).toString().padStart(cleanStartNum.length, '0');
          insertValues.push(`($${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, 'in_stock', 'main_stock', $${pIdx++}, 0, $${pIdx++})`);
          params.push(paddedNum, value, entryDateIso, expiryDateIso, purchasePrice, bankName);
        }

        const insertedChunk = await sql(`INSERT INTO cards ("cardNumber", value, "entryDate", "expiryDate", status, location, "purchasePrice", "sellingPrice", "bankName") VALUES ${insertValues.join(', ')} RETURNING id`, params);
        insertedCardIds.push(...insertedChunk.map(c => c.id));
      }

      await sql`
        INSERT INTO transactions (type, date, amount, quantity, "cardIds", description)
        VALUES ('bank_withdrawal', ${entryDateIso}::timestamp, ${purchasePrice * quantity}, ${quantity}, ${insertedCardIds}::int[], ${`Retrait banque ${bankName}`})
      `;

      return { success: true };
    }

    let m = match(/^\/cards\/(\d+)\/status$/);
    if (m && method === 'PATCH') {
      const id = Number(m[1]);
      const { status, location } = body;
      
      if (location === 'main_stock') {
        await sql`UPDATE cards SET status = ${status}, location = ${location}, "agencyId" = NULL, "partnerId" = NULL, "sellingPrice" = 0 WHERE id = ${id}`;
      } else if (location) {
        await sql`UPDATE cards SET status = ${status}, location = ${location} WHERE id = ${id}`;
      } else {
        await sql`UPDATE cards SET status = ${status} WHERE id = ${id}`;
      }
      return { success: true };
    }

    m = match(/^\/cards\/(\d+)$/);
    if (m && method === 'PATCH') {
      const id = Number(m[1]);
      const { cardNumber, value, purchasePrice } = body;
      await sql`UPDATE cards SET "cardNumber" = ${cardNumber}, value = ${value}, "purchasePrice" = ${purchasePrice} WHERE id = ${id}`;
      return { success: true };
    }

    if (m && method === 'DELETE') {
      const id = Number(m[1]);
      await sql`DELETE FROM cards WHERE id = ${id}`;
      return { success: true };
    }

    if (endpoint === '/cards/bulk-delete' && method === 'POST') {
      const { ids } = body;
      await sql`DELETE FROM cards WHERE id = ANY(${ids}::int[])`;
      return { success: true };
    }

    if (endpoint === '/cards/bulk-transfer-partner' && method === 'POST') {
      const { ids, partnerId, sellingPrice } = body;
      await sql`UPDATE cards SET status = 'with_partner', location = 'partner', "partnerId" = ${partnerId}, "sellingPrice" = ${sellingPrice} WHERE id = ANY(${ids}::int[])`;
      const totalAmount = ids.length * sellingPrice;
      await sql`
        INSERT INTO transactions (type, date, amount, quantity, "partnerId", "cardIds", description)
        VALUES ('partner_distribution', NOW(), ${totalAmount}, ${ids.length}, ${partnerId}, ${ids}::int[], ${`Distribution de ${ids.length} cartes au partenaire`})
      `;
      return { success: true };
    }

    if (endpoint === '/cards/bulk-transfer-agency' && method === 'POST') {
      const { ids, agencyId } = body;
      await sql`UPDATE cards SET location = 'agency', "agencyId" = ${agencyId} WHERE id = ANY(${ids}::int[])`;
      await sql`
        INSERT INTO transactions (type, date, amount, quantity, "agencyId", "cardIds", description)
        VALUES ('agency_transfer', NOW(), 0, ${ids.length}, ${agencyId}, ${ids}::int[], ${`Transfert de ${ids.length} cartes vers l'agence`})
      `;
      return { success: true };
    }

    if (endpoint === '/partners' && method === 'GET') {
      return await sql`SELECT * FROM partners ORDER BY "createdAt" DESC`;
    }

    if (endpoint === '/partners' && method === 'POST') {
      const { name, phone } = body;
      const data = await sql`INSERT INTO partners (name, phone) VALUES (${name}, ${phone || ''}) RETURNING id`;
      return { id: data[0].id };
    }

    m = match(/^\/partners\/(\d+)\/distribute$/);
    if (m && method === 'POST') {
      const partnerId = Number(m[1]);
      const { cards, date } = body;

      let totalQuantity = 0;
      let totalAmount = 0;
      let allDistributedCardIds = [];

      for (const item of cards) {
        const { value, quantity, sellingPrice } = item;
        if (quantity <= 0) continue;

        const availableCards = await sql`SELECT id FROM cards WHERE value = ${value} AND location = 'main_stock' AND status = 'in_stock' LIMIT ${quantity}`;

        if (availableCards.length < quantity) {
          throw new Error(`Stock principal insuffisant pour ${value.toLocaleString()} GNF. Demandé: ${quantity}, Dispo: ${availableCards.length}`);
        }

        const cardIds = availableCards.map(c => c.id);
        await sql`UPDATE cards SET status = 'with_partner', location = 'partner', "partnerId" = ${partnerId}, "sellingPrice" = ${sellingPrice} WHERE id = ANY(${cardIds}::int[])`;
        
        allDistributedCardIds.push(...cardIds);
        totalQuantity += quantity;
        totalAmount += (sellingPrice * quantity);
      }

      if (totalQuantity > 0) {
        await sql`
          INSERT INTO transactions (type, date, amount, quantity, "partnerId", "cardIds", description)
          VALUES ('partner_distribution', ${new Date(date || new Date()).toISOString()}::timestamp, ${totalAmount}, ${totalQuantity}, ${partnerId}, ${allDistributedCardIds}::int[], ${`Distribution de ${totalQuantity} cartes au partenaire`})
        `;
      }
      return { success: true };
    }

    m = match(/^\/partners\/(\d+)\/distribute-selected$/);
    if (m && method === 'POST') {
      const partnerId = Number(m[1]);
      const { selectedCards, date } = body;
      if (!selectedCards || selectedCards.length === 0) throw new Error('Aucune carte sélectionnée');

      const cardIds = selectedCards.map((c: any) => c.cardId);
      let totalAmount = 0;

      const byPrice: Record<number, number[]> = {};
      for (const { cardId, sellingPrice } of selectedCards) {
        if (!byPrice[sellingPrice]) byPrice[sellingPrice] = [];
        byPrice[sellingPrice].push(cardId);
        totalAmount += sellingPrice;
      }
      for (const [sellingPrice, ids] of Object.entries(byPrice)) {
        await sql`UPDATE cards SET status = 'with_partner', location = 'partner', "partnerId" = ${partnerId}, "sellingPrice" = ${Number(sellingPrice)} WHERE id = ANY(${ids as number[]}::int[])`;
      }

      await sql`
        INSERT INTO transactions (type, date, amount, quantity, "partnerId", "cardIds", description)
        VALUES ('partner_distribution', ${new Date(date || new Date()).toISOString()}::timestamp, ${totalAmount}, ${cardIds.length}, ${partnerId}, ${cardIds}::int[], ${`Distribution (manuelle) de ${cardIds.length} cartes`})
      `;
      return { success: true };
    }

    m = match(/^\/partners\/(\d+)\/payment$/);
    if (m && method === 'POST') {
      const partnerId = Number(m[1]);
      const { amount, date } = body;

      await sql`
        INSERT INTO transactions (type, date, amount, quantity, "partnerId", description)
        VALUES ('partner_payment', ${new Date(date).toISOString()}::timestamp, ${amount}, 0, ${partnerId}, 'Paiement reçu')
      `;
      return { success: true };
    }

    m = match(/^\/partners\/(\d+)\/details$/);
    if (m && method === 'GET') {
      const partnerId = Number(m[1]);
      const partnerData = await sql`SELECT * FROM partners WHERE id = ${partnerId}`;
      const partner = partnerData[0];
      const currentCards = await sql`SELECT * FROM cards WHERE "partnerId" = ${partnerId} AND status = 'with_partner'`;
      const transactions = await sql`SELECT * FROM transactions WHERE "partnerId" = ${partnerId} ORDER BY date DESC`;

      const allTxCardIds = transactions.flatMap(tx => tx.cardIds || []);
      let allTxCards: any[] = [];
      if (allTxCardIds.length > 0) {
        allTxCards = await sql`SELECT id, "cardNumber", value, "sellingPrice" FROM cards WHERE id = ANY(${allTxCardIds}::int[])`;
      }
      
      const cardsMap = new Map(allTxCards.map(c => [c.id, c]));
      const transactionsWithCards = transactions.map(tx => {
        if (tx.cardIds && tx.cardIds.length > 0) {
          const cards = tx.cardIds.map((id: number) => cardsMap.get(id)).filter(Boolean);
          return { ...tx, cards };
        }
        return { ...tx, cards: [] };
      });

      return { partner, currentCards, transactions: transactionsWithCards };
    }

    m = match(/^\/partners\/(\d+)$/);
    if (m && method === 'DELETE') {
      const partnerId = Number(m[1]);
      await sql`UPDATE cards SET status = 'in_stock', location = 'main_stock', "partnerId" = NULL, "sellingPrice" = 0 WHERE "partnerId" = ${partnerId}`;
      await sql`DELETE FROM transactions WHERE "partnerId" = ${partnerId}`;
      await sql`DELETE FROM partners WHERE id = ${partnerId}`;
      return { success: true };
    }

    if (endpoint === '/agencies' && method === 'GET') {
      return await sql`SELECT * FROM agencies ORDER BY "createdAt" DESC`;
    }

    if (endpoint === '/agencies' && method === 'POST') {
      const { name, address } = body;
      const data = await sql`INSERT INTO agencies (name, address) VALUES (${name}, ${address || ''}) RETURNING id`;
      return { id: data[0].id };
    }

    m = match(/^\/agencies\/(\d+)$/);
    if (m && method === 'DELETE') {
      const agencyId = Number(m[1]);
      await sql`UPDATE cards SET status = 'in_stock', location = 'main_stock', "agencyId" = NULL WHERE "agencyId" = ${agencyId}`;
      await sql`DELETE FROM transactions WHERE "agencyId" = ${agencyId}`;
      await sql`DELETE FROM agencies WHERE id = ${agencyId}`;
      return { success: true };
    }

    if (endpoint === '/agencies/stock' && method === 'GET') {
      const data = await sql`SELECT "agencyId", value FROM cards WHERE location = 'agency' AND status = 'in_stock' AND "agencyId" IS NOT NULL`;
      const stocks: Record<string, Record<number, number>> = {};
      data.forEach(card => {
        const aId = String(card.agencyId);
        if (!stocks[aId]) stocks[aId] = {};
        stocks[aId][Number(card.value)] = (stocks[aId][Number(card.value)] || 0) + 1;
      });
      return stocks;
    }

    m = match(/^\/agencies\/(\d+)\/stock$/);
    if (m && method === 'GET') {
      const agencyId = Number(m[1]);
      const data = await sql`SELECT value FROM cards WHERE location = 'agency' AND "agencyId" = ${agencyId} AND status = 'in_stock'`;
      const stockObj: Record<number, number> = {};
      data.forEach(card => {
        stockObj[Number(card.value)] = (stockObj[Number(card.value)] || 0) + 1;
      });
      return stockObj;
    }

    m = match(/^\/agencies\/(\d+)\/details$/);
    if (m && method === 'GET') {
      const agencyId = Number(m[1]);
      const agencyData = await sql`SELECT * FROM agencies WHERE id = ${agencyId}`;
      const agency = agencyData[0];
      const currentCards = await sql`SELECT * FROM cards WHERE location = 'agency' AND "agencyId" = ${agencyId} AND status = 'in_stock'`;
      const transactions = await sql`SELECT * FROM transactions WHERE "agencyId" = ${agencyId} AND type IN ('agency_transfer', 'agency_sale') ORDER BY date DESC`;

      const allTxCardIds = transactions.flatMap(tx => tx.cardIds || []);
      let allTxCards: any[] = [];
      if (allTxCardIds.length > 0) {
        allTxCards = await sql`SELECT id, "cardNumber", value, "sellingPrice" FROM cards WHERE id = ANY(${allTxCardIds}::int[])`;
      }
      
      const cardsMap = new Map(allTxCards.map(c => [c.id, c]));
      const transactionsWithCards = transactions.map(tx => ({
        ...tx,
        cards: (tx.cardIds || []).map((id: number) => cardsMap.get(id)).filter(Boolean)
      }));

      const totalTransferred = transactions.filter(t => t.type === 'agency_transfer').reduce((sum, t) => sum + Number(t.quantity), 0);
      const totalSold = transactions.filter(t => t.type === 'agency_sale').reduce((sum, t) => sum + Number(t.quantity), 0);
      const totalRevenue = transactions.filter(t => t.type === 'agency_sale').reduce((sum, t) => sum + Number(t.amount), 0);

      return { agency, currentCards, transactions: transactionsWithCards, stats: { totalTransferred, totalSold, totalRevenue } };
    }

    m = match(/^\/agencies\/(\d+)\/transfer-selected$/);
    if (m && method === 'POST') {
      const agencyId = Number(m[1]);
      const { cardIds } = body;
      if (!cardIds || cardIds.length === 0) throw new Error('Aucune carte sélectionnée');

      await sql`UPDATE cards SET location = 'agency', "agencyId" = ${agencyId} WHERE id = ANY(${cardIds}::int[])`;
      await sql`
        INSERT INTO transactions (type, date, amount, quantity, "cardIds", "agencyId", description)
        VALUES ('agency_transfer', NOW(), 0, ${cardIds.length}, ${cardIds}::int[], ${agencyId}, ${`Transfert manuel de ${cardIds.length} cartes`})
      `;
      return { success: true };
    }

    m = match(/^\/agencies\/(\d+)\/transfer$/);
    if (m && method === 'POST') {
      const agencyId = Number(m[1]);
      const { cards } = body;

      let totalQuantity = 0;
      let allTransferredCardIds: number[] = [];

      for (const item of cards) {
        const { value, quantity } = item;
        if (quantity <= 0) continue;

        const availableCards = await sql`SELECT id FROM cards WHERE value = ${value} AND location = 'main_stock' AND status = 'in_stock' LIMIT ${quantity}`;
        if (availableCards.length < quantity) throw new Error(`Stock insuffisant pour ${value.toLocaleString()}`);

        const cardIds = availableCards.map(c => c.id);
        await sql`UPDATE cards SET location = 'agency', "agencyId" = ${agencyId} WHERE id = ANY(${cardIds}::int[])`;
        
        allTransferredCardIds.push(...cardIds);
        totalQuantity += quantity;
      }

      if (totalQuantity > 0) {
        await sql`
          INSERT INTO transactions (type, date, amount, quantity, "cardIds", description, "agencyId")
          VALUES ('agency_transfer', NOW(), 0, ${totalQuantity}, ${allTransferredCardIds}::int[], ${`Transfert vers Agence: ${totalQuantity} cartes`}, ${agencyId})
        `;
      }
      return { success: true };
    }

    m = match(/^\/agencies\/(\d+)\/sale$/);
    if (m && method === 'POST') {
      const agencyId = Number(m[1]);
      const { cards } = body;

      let totalQuantity = 0;
      let totalAmount = 0;
      let allSoldCardIds: number[] = [];

      for (const item of cards) {
        const { value, quantity, sellingPrice } = item;
        if (quantity <= 0) continue;

        const availableCards = await sql`SELECT id FROM cards WHERE value = ${value} AND location = 'agency' AND "agencyId" = ${agencyId} AND status = 'in_stock' LIMIT ${quantity}`;
        if (availableCards.length < quantity) throw new Error(`Stock agence insuffisant`);

        const cardIds = availableCards.map(c => c.id);
        await sql`UPDATE cards SET status = 'sold', "sellingPrice" = ${sellingPrice} WHERE id = ANY(${cardIds}::int[])`;
        
        allSoldCardIds.push(...cardIds);
        totalQuantity += quantity;
        totalAmount += (sellingPrice * quantity);
      }

      if (totalQuantity > 0) {
        await sql`
          INSERT INTO transactions (type, date, amount, quantity, "cardIds", description, "agencyId")
          VALUES ('agency_sale', NOW(), ${totalAmount}, ${totalQuantity}, ${allSoldCardIds}::int[], ${`Vente Agence: ${totalQuantity} cartes`}, ${agencyId})
        `;
      }
      return { success: true };
    }

    if (endpoint.startsWith('/transactions') && method === 'GET') {
      const urlParams = newSearchParams(endpoint.split('?')[1]);
      const period = urlParams.get('period') || 'all';
      
      let conditions = [];
      let params: any[] = [];
      
      if (period !== 'all') {
        let startDate = new Date(0).toISOString();
        const now = new Date();
        if (period === '24h') startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
        else if (period === '7d') startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        else if (period === '30d') startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        else if (period === '3m') startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
        
        conditions.push(`date >= $1`);
        params.push(startDate);
      }
      
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : 'LIMIT 500';
      const queryStr = `SELECT * FROM transactions ${whereClause} ORDER BY date DESC`;
      
      const data = await sql(queryStr, params);
      return data;
    }

    if (endpoint === '/system/reset' && method === 'POST') {
      await sql`DELETE FROM transactions`;
      await sql`DELETE FROM cards`;
      await sql`DELETE FROM partners`;
      await sql`DELETE FROM agencies`;
      return { success: true };
    }

    throw new Error(`Endpoint not found: ${method} ${endpoint}`);
  } catch (error: any) {
    console.error('API Error:', error);
    throw new Error(error.message || 'Unknown error');
  }
}

// polyfill search params if missing in environments
function newSearchParams(str: string) {
  return new URLSearchParams(str);
}
