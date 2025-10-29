import jwt from 'jsonwebtoken';

export function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.le_access;
    if (!token) return res.status(401).json({ error: 'Autenticação necessária.' });

    const data = jwt.verify(token, process.env.JWT_SECRET); // { sid, uid, role }
    req.user = { ID_usuario: data.uid, cargo: data.role };
    next();
  } catch {
    return res.status(401).json({ error: 'Autenticação necessária.' });
  }
}