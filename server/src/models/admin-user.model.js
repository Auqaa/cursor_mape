import mongoose from 'mongoose';

const adminUserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: { type: String, default: 'admin' },
    refreshToken: { type: String, default: null },
  },
  { timestamps: true }
);

export const AdminUser = mongoose.model('AdminUser', adminUserSchema);

