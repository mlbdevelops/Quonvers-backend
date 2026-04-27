import Router from 'express'
import { getChatList, getChat } from '../../db/queries/fetch_query.js'
import VerifToken from '../../security/VerifJwt.js'
const router = Router();

router.get('/api/chat/get_chat_list', VerifToken, async (req, res) => {
  try {
    const user_id = req.user
    if (!user_id) {
      return
    }
    const chats = await getChatList(user_id)
    if (chats.length) {
      return res.status(200).send({
        code: 200,
        data: chats
      })
    }
    return res.status(404).send({
      code: 404,
      data: null,
      msg: 'No chats found.'
    })
  } catch (error) {
    console.error(error);
    return res.status(500).send({
      code: 500,
      data: null,
      msg: 'No chats found.'
    })
  }
})

router.post('/api/chat/get_individual_chat', VerifToken, async (req, res) => {
  try {
    const { chat_id } = req.body
    
    if (!chat_id) {
      return null
    }
    const chat = await getChat(chat_id, req.user)
    if (chat) {
      return res.status(200).send({
        code: 200,
        data: chat
      })
    }
    
    return res.status(404).send({
      code: 404,
      data: null
    })
  } catch (error) {
    console.error(error);
    return res.status(500).send({
      code: 500,
      msg: 'Server error, please try again.'
    })
  }
})

export default router

