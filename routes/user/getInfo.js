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

router.get('/api/_/get_user_profile', VerifToken, async (req, res) => {
  try {
    const user_id = req.query.user_id;
    const { user: logged_user } = req
    
    console.log(req.user, 'JUST GOT =>>', user_id)
    if (!user_id) {
      return res.status(400).send({
        code: 400,
        data: null
      })
    }
    const { rows } = await pool.query(`
      SELECT 
        u.id,
        u.username, 
        u.name, 
        u.avatar, 
        u.public_key, 
        u.tags, 
        u.profile_status, 
        u.acc_status, 
        u.intro, 
        u.is_pro,
        u.joined_at,
        (
          f.follower_id IS NOT NULL
        ) AS isFollowing
      FROM 
        users u
      LEFT JOIN followers f 
        ON 
          f.follower_id = $1
        AND 
          f.user_id = u.id
      WHERE 
        u.id = $2`, 
      [
        logged_user,
        user_id,
      ])
    if(rows.length){
      console.log(rows);
      return res.status(200).send({ code: 200, data: rows[0]})
    }
    res.status(404).send({
      code: 404,
      data: null
    })
  } catch (error) {
    res.status(500).send({code: 500, error, data: null})
    console.error(error);
  }
})

export default router