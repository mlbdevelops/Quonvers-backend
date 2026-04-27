import { pool } from '../db.js';

export const getChatList = async (userId) => {
  const { rows } = await pool.query(`
      SELECT
        cm.*,
        c.type,
        
        CASE 
            WHEN c.type = 'private' THEN u_other.name
            ELSE c.name
        END AS chat_name,
        
        CASE
            WHEN c.type = 'private' THEN u_other.avatar
            ELSE c.avatar
        END AS chat_avatar,
        
        u_other.id AS recipient_id,
        u_other.username AS recipient_username,
        u_other.name AS recipient_name,
        u_other.avatar AS recipient_avatar
        
    FROM chat_members cm
    JOIN chats c 
        ON c.id = cm.chat_id
    LEFT JOIN chat_members cm_other
        ON cm_other.chat_id = c.id
        AND cm_other.user_id != $1::uuid
    
    LEFT JOIN users u_other
        ON u_other.id = cm_other.user_id
    
    WHERE cm.user_id = $1::uuid
      AND cm.deleted_at IS NULL
    ORDER BY c.last_message_at DESC NULLS LAST;
  `, [userId]);

  return rows;
};

export const getChat = async (chatId, userId, limit = 20) => {
  const { rows } = await pool.query(`
    SELECT
      c.id AS chat_id,
      c.type,
      c.name AS chat_name,
      c.avatar AS chat_avatar,
      c.read_receipts,
      c.quick_reaction,
      c.allow_forwarding,
      c.allow_copying,
      c.disappearing_enabled,
      c.disappearing_duration,
      cm.role AS my_role
    FROM chats c
    JOIN chat_members cm ON cm.chat_id = c.id AND cm.user_id = $2
    WHERE c.id = $1;
  `, [chatId, userId]);

  const chat = rows[0];
  if (!chat) return null;
  
  const { rows: messages } = await pool.query(`
    SELECT id, sender_id, content, media_url, type, delivered, edited, disappears_at, created_at
    FROM messages
    WHERE chat_id = $1
    ORDER BY created_at DESC
    LIMIT $2
  `, [chatId, limit]);

  chat.messages = messages.reverse();
  return chat;
};

export const getGroupMembers = async (chatId) => {
  const { rows } = await pool.query(`
    SELECT
      u.id AS user_id,
      u.name AS display_name,
      cm.nickname,
      u.avatar,
      cm.role
    FROM chat_members cm
    JOIN users u ON u.id = cm.user_id
    WHERE cm.chat_id = $1
    ORDER BY cm.role DESC, u.name ASC;
  `, [chatId]);

  return rows;
};

export const getMyChatMember = async (chatId, userId) => {
  const { rows } = await pool.query(`
    SELECT nickname, role, muted, last_read_at
    FROM chat_members
    WHERE chat_id = $1 AND user_id = $2
  `, [chatId, userId]);

  return rows[0];
};

export const getChatMessages = async (chatId, userId, cursor, limit = 30) => {
  const { rows } = await pool.query(
    `
    SELECT
      m.id,
      m.sender_id,
      u_sender.username AS sender_name,
      m.content,
      m.media_url,
      m.type,
      m.created_at,
      m.deleted_for_everyone,
      
      -- Read receipts
      ARRAY_AGG(mr.user_id) AS read_by_user_ids
    FROM messages m
    LEFT JOIN users u_sender ON u_sender.id = m.sender_id
    LEFT JOIN message_reads mr ON mr.message_id = m.id
    WHERE m.chat_id = $1
      AND ($2::timestamp IS NULL OR m.created_at < $2)
      AND m.deleted_for_everyone = FALSE
    GROUP BY m.id, u_sender.username
    ORDER BY m.created_at DESC
    LIMIT $3;
    `,
    [chatId, cursor || null, limit]
  );

  return rows;
};