import mongoose from 'mongoose';

const visitedPointSchema = new mongoose.Schema(
  {
    pointOrder: { type: Number, required: true },
    awardedMushrooms: { type: Number, default: 10 },
    demoMode: { type: Boolean, default: false },
    scannedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const quizResultSchema = new mongoose.Schema(
  {
    pointOrder: { type: Number, required: true },
    correctCount: { type: Number, default: 0 },
    totalQuestions: { type: Number, default: 0 },
    awardedMushrooms: { type: Number, default: 0 },
    perfect: { type: Boolean, default: false },
    answeredAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const routeProgressSchema = new mongoose.Schema(
  {
    routeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Route', required: true },
    sessionId: { type: String, required: true },
    playMode: { type: String, enum: ['thematic', 'free'], default: 'thematic' },
    mushrooms: { type: Number, default: 0 },
    visitedPoints: { type: [visitedPointSchema], default: [] },
    quizResults: { type: [quizResultSchema], default: [] },
    completionBonusAwarded: { type: Number, default: 0 },
    promoCode: { type: String, default: '' },
    halfWayNotified: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

routeProgressSchema.index({ routeId: 1, sessionId: 1, playMode: 1 }, { unique: true });

export const RouteProgress = mongoose.model('RouteProgress', routeProgressSchema);
