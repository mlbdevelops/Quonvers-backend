import { pool } from '../db/db.js';

export const createPrivateChat = async (userId1, userId2) => {
  // Check if chat already exists between these two users
  const { rows: existing } = await pool.query(`
    SELECT c.id
    FROM chats c
    JOIN chat_members cm1 ON cm1.chat_id = c.id AND cm1.user_id = $1
    JOIN chat_members cm2 ON cm2.chat_id = c.id AND cm2.user_id = $2
    WHERE c.type = 'private'
  `, [userId1, userId2]);

  if (existing.length) {
    console.log('The chat exists 👉 ', existing);
    return { chatId: existing[0].id, alreadyExists: true };
  }

  // Create the chat
  const { rows } = await pool.query(`
    INSERT INTO chats (type)
    VALUES ($1)
    RETURNING id
  `, ['private']);

  const chatId = rows[0].id;

  // Add members
  await pool.query(`
    INSERT INTO chat_members (chat_id, user_id, role)
    VALUES ($1, $2, 'member'), ($1, $3, 'member')
  `, [chatId, userId1, userId2]);

  return { chatId, alreadyExists: false };
};

export const createGroupChat = async (ownerId, name, avatar, memberIds = []) => {
  // Create the group chat
  const { rows } = await pool.query(`
    INSERT INTO chats (type, name, avatar)
    VALUES ('group', $1, $2)
    RETURNING id
  `, [name, avatar]);

  const chatId = rows[0].id;

  // Add the owner as 'owner'
  await pool.query(`
    INSERT INTO chat_members (chat_id, user_id, role)
    VALUES ($1, $2, 'owner')
  `, [chatId, ownerId]);

  // Add other members as 'member'
  if (memberIds.length) {
    const values = memberIds.map((id, i) => `($1, $${i + 2}, 'member')`).join(',');
    await pool.query(`
      INSERT INTO chat_members (chat_id, user_id, role)
      VALUES ${values}
    `, [chatId, ...memberIds]);
  }

  return chatId;
};