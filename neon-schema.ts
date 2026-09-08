import { neon } from '@neondatabase/serverless';

const sql = neon('postgresql://neondb_owner:npg_MsVK3A6JhwUn@ep-solitary-credit-ax2c9uwj-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require');

async function setupNeon() {
  console.log('Creating schema in Neon DB...');
  try {
    // Drop existing tables if needed (optional, assuming fresh DB)
    await sql`DROP TABLE IF EXISTS transactions;`;
    await sql`DROP TABLE IF EXISTS cards;`;
    await sql`DROP TABLE IF EXISTS partners;`;
    await sql`DROP TABLE IF EXISTS agencies;`;

    // 1. Agencies
    await sql`
      CREATE TABLE agencies (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        address TEXT,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    console.log('Agencies table created.');

    // 2. Partners
    await sql`
      CREATE TABLE partners (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT,
        "totalDebt" BIGINT DEFAULT 0,
        "totalPaid" BIGINT DEFAULT 0,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    console.log('Partners table created.');

    // 3. Cards
    await sql`
      CREATE TABLE cards (
        id SERIAL PRIMARY KEY,
        "cardNumber" TEXT NOT NULL UNIQUE,
        value BIGINT NOT NULL,
        "entryDate" TIMESTAMP WITH TIME ZONE NOT NULL,
        "expiryDate" TIMESTAMP WITH TIME ZONE NOT NULL,
        status TEXT NOT NULL,
        location TEXT NOT NULL,
        "partnerId" INTEGER REFERENCES partners(id) ON DELETE SET NULL,
        "agencyId" INTEGER REFERENCES agencies(id) ON DELETE SET NULL,
        "purchasePrice" BIGINT NOT NULL,
        "sellingPrice" BIGINT DEFAULT 0,
        "bankName" TEXT NOT NULL
      );
    `;
    console.log('Cards table created.');

    // 4. Transactions
    await sql`
      CREATE TABLE transactions (
        id SERIAL PRIMARY KEY,
        type TEXT NOT NULL,
        date TIMESTAMP WITH TIME ZONE NOT NULL,
        amount BIGINT NOT NULL,
        "partnerId" INTEGER REFERENCES partners(id) ON DELETE CASCADE,
        "agencyId" INTEGER REFERENCES agencies(id) ON DELETE CASCADE,
        "cardIds" INTEGER[] DEFAULT '{}',
        quantity INTEGER NOT NULL,
        description TEXT
      );
    `;
    console.log('Transactions table created.');

    // 5. Triggers for updating Partner Debt
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

    await sql`
      CREATE TRIGGER trigger_update_partner_financials
      AFTER INSERT ON transactions
      FOR EACH ROW
      EXECUTE FUNCTION update_partner_financials();
    `;
    console.log('Triggers created.');

    console.log('Neon Database Setup Complete!');
  } catch (e) {
    console.error('Error setting up Neon DB:', e);
  }
}

setupNeon();
