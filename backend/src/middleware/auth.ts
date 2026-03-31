import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing or invalid authorization header' } });
    return;
  }

  const token = authHeader.slice(7);
  const secret = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';

  try {
    const decoded = jwt.verify(token, secret) as { id: string; email: string; role: string };
    req.user = { id: decoded.id, email: decoded.email, role: decoded.role };
    next();
  } catch {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } });
  }
}
