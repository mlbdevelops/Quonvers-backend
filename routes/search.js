import Router from 'express'
import { pool } from '../db/db.js'
const router = Router()

router.get('/api/search/user/:query/:current_user', async (req, res) => {
  try {
    const { query, current_user } = req.params
    console.log(query, current_user);
    const getUsers = await pool.query(`
      SELECT username, name, avatar, id FROM users WHERE username = $1 OR name ILIKE $1 || '%' AND discoverable = $2 AND id != $3
    `, [query, true, current_user])
    if (!getUsers.rows.length) {
      return res.status(404).send({
        msg: 'No user found!',
        code: 809
      })
    }
    console.log(getUsers.rows);
    return res.status(200).send({
      users: getUsers.rows,
      code: 200
    })
  } catch (error) {
    console.error(error);
    return res.status(500).send({
      code: 500,
      msg: 'Server error, try again.'
    })
  }
})

export default router