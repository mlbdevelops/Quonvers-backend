import Router from 'express';
import { pool } from '../db/db.js'
import VerifToken from '../security/VerifJwt.js'
const router = Router();

router.get('/api/requests/mine/get', VerifToken, async (req, res) => {
  try {
    const userid = req.user;
    const find_notifications = await pool.query(`
      SELECT
        c.sender_id,
        c.receiver_id,
        c.id,
        c.created_at,
        u.avatar AS sender_avatar,
        u.name AS sender_name,
        u.username AS sender_username,
        u.is_verified
      FROM 
        chat_requests c
      JOIN 
        users u 
      ON 
        u.id = c.sender_id
      WHERE 
        c.receiver_id = $1
    `, [userid])
    if (find_notifications.rows.length) {
      return res.status(200).send({
        data: find_notifications.rows,
        code: 904
      })
    }
    return res.status(404).send({
      msg: 'No requests found',
      code: 404
    })
  } catch (err) {
    console.error('Error:', err);
    return res.status(500).send({
      msg: 'Something went wrong, try again.',
      code: 500
    })
  }
});

router.get('/api/requests/sent/get', VerifToken, async (req, res) => {
  try {
    const userid = req.user;
    const find_notifications = await pool.query(`
      SELECT
        c.sender_id,
        c.receiver_id,
        c.id,
        c.created_at,
        u.avatar AS receiver_avatar,
        u.name AS receiver_name,
        u.username AS receiver_username
      FROM 
        chat_requests c
      JOIN 
        users u 
      ON 
        u.id = c.receiver_id
      WHERE
        c.sender_id = $1
    `, [userid])
    if (find_notifications.rows.length) {
      return res.status(200).send({
        data: find_notifications.rows,
        code: 904
      })
    }
    return res.status(404).send({
      msg: 'No sent requests found',
      code: 404
    })
  } catch (err) {
    console.error('Error:', err);
    return res.status(500).send({
      msg: 'Something went wrong, try again.',
      code: 500
    })
  }
});

export default router