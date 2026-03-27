# Туристическая Рязань (PWA)

Интерактивный туристический веб-сервис по Рязани с маршрутами, картой Яндекс, режимами пешком/с транспортом, админ-панелью и QR-геймификацией-заглушкой.

## Структура

- `client` — React + Vite + PWA + `@pbe/react-yandex-maps`
- `server` — Node.js + Express + MongoDB + JWT auth для админа

## Запуск

1. Создайте файлы окружения:
   - `cp client/.env.example client/.env`
   - `cp server/.env.example server/.env`
2. Установите зависимости:
   - `npm install`
   - `npm install --prefix client`
   - `npm install --prefix server`
3. Заполните ключи в `.env`:
   - `VITE_YANDEX_MAPS_API_KEY`
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
- `POST /api/routes/:id/build` (`mode`: `walking` или `masstransit`)
- `POST /api/admin/auth/login`
- `POST /api/admin/auth/refresh`
- `POST /api/admin/auth/logout`
- `POST /api/admin/routes` (admin token)
- `PATCH /api/admin/routes/:id` (admin token)
- `DELETE /api/admin/routes/:id` (admin token)
- `POST /api/admin/routes/:routeId/points` (admin token)
- `PATCH /api/admin/routes/:routeId/points/:pointId` (admin token)
- `DELETE /api/admin/routes/:routeId/points/:pointId` (admin token)
- `PUT /api/admin/routes/:routeId/transport-fallback` (admin token)

## Seed

- Админ: `admin@admin.com` / `admin123`
- 2 демо-маршрута по Рязани с 3-4 точками и fallback-данными транспорта