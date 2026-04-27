import Router from 'express';
import { sendVerificationCode } from '../verification/verif_email.js';
import { pool } from '../../../db/db.js';
import bcrypt from 'bcryptjs'
import CreatJwt from '../../../security/createJwt.js'

const router = Router();

function generateCode(length = 6) {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function hasAnyAlphabet(text) {
  return /\p{L}/u.test(text)
}

router.post('/api/verification/send/email', async (req, res) => {
  try {
    const { email } = req.body
    const code = generateCode()
    if (!code) {
      return
    }
    const check_if_exists = await pool.query(`
      SELECT email FROM users WHERE email = $1
    `, [email])
    if (check_if_exists.rows.length) {
      return res.status(200).send({
        code: 904
      })
    }
    
    const expires_at = Date.now() + (1000 * 60 * 10)
    await pool.query(`
      DELETE FROM email_verif_code WHERE email = $1
    `, [email])
    //await sendVerificationCode(email, code)
    const save = await pool.query(`
      INSERT INTO email_verif_code (code, email, expires_at) VALUES($1, $2, $3)
      RETURNING *
    `, [code, email, expires_at])
    console.log(save.rows[0]);
    if (save.rows.length) {
      res.status(201).send({
        msg: 'Verification code sent ✓',
        status: 201
      })
    }
  } catch (error) {
    console.error(error);
    res.status(500).send({
      msg: 'Something went wrong, try again. If the problem persists, contact us.',
      status: 500
    })
  }
})

router.post('/api/verification/check/email', async (req, res) => {
  try {
    const { email, code } = req.body
    console.log(code, email);
    if (!email) {
      return
    }
    const today = Date.now()
    const { rows } = await pool.query(`
      SELECT * FROM email_verif_code WHERE email = '${email}'
    `)
    if (code === rows[0].code) {
      await pool.query(`
        DELETE FROM email_verif_code WHERE email = '${email}'
      `)
      return res.status(200).send({
        success: true,
        code: 200,
      })
    }else{
      return res.status(401).send({
        code: 401,
        success: false
      })
    }
  } catch (error) {
    console.error(error);
    return res.status(500).send({
      success: false,
      msg: 'An error occured, please try again'
    })
  }
})

router.post('/api/auth/register', async (req, res) => {
  const {
    email,
    username,
    name,
    password,
    birthdate,
  } = req.body
  try {
    const check_user = await pool.query(`
      SELECT username, email FROM users WHERE email = $1
    `, [email])
    
    if (check_user.rows[0]) {
      console.log('already used bruh!!!');
      return res.status(200).send({
        msg: 'Email already used.',
        code: 801,
      })
    }
    
    if (!hasAnyAlphabet(name)) {
      return res.status(401).send({
        code: 908,
        msg: 'Invalid name input'
      })
    }
    
    const save = await pool.query(`
      INSERT INTO users (
        email,
        username,
        name,
        password_hash, 
        birthdate,
        auth_method, 
        last_login, 
        last_login_device_name
      )
      VALUES($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `,
      [
        email.trim(),
        username.trim(),
        name.trim(),
        await bcrypt.hash(password, 10),
        birthdate.trim(),
        'email',
        new Date() || req.body.last_login,
        'Tecno - Transsion holdings' || req.body.last_login_device_name
      ]
    )
    
    if (save?.rows[0]) {
      return res.status(201).send({
        user: save?.rows[0],
        token: await CreatJwt(save?.rows[0].id),
        code: 201
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

router.post('/api/auth/check_username', async (req, res) => {
  const { username } = req.body 
  const query = await pool.query(`
    SELECT username FROM users WHERE username = $1
  `, [username])
  console.log(username);
  console.log(query.rows);
  if (query.rows.length) {
    //console.log('not ok');
    return res.status(200).send({
      code: 804
    })
  }
  //console.log('ok');
  res.status(200).send({
    code: 805
  })
})

export default router