import express from 'express';
import pg from 'pg';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app = express();
app.use(cors());

// Min/max pool size of 5 to simulate legacy bottleneck
const pool = new pg.Pool({
  user: 'aegis',
  database: 'aegis_bank',
  password: process.env.DB_PASSWORD,
  host: 'localhost',
  port: 5432,
  max: 5,
});

const delay = (ms) => new Promise(res => setTimeout(res, ms));

async function seed() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id VARCHAR(50) PRIMARY KEY,
        balance DECIMAL(15, 2) NOT NULL
      )
    `);
    
    // Seed initial account
    const check = await client.query('SELECT 1 FROM accounts WHERE id = $1', ['ACC-12345']);
    if (check.rowCount === 0) {
      await client.query('INSERT INTO accounts (id, balance) VALUES ($1, $2)', ['ACC-12345', 54200.50]);
    }
  } catch (e) {
    console.error('Seed error:', e);
  } finally {
    client.release();
  }
}

app.get('/api/v1/balance/:id', async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    
    const result = await client.query(
      'SELECT balance FROM accounts WHERE id = $1 FOR UPDATE',
      [req.params.id]
    );

    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Account not found' });
    }

    // Simulate legacy CBS processing time
    await delay(50);
    
    await client.query('COMMIT');
    res.json({ id: req.params.id, balance: result.rows[0].balance });
  } catch (e) {
    if (client) await client.query('ROLLBACK');
    res.status(503).json({ error: 'DATABASE_DEADLOCK' });
  } finally {
    if (client) client.release();
  }
});

app.get('/metrics', (req, res) => {
  res.json({
    active_connections: pool.totalCount,
    idle_connections: pool.idleCount,
    queue_depth: pool.waitingCount,
  });
});

const PORT = 3000;
app.listen(PORT, async () => {
  console.log(`Legacy Core Server listening on port ${PORT}`);
  // Wait a sec for DB to be up if starting concurrently
  setTimeout(seed, 2000);
});
