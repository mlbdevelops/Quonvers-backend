import jwt from 'jsonwebtoken'

const secret = process.env.JWT_SECRET;

export default async function VerifToken(token) {
  if (!token) return
  try {
    const decoded = await jwt.verify(token, secret);
    return decoded
  } catch (err) {
    return err
  }
}
