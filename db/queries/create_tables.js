import { pool } from '../db.js';

export const setup_tables = async () => {
  await pool.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);
  //await pool.query(`DROP TABLE messages`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE,
      username TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      avatar TEXT,
      phone VARCHAR(20) UNIQUE,
      is_pro BOOLEAN DEFAULT false,
      intro TEXT,
      public_key TEXT,
      profile_status TEXT,
      birthdate DATE,
      tags JSONB,
      discoverable BOOLEAN DEFAULT false,
      acc_status TEXT NOT NULL DEFAULT 'active',
      joined_at TIMESTAMP DEFAULT NOW()
    );
  `);
  
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users_login_activity (
      user_id REFERENCES users(id) ON DELETE CASCADE,
      auth_method TEXT CHECK (auth_method IN ('phone', 'email', 'google')),
      last_login TIMESTAMP,
      last_login_device_name TEXT
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
      receiver_id UUID REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE (sender_id, receiver_id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chats (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      type TEXT NOT NULL CHECK (type IN ('private', 'group')),
      name TEXT,
      avatar TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      read_receipts BOOLEAN DEFAULT false,
      quick_reaction BOOLEAN DEFAULT true,
      allow_forwarding BOOLEAN DEFAULT false,
      allow_copying BOOLEAN DEFAULT false,
      disappearing_enabled BOOLEAN DEFAULT false,
      disappearing_duration INTERVAL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      nickname TEXT,
      role TEXT CHECK (role IN ('owner','admin','member')) DEFAULT 'member',
      muted BOOLEAN DEFAULT false,
      last_read_at TIMESTAMP,
      joined_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(chat_id, user_id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS pending_messages (
      id TEXT PRIMARY KEY UNIQUE,
      chat_id TEXT,
      sender_id TEXT,
      content TEXT,
      type TEXT,
      content_url TEXT,
      reply_to TEXT,
      edited BOOLEAN DEFAULT false,
      deleted BOOLEAN DEFAULT false,
      disappearing_millisecs INTEGER,
      status TEXT,
      status_at TEXT,
      created_at TEXT,
      toUser TEXT NOT NULL,
      room_type TEXT DEFAULT 'private'
    );
  `);
  
  
  await pool.query(`
    CREATE TABLE IF NOT EXISTS followers (
      user_id UUID REFERENCES users(id) ON DELETE CASCADE PRIMARY KEY,
      follower_id UUID REFERENCES users(id) ON DELETE CASCADE,
      followed_at TIMESTAMP DEFAULT NOW(),
    );
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_messages_chat_created ON messages(chat_id, created_at DESC);`);

  console.log('All tables and indexes created successfully ✅');
};