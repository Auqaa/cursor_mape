import jwt from 'jsonwebtoken';

export function createAccessToken(admin) {
  return jwt.sign(
    { id: admin._id.toString(), email: admin.email, role: admin.role },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: '15m' }
  );
}

export function createRefreshToken(admin) {
  return jwt.sign(
    { id: admin._id.toString(), email: admin.email, role: admin.role },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
}

