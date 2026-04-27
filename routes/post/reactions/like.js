import { Router } from 'express';
import VerifToken from '../../../security/VerifJwt.js'
import { pool } from '../../../db/db.js'

const router = Router();

const createTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS post_likes(
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
      created_at TEXT
    )
  `)
  console.log('TABLE CREATED SUCCESSFULLY ✅');
}

router.post('/api/post/reactions/_like', VerifToken, async (req, res) => {
  const user = req.user
  
  await createTable()
  
  const like_model = {
    user,
    post_id : req.body.post_id,
    created_at : Date.now()
  }
  
  const check = await pool.query('SELECT * FROM post_likes WHERE user_id = $1 AND post_id = $2', [user, req.body.post_id])
  
  console.log(check.rows[0]);
  
  
  if (check.rows[0]) {
    const unlike = await pool.query(`
      DELETE FROM post_likes WHERE user_id = $1 AND post_id = $2
    `, [user, req.body.post_id])
    console.log('Unliked');
    return res.status(200).send({
      res: 'unliked'
    })
  }
  
  
  const { rows } = await pool.query(`
    INSERT INTO post_likes(
      user_id,
      post_id,
      created_at
    )
    VALUES($1, $2, $3)
    RETURNING*
  `, Object.values(like_model))
  
  console.log('Liked');
  if (rows[0].id) {
    return res.status(201).send({
      res: 'liked',
      like_obj: rows[0]
    })
  }
})

export default router