import { pool } from '../../db/db.js'
import Router from 'express'

const router = Router()

router.post('/api/users/friends/request', async (req, res) => {
  const { sender, receiver } = req.body
  if (!sender && !receiver) {
    return null
  }
  /*await pool.query(`
    DELETE FROM chat_requests
  `)*/
  const chechExist = await pool.query(`
    SELECT * FROM chat_requests WHERE sender_id = $1 AND receiver_id = $2
  `, [sender, receiver])
  
  if (chechExist.rows.length) {
    return console.log('Request already sent');
  }
  
  const create_request = await pool.query(`
    INSERT INTO chat_requests (
      sender_id,
      receiver_id
    )
    VALUES($1, $2)
  `, [sender, receiver])
  
  if (create_request.rows[0]) {
    console.log(create_request.rows);
    return res.status(201).send({
      success: true,
      code: 902
    })
  }
})

export default router