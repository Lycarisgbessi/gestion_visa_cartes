export interface Card {
  id: string; // Firestore document ID (usually same as cardNumber)
  cardNumber: string;
  value: number;
  entryDate: string; // ISO string
  expiryDate: string; // ISO string
  status: 'in_stock' | 'with_partner' | 'sold' | 'activated' | 'expired';
  location: 'main_stock' | 'agency' | 'partner';
  partnerId?: string;
  agencyId?: string;
  purchasePrice: number;
  sellingPrice: number; // Price sold to partner or agency
  bankName: string;
}

export interface Partner {
  id: string;
  name: string;
  phone: string;
  totalDebt: number;
  totalPaid: number;
  createdAt: string;
}

export interface Agency {
  id: string;
  name: string;
  address: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  type: 'bank_withdrawal' | 'partner_distribution' | 'agency_transfer' | 'agency_sale' | 'partner_payment';
  date: string;
  amount: number;
  partnerId?: string;
  agencyId?: string;
  cardIds: string[];
  cards?: { id: string; cardNumber: string; value: number; sellingPrice: number }[];
  quantity: number;
  description: string;
}
