import { Router } from 'express'
import { pool } from '../../db/db.js'
import VerifToken from '../../security/VerifJwt.js'

const router = Router()

router.get('/api/_/get_user', VerifToken, async (req, res) => {
  try {
    const user_id = req.query.user_id;
    console.log(req.user, 'JUST GOT =>>', user_id)
    if (!user_id) {
      return res.status(401).send({
        code: 401,
        data: null
      })
    }
    const { rows } = await pool.query('SELECT id, username, name, avatar, public_key FROM users WHERE id = $1', [user_id])
    if(rows[0].username){
      return res.status(200).send({ code: 200, data: rows[0]})
    }
    res.status(404).send({
      code: 404,
      data: null
    })
  } catch (error) {
    res.status(500).send({code: 500, error})
    console.error(error);
  }
})

export default router