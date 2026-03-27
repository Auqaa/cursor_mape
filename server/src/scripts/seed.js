import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { connect } from '../config/db.js';
import { AdminUser } from '../models/admin-user.model.js';
import { Route } from '../models/route.model.js';
import { TransportInfo } from '../models/transport-info.model.js';

dotenv.config();

const demoRoutes = [
  {
    title: 'Исторический центр Рязани',
    description: 'Прогулка по знаковым местам центра города.',
    distanceKm: 4.8,
    durationMinutes: 110,
    city: 'Рязань',
    points: [
      {
        title: 'Рязанский Кремль',
        description: 'Сердце древней Рязани.',
        coordinates: { lat: 54.6296, lon: 39.7446 },
        order: 1,
        qrCode: 'ryazan-kremlin-1',
      },
      {
        title: 'Соборная площадь',
        description: 'Исторический центр с панорамой города.',
        coordinates: { lat: 54.6267, lon: 39.7525 },
        order: 2,
        qrCode: 'sobornaya-square-2',
      },
      {
        title: 'Почтовая улица',
        description: 'Пешеходная улица с кафе и арт-объектами.',
        coordinates: { lat: 54.6233, lon: 39.7394 },
        order: 3,
        qrCode: 'pochtovaya-3',
      },
    ],
    fallbackTransportSegments: [
      {
        fromPointOrder: 1,
        toPointOrder: 2,
        routeNumber: '5',
        vehicleType: 'bus',
        stops: [
          { name: 'Кремль', order: 1 },
          { name: 'Соборная площадь', order: 2 },
        ],
      },
    ],
  },
  {
    title: 'Парки и набережная',
    description: 'Легкий маршрут для семейной прогулки.',
    distanceKm: 6.2,
    durationMinutes: 140,
    city: 'Рязань',
    points: [
      {
        title: 'ЦПКиО',
        description: 'Зеленая зона отдыха в городе.',
        coordinates: { lat: 54.6089, lon: 39.7214 },
        order: 1,
        qrCode: 'cpkio-1',
      },
      {
        title: 'Лесопарк',
        description: 'Маршрут вдоль Оки и велодорожек.',
        coordinates: { lat: 54.6125, lon: 39.7801 },
        order: 2,
        qrCode: 'lesopark-2',
      },
      {
        title: 'Торговый городок',
        description: 'Локальные сувениры и кафе.',
        coordinates: { lat: 54.6199, lon: 39.7521 },
        order: 3,
        qrCode: 'trade-quarter-3',
      },
      {
        title: 'Площадь Победы',
        description: 'Финальная точка маршрута.',
        coordinates: { lat: 54.6262, lon: 39.7162 },
        order: 4,
        qrCode: 'pobedy-square-4',
      },
    ],
    fallbackTransportSegments: [
      {
        fromPointOrder: 2,
        toPointOrder: 3,
        routeNumber: '3',
        vehicleType: 'trolleybus',
        stops: [
          { name: 'Лесопарк', order: 1 },
          { name: 'Торговый городок', order: 2 },
        ],
      },
    ],
  },
];

async function run() {
  await connect();

  await AdminUser.deleteMany({});
  await Route.deleteMany({});
  await TransportInfo.deleteMany({});

  const passwordHash = await bcrypt.hash('admin123', 10);
  await AdminUser.create({
    email: 'admin@admin.com',
    passwordHash,
    role: 'admin',
  });

  const routes = await Route.insertMany(demoRoutes);

  const transportDocs = routes.flatMap((route) =>
    route.fallbackTransportSegments.map((segment) => ({
      routeId: route._id,
      fromPointOrder: segment.fromPointOrder,
      toPointOrder: segment.toPointOrder,
      routeNumber: segment.routeNumber,
      vehicleType: segment.vehicleType,
      stops: segment.stops.map((s) => s.name),
      source: 'manual',
    }))
  );

  if (transportDocs.length > 0) {
    await TransportInfo.insertMany(transportDocs);
  }

  console.log('Seed completed');
  process.exit(0);
}

run().catch((err) => {
  console.error('Seed failed', err);
  process.exit(1);
});

