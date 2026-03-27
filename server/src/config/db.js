import mongoose from 'mongoose';

export async function connect() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error('MONGODB_URI is not set');
  }

  await mongoose.connect(uri, {
    autoIndex: true,
  });

  console.log('Connected to MongoDB');
}

