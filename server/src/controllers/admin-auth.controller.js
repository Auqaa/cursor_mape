import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AdminUser } from '../models/admin-user.model.js';
import { HttpError } from '../utils/http-error.js';
import { createAccessToken, createRefreshToken } from '../services/token.service.js';

export async function adminLogin(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      throw new HttpError(400, 'Email and password are required');
    }

    const admin = await AdminUser.findOne({ email: email.toLowerCase() });
    if (!admin) {
      throw new HttpError(401, 'Invalid credentials');
    }

    const isValid = await bcrypt.compare(password, admin.passwordHash);
    if (!isValid) {
      throw new HttpError(401, 'Invalid credentials');
    }

    const accessToken = createAccessToken(admin);
    const refreshToken = createRefreshToken(admin);
    admin.refreshToken = refreshToken;
    await admin.save();

    res.json({
      accessToken,
      refreshToken,
      admin: { id: admin._id, email: admin.email, role: admin.role },
    });
  } catch (err) {
    next(err);
  }
}

export async function adminRefresh(req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      throw new HttpError(400, 'Refresh token is required');
    }

    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const admin = await AdminUser.findById(payload.id);
    if (!admin || admin.refreshToken !== refreshToken) {
      throw new HttpError(401, 'Invalid refresh token');
    }

    const nextAccessToken = createAccessToken(admin);
    const nextRefreshToken = createRefreshToken(admin);
    admin.refreshToken = nextRefreshToken;
    await admin.save();

    res.json({ accessToken: nextAccessToken, refreshToken: nextRefreshToken });
  } catch (err) {
    next(err);
  }
}

export async function adminLogout(req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      const payload = jwt.decode(refreshToken);
      if (payload?.id) {
        const admin = await AdminUser.findById(payload.id);
        if (admin) {
          admin.refreshToken = null;
          await admin.save();
        }
      }
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

