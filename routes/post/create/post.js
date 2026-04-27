import { Router } from 'express';
import VerifToken from '../../../security/VerifJwt.js';
import { pool } from '../../../db/db.js';

const router = Router();

const create_table = async () => {
  //return await pool.query('DROP TABLE posts')
  
  await pool.query(`
    CREATE TABLE IF NOT EXISTS posts(
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      author_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
      type TEXT NOT NULL,
      content_type TEXT NOT NULL,
      main_url_content TEXT,
      caption TEXT,
      allow_forwarding BOOLEAN DEFAULT false,
      visible_counts BOOLEAN DEFAULT false,
      is_pinned_at TEXT,
      share_to TEXT,
      notifications_on BOOLEAN DEFAULT true,
      is_anonymous BOOLEAN DEFAULT FALSE,
      linked_to_profile BOOLEAN DEFAULT true,
      post_surname TEXT,
      created_at TEXT,
      post_at TEXT,
      expires_at TEXT,
      post_location TEXT,
      allow_screenshot BOOLEAN DEFAULT true,
      allow_save BOOLEAN DEFAULT false,
      extra_data JSONB
    )
  `)
}

router.post('/api/post/_create', VerifToken, async (req, res) => {
  const user = req?.user;
  await create_table();
  
  const post_model = {
    author_id: user,
    type: req?.body?.type,
    content_type: req?.body?.content_type,
    main_url_content: req?.body?.content,
    caption: req?.body?.caption,
    allow_forwarding: req?.body?.allow_forwarding || false,
    visible_counts: req?.body?.visible_counts || true,
    is_pinned_at: typeof req?.body?.is_pinned_at == 'number' ? JSON.stringify(req?.body?.is_pinned_at) : null,
    share_to: req?.body?.share_to || null,
    notifications_on: req?.body?.notifications_on || true,
    is_anonymous: req?.body?.is_anonymous || false,
    linked_to_profile: req?.body?.linked_to_profile || true,
    post_surname: req?.body?.post_surname || null,
    created_at: JSON.stringify(Date.now()),
    post_at: JSON.stringify(req?.body?.post_at),
    expires_at: JSON.stringify(req?.body?.expires_at || (created_at + 1000 * 60 * 60 * 24 * 30)),
    post_location: req?.body?.post_location || null,
    allow_screenshot: req?.body?.allow_screenshot || true,
    allow_save: req?.body?.allow_save || false,
    extra_data: {
      tags: req?.body?.tags || false,
      media_urls: req?.body?.media_urls || [],
    }
  };
  
  //return console.log(Object.values(post_model))
  
  const { rows } = await pool.query(`
    INSERT INTO posts(
      author_id,
      type,
      content_type,
      main_url_content,
      caption,
      allow_forwarding,
      visible_counts,
      is_pinned_at,
      share_to,
      notifications_on,
      is_anonymous,
      linked_to_profile,
      post_surname,
      created_at,
      post_at,
      expires_at,
      post_location,
      allow_screenshot,
      allow_save,
      extra_data
    )
    VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
    RETURNING*
  `,
    Object.values(post_model)
  );
  
  //console.log(rows[0]);
  
  res.status(200).send({
    success: true,
  })
});

export default router;