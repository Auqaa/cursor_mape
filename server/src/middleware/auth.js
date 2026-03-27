import jwt from 'jsonwebtoken';
import { HttpError } from '../utils/http-error.js';

export function requireAdmin(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return next(new HttpError(401, 'Missing access token'));
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.admin = payload;
    return next();
  } catch {
    return next(new HttpError(401, 'Invalid access token'));
  }
}

