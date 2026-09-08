import postgres from 'postgres';

const sql = postgres('postgresql://postgres:Amafo.medias.work%402026@db.unkrmxptasyqyukkptdm.supabase.co:5432/postgres', { ssl: 'require' });

async function setupAdvanced() {
  console.log('Starting advanced Supabase configuration...');
  try {
    // 1. Add agencyId to cards if it doesn't exist
    console.log('Updating cards table schema...');
    await sql`ALTER TABLE cards ADD COLUMN IF NOT EXISTS "agencyId" INTEGER REFERENCES agencies(id);`;

    // 2. Create Database Functions and Triggers for automatic financial updates
    console.log('Creating database functions and triggers...');
    
    // Function to update partner financials automatically
    await sql`
      CREATE OR REPLACE FUNCTION update_partner_financials()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.type = 'partner_distribution' THEN
          UPDATE partners SET "totalDebt" = COALESCE("totalDebt", 0) + NEW.amount WHERE id = NEW."partnerId";
        ELSIF NEW.type = 'partner_payment' THEN
          UPDATE partners SET "totalPaid" = COALESCE("totalPaid", 0) + NEW.amount WHERE id = NEW."partnerId";
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `;

    // Drop trigger if exists to recreate it
    await sql`DROP TRIGGER IF EXISTS trigger_update_partner_financials ON transactions;`;
    
    // Create trigger
    await sql`
      CREATE TRIGGER trigger_update_partner_financials
      AFTER INSERT ON transactions
      FOR EACH ROW
      EXECUTE FUNCTION update_partner_financials();
    `;

    // 3. Fix any existing data inconsistencies (e.g., location strings)
    console.log('Cleaning up existing data...');
    await sql`
      UPDATE cards 
      SET location = 'agency', "agencyId" = CAST(REPLACE(location, 'agency_', '') AS INTEGER)
      WHERE location LIKE 'agency_%';
    `;

    // 4. Set up Row Level Security (RLS)
    // For this admin application, we will enable RLS but allow authenticated access
    console.log('Configuring Row Level Security (RLS)...');
    const tables = ['partners', 'agencies', 'cards', 'transactions'];
    
    for (const table of tables) {
      await sql.unsafe(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
      await sql.unsafe(`DROP POLICY IF EXISTS "Allow all access" ON ${table};`);
      // Allowing anon access for now to ensure the frontend works seamlessly with the current setup
      // In a strict production environment with Supabase Auth, this would be 'authenticated'
      await sql.unsafe(`CREATE POLICY "Allow all access" ON ${table} FOR ALL USING (true) WITH CHECK (true);`);
    }

    console.log('Advanced database setup completed successfully!');
  } catch (err) {
    console.error('Error during advanced setup:', err);
  } finally {
    await sql.end();
  }
}

setupAdvanced();
