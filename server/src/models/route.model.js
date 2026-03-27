import mongoose from 'mongoose';

const stopSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    order: { type: Number, required: true },
  },
  { _id: false }
);

const fallbackSegmentSchema = new mongoose.Schema(
  {
    fromPointOrder: { type: Number, required: true },
    toPointOrder: { type: Number, required: true },
    routeNumber: { type: String, required: true },
    vehicleType: { type: String, default: 'bus' },
    stops: { type: [stopSchema], default: [] },
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
    qrCode: { type: String, required: true },
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
    fallbackTransportSegments: { type: [fallbackSegmentSchema], default: [] },
  },
  { timestamps: true }
);

export const Route = mongoose.model('Route', routeSchema);

