// Listmonk newsletter integration via direct PostgreSQL access
const { Pool } = require('pg');

const LISTMONK_LIST_ID = parseInt(process.env.LISTMONK_LIST_ID) || 24; // Valley of the Commons list

const listmonkPool = process.env.LISTMONK_DB_HOST ? new Pool({
  host: process.env.LISTMONK_DB_HOST || 'listmonk-db',
  port: parseInt(process.env.LISTMONK_DB_PORT) || 5432,
  database: process.env.LISTMONK_DB_NAME || 'listmonk',
  user: process.env.LISTMONK_DB_USER || 'listmonk',
  password: process.env.LISTMONK_DB_PASS || '',
}) : null;

async function addToListmonk(email, name, attribs = {}) {
  if (!listmonkPool) {
    console.log('[Listmonk] Database not configured, skipping');
    return false;
  }

  const client = await listmonkPool.connect();
  try {
    const mergeAttribs = {
      votc: {
        ...attribs,
        registeredAt: new Date().toISOString(),
      }
    };

    // Check if subscriber exists
    const existing = await client.query(
      'SELECT id, attribs FROM subscribers WHERE email = $1',
      [email]
    );

    let subscriberId;

    if (existing.rows.length > 0) {
      subscriberId = existing.rows[0].id;
      const existingAttribs = existing.rows[0].attribs || {};
      const merged = { ...existingAttribs, ...mergeAttribs };
      await client.query(
        'UPDATE subscribers SET name = $1, attribs = $2, updated_at = NOW() WHERE id = $3',
        [name, JSON.stringify(merged), subscriberId]
      );
      console.log(`[Listmonk] Updated existing subscriber: ${email} (ID: ${subscriberId})`);
    } else {
      const result = await client.query(
        `INSERT INTO subscribers (uuid, email, name, status, attribs, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, 'enabled', $3, NOW(), NOW())
         RETURNING id`,
        [email, name, JSON.stringify(mergeAttribs)]
      );
      subscriberId = result.rows[0].id;
      console.log(`[Listmonk] Created new subscriber: ${email} (ID: ${subscriberId})`);
    }

    // Add to VotC list
    await client.query(
      `INSERT INTO subscriber_lists (subscriber_id, list_id, status, created_at, updated_at)
       VALUES ($1, $2, 'confirmed', NOW(), NOW())
       ON CONFLICT (subscriber_id, list_id) DO UPDATE SET status = 'confirmed', updated_at = NOW()`,
      [subscriberId, LISTMONK_LIST_ID]
    );
    console.log(`[Listmonk] Added to VotC list: ${email}`);
    return true;
  } catch (error) {
    console.error('[Listmonk] Error:', error.message);
    return false;
  } finally {
    client.release();
  }
}

function isConfigured() {
  return !!listmonkPool;
}

module.exports = { addToListmonk, isConfigured };
