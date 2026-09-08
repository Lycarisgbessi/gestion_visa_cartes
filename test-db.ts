import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://unkrmxptasyqyukkptdm.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_G084d_9FsdmeSBkflmURlw_7wDDEzGS';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  try {
    const cardsToInsert = [{
      cardNumber: 'TEST-999',
      value: 1000,
      entryDate: new Date().toISOString(),
      expiryDate: new Date('2024-01-01').toISOString(),
      status: 'in_stock',
      location: 'main_stock',
      purchasePrice: 500,
      sellingPrice: 0,
      bankName: 'TestBank'
    }];
    console.log('Inserting card...');
    const { data, error } = await supabase.from('cards').insert(cardsToInsert).select();
    if (error) {
      console.error('Card insert error:', error);
      return;
    }
    console.log('Card insert success:', data);

    console.log('Inserting tx...');
    const { data: txData, error: txError } = await supabase.from('transactions').insert({
      type: 'bank_withdrawal',
      date: new Date().toISOString(),
      amount: 500,
      quantity: 1,
      description: 'Retrait banque TestBank'
    }).select();

    if (txError) {
      console.error('Tx insert error:', txError);
      return;
    }
    console.log('Tx insert success:', txData);

  } catch (err) {
    console.error('Error:', err);
  }
}

test();
