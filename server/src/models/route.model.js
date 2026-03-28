import mongoose from 'mongoose';

const quizQuestionSchema = new mongoose.Schema(
  {
    prompt: { type: String, required: true },
    options: { type: [String], default: [] },
    correctOption: { type: Number, required: true },
    explanation: { type: String, default: '' },
  },
  { _id: false }
);

const routePointSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: '' },
    coordinates: {
      lat: { type: Number, required: true },
      lon: { type: Number, required: true },
    },
    order: { type: Number, required: true },
    pointType: {
      type: String,
      enum: ['checkpoint', 'waypoint'],
      default: 'checkpoint',
    },
    source: {
      type: String,
      enum: ['curated', 'dgis'],
      default: 'curated',
    },
    externalId: { type: String, default: '' },
    qrCode: { type: String, default: '' },
    manualCode: { type: String, default: '' },
    questions: { type: [quizQuestionSchema], default: [] },
  },
  { _id: true }
);

const routeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: '' },
    distanceKm: { type: Number, required: true },
    durationMinutes: { type: Number, required: true },
    city: { type: String, default: 'Рязань' },
    points: { type: [routePointSchema], default: [] },
  },
  { timestamps: true }
);

export const Route = mongoose.model('Route', routeSchema);
