import Router from 'express'
import { pool } from '../../db/db.js'
import { createPrivateChat } from '../../controllers/create_chat.js'
import { redis } from '../../db/redis/db.js'

const router = Router()

router.post('/api/chat/createConversation', async (req, res) => {
  try {
    const { sender, receiver, req_id } = req.body
    console.log(sender, receiver);
    const deleteReq = await pool.query(`
      DELETE FROM chat_requests WHERE id = $1
    `, [req_id])
    const create = await createPrivateChat(sender, receiver)
    if (create.chatId && !create.alreadyExists) {
      return res.status(201).send({
        success: true,
        code: 900
      })
    }else if(create.chatId && create.alreadyExists){
      return res.status(401).send({
        success: false,
        code: 901,
        alreadyExists: create.chatId,
        msg: 'Could not create chat.'
      })
    }else {
      return null 
    }
  } catch (error) {
    console.error(error);
    return res.status(500).send({
      success: false,
      code: 500,
      msg: 'Something went wrong, try again.'
    })
  }
})

router.post('/api/chat/create_chat', async (req, res) => {
  const { accepter_id, toUser } = req.body
  const checkIfOnline = await redis.get(`online:${toUser}`);
  const { rows } = await pool.query('SELECT username, name, is_verified FROM users WHERE id = $1', [accepter_id])
  //server event doesn't exists anymore
  if (checkIfOnline) {
    return ServerEvent.emit(Events.NEW_CHAT, {
      accepter_id,
      toUser,
      accepter_idData: rows[0]
    })
  }
  
  await redis.rpush(`cached_chats:${toUser}`, JSON.stringify({
    accepter_id,
    toUser,
    accepter_idData: rows[0]
  }))
})

export default router