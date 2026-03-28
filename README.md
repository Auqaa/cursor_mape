# Туристическая Рязань (PWA)

Интерактивный туристический PWA-сервис по Рязани с прогулочными маршрутами, навигацией на 2GIS, гео-фенсингом, грибами, квизами и финальным промокодом.

## Структура

- `client` — React + Vite + PWA + `@2gis/mapgl`
- `server` — Node.js + Express + MongoDB + JWT auth для админа

## Запуск

1. Создайте файлы окружения:
   - `cp client/.env.example client/.env`
   - `cp server/.env.example server/.env`
2. Установите зависимости:
   - `npm install`
   - `npm install --prefix client --legacy-peer-deps`
   - `npm install --prefix server`
3. Заполните ключи в `.env`:
   - `VITE_2GIS_MAPGL_KEY`
   - `DGIS_PLACES_API_KEY`
   - `DGIS_ROUTING_API_KEY`
   - `MONGODB_URI`
   - `JWT_ACCESS_SECRET`
   - `JWT_REFRESH_SECRET`
4. Заполните демо-данные:
   - `npm run seed`
5. Запустите проект:
   - `npm run dev`

## Основные API

- `GET /api/routes`
- `GET /api/routes/:id`
- `POST /api/routes/:id/build`
- `GET /api/routes/:id/progress?sessionId=...&playMode=thematic|free`
- `POST /api/routes/:id/scan`
- `POST /api/routes/:id/quiz`
- `GET /api/discovery/nearby?lat&lon&radius&groups=attractions,food,hotels,shops`
- `GET /api/discovery/search?query&lat&lon`
- `POST /api/navigation/route`
- `POST /api/admin/auth/login`
- `POST /api/admin/auth/refresh`
- `POST /api/admin/auth/logout`
- `POST /api/admin/routes` (admin token)
- `PATCH /api/admin/routes/:id` (admin token)
- `DELETE /api/admin/routes/:id` (admin token)
- `POST /api/admin/routes/:routeId/points` (admin token)
- `PATCH /api/admin/routes/:routeId/points/:pointId` (admin token)
- `DELETE /api/admin/routes/:routeId/points/:pointId` (admin token)

## Seed

- Админ: `admin@admin.com` / `admin123`
- Полный reseed демо-базы с очисткой маршрутов и прогресса
- Кураторские маршруты:
  - `Сердце Рязани`
  - `Исторический центр`
  - `Зеленый город`
  - `Набережные и бульвары`
- В каждом маршруте есть `checkpoint` и `waypoint`-точки
- Только `checkpoint` участвуют в грибах, квизах и финальном промокоде
- Живые nearby места, поиск и ad-hoc навигация идут через 2GIS Places API и Routing API
