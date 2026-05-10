import jwt from 'jsonwebtoken'

const secret = process.env.JWT_SECRET;

export default async function VerifToken(req, res, next) {
  const token = req.headers.token;
  if (!token) return res.status(401).send({ 
    msg: 'Unauthorized',
    code: 401
  });
  try {
    const decoded = await jwt.verify(token, secret);
    req.user = decoded;
    next();
  } catch (err) {
    console.log(err);
    res.status(401).json({ 
      msg: 'Invalid or expired token',
      code: 802
    });
  }
}
