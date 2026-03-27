import mongoose from 'mongoose';

const transportInfoSchema = new mongoose.Schema(
  {
    routeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Route', required: true },
    fromPointOrder: { type: Number, required: true },
    toPointOrder: { type: Number, required: true },
    routeNumber: { type: String, required: true },
    vehicleType: { type: String, default: 'bus' },
    stops: { type: [String], default: [] },
    source: { type: String, enum: ['yandex', 'manual'], default: 'manual' },
  },
  { timestamps: true }
);

export const TransportInfo = mongoose.model('TransportInfo', transportInfoSchema);

