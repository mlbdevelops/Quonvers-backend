import Router from 'express';
import { pool } from '../../../db/db.js';
import bcrypt from 'bcryptjs'
import CreateJwt from '../../../security/createJwt.js'

const router = Router();

router.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const { rows } = await pool.query(`
      SELECT email, password_hash FROM users WHERE email = $1
    `, [
      email
    ])
    if (!rows.length) {
      return res.status(404).send({
        code: 807
      })
    }
    const check = await bcrypt.compare(password, rows[0].password_hash)
    if (!check) {
      return res.status(401).send({
        msg: 'Wrong password.',
        code: 803
      })
    }
    
    if (check) {
      const { rows } = await pool.query(`
        SELECT * FROM users WHERE email = $1
      `, [email])
      delete rows[0].password_hash
      return res.status(200).send({
        user: rows[0],
        code: 200,
        token: await CreateJwt(rows[0].id)
      })
    }
  } catch (error) {
    console.error(error);
    return res.status(500).send({
      msg: 'Something went wrong, try again.',
      code: 500
    })
  }
})

export default router