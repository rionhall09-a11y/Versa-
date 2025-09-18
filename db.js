const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Database connection error handling
pool.on('error', (err) => console.error('❌ Unexpected database error:', err));
pool.on('connect', () => console.log('💚 Database connected'));

// Safe query with retry logic
async function safeQuery(queryText, params = []) {
  const maxRetries = 3;
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      const result = await pool.query(queryText, params);
      return result;
    } catch (error) {
      attempt++;
      console.error(`❌ DB query attempt ${attempt} failed:`, error.message);
      if (attempt >= maxRetries) throw error;
      await new Promise(res => setTimeout(res, Math.pow(2, attempt) * 1000));
    }
  }
}

// Initialize tables
async function initializeDatabase() {
  try {
    await safeQuery(`
      CREATE TABLE IF NOT EXISTS tracked_roles (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        role_id VARCHAR(20) NOT NULL,
        role_name VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT true,
        UNIQUE(guild_id, role_id)
      )
    `);
    await safeQuery(`
      CREATE TABLE IF NOT EXISTS user_activity (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        role_id VARCHAR(20) NOT NULL,
        message_count INTEGER DEFAULT 0,
        total_score DECIMAL DEFAULT 0,
        last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(guild_id, user_id, role_id)
      )
    `);
    console.log('💚 Database tables initialized');
  } catch (error) {
    console.error('❌ Database init error:', error);
  }
}

// Database functions
const db = {
  async addTrackedRole(guildId, roleId, roleName) {
    const result = await safeQuery(
      'INSERT INTO tracked_roles (guild_id, role_id, role_name) VALUES ($1,$2,$3) ON CONFLICT (guild_id,role_id) DO UPDATE SET is_active=true,role_name=$3 RETURNING *',
      [guildId, roleId, roleName]
    );
    return result.rows[0];
  },
  async getTrackedRoles(guildId) {
    const result = await safeQuery('SELECT * FROM tracked_roles WHERE guild_id=$1 AND is_active=true', [guildId]);
    return result.rows;
  },
  async stopTracking(guildId, roleId) {
    const result = await safeQuery('UPDATE tracked_roles SET is_active=false WHERE guild_id=$1 AND role_id=$2', [guildId, roleId]);
    return result.rowCount > 0;
  },
  async addMessageActivity(guildId, userId, roleId) {
    await safeQuery(`
      INSERT INTO user_activity (guild_id, user_id, role_id, message_count, total_score) 
      VALUES ($1,$2,$3,1,1)
      ON CONFLICT (guild_id,user_id,role_id)
      DO UPDATE SET message_count = user_activity.message_count + 1,
                    total_score = user_activity.total_score + 1,
                    last_active = CURRENT_TIMESTAMP
    `, [guildId, userId, roleId]);
  }
};

module.exports = { db, initializeDatabase };
