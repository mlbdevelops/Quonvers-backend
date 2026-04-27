import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'
dotenv.config()

export default async function CreatJwt(user_id) {
  const token = await jwt.sign(user_id, process.env.JWT_SECRET);
  return token
}