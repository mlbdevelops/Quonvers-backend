import { Router } from 'express'
import VerifToken from '../../../security/VerifJwt.js';
import { pool } from '../../../db/db.js';

const router = Router()

router.get('/api/post/_get', VerifToken, async (req, res) => {
  {/*const user_post = await pool.query(`
    SELECT
      p.*,
      u.username AS author_username,
      u.name AS author_name,
      u.avatar AS author_avatar,
      u.is_verified AS author_verification
    FROM posts p
    JOIN users u ON u.id = p.author_id;
  `)*/}
  
  const user_post = await pool.query(`
    SELECT
      p.*,
      COUNT(pl) AS post_likes_count,
      u.username AS author_username,
      u.name AS author_name,
      u.avatar AS author_avatar,
      u.is_verified AS author_verification,
      (
        pl_current.user_id IS NOT NULL 
      ) AS has_liked
    FROM posts p
    JOIN users u 
      ON u.id = p.author_id
    LEFT JOIN post_likes pl 
      ON pl.post_id = p.id
    LEFT JOIN post_likes pl_current
      ON pl_current.post_id = p.id
      AND pl_current.user_id = $1
    GROUP BY p.id, u.username, u.name, u.avatar, u.is_verified, pl_current.user_id
  `,[req.user])
  //console.log(user_post.rows);
  res.status(200).send(user_post.rows)
})

export default router