# 🗺️ Yandex Routing API  — Получение деталей маршрута

## 📌 Общая информация

| Параметр            | Значение                                          |
|---------------------|---------------------------------------------------|
| **Base URL**        | `https://api.routing.yandex.net/v2/route`         |
| **Метод**           | GET                                               |
| **Пакет ключа**     | «Матрица Расстояний и Построение Маршрута»        |
| **Активация ключа** | до 15 минут после получения                       |
| **Формат ответа**   | JSON                                              |

---

## ⚠️ Лимиты

| Ограничение                             | Значение |
|-----------------------------------------|----------|
| Запросов в секунду                      | 50       |
| Макс. точек (waypoints) driving/truck   | 50       |
| Макс. точек (waypoints) остальные       | 25       |

> 💡 Если точек больше лимита — разбить маршрут на несколько запросов.

---

## 🔗 Формат запроса

https://api.routing.yandex.net/v2/route
  ?apikey=<string>
  &waypoints=<lat1,lon1|lat2,lon2|...>
  &[mode=<string>]
  &[departure_time=<integer>]
  &[avoid_tolls=<boolean>]
  &[avoid_unpaved=<boolean>]
  &[avoid_poor_condition=<boolean>]
  &[avoid_zones=<lat1,lon1|lat2,lon2|...>]
  &[traffic=<string>]
  &[results=<integer>]
  &[levels=<string>]

---

## 📥 Обязательные параметры

| Параметр     | Тип      | Описание                                                                    |
|-------------|----------|-----------------------------------------------------------------------------|
| apikey      | string   | API-ключ из Кабинета Разработчика                                           |
| waypoints   | string   | Точки маршрута в формате lat,lon|lat,lon|... (WGS84, десятичные градусы)     |

---

## 📤 Необязательные параметры

### 🚶 Общие (все режимы)

| Параметр         | Тип       | По умолчанию | Описание                                      |
|-----------------|-----------|-------------|-----------------------------------------------|
| mode            | string    | driving     | Способ перемещения (см. таблицу режимов ниже)  |
| results         | integer   | 1           | Кол-во маршрутов в ответе (1–3). Платный       |

### 🚗 Только driving / truck

| Параметр               | Тип       | По умолчанию | Описание                                           |
|-----------------------|-----------|-------------|-----------------------------------------------------|
| departure_time        | integer   | текущее     | UNIX-время отправления (не в прошлом)                |
| avoid_tolls           | boolean   | false       | Исключить платные дороги                             |
| avoid_unpaved         | boolean   | false       | Исключить дороги без твёрдого покрытия. Платный      |
| avoid_poor_condition  | boolean   | false       | Исключить дороги в плохом состоянии. Платный         |
| avoid_zones           | string    | —           | Геозоны для исключения (мин. 3 точки на зону)        |
| traffic               | string    | —           | disabled — без учёта пробок (кратчайшее расстояние)  |

### 🚛 Только truck

| Параметр      | Тип      | Описание                              |
|--------------|----------|---------------------------------------|
| weight       | float    | Масса ТС (тонны)                      |
| axle_weight  | float    | Нагрузка на ось (тонны)               |
| max_weight   | float    | Разрешённая макс. масса (тонны)        |
| height       | float    | Высота ТС (метры)                     |
| width        | float    | Ширина ТС (метры)                     |
| length       | float    | Длина ТС (метры)                      |
| payload      | float    | Макс. грузоподъёмность (тонны)         |
| eco_class    | integer  | Экологический класс                    |
| has_trailer  | boolean  | Наличие прицепа (false по умолч.)      |

### 🚶 Только walking / transit

| Параметр | Тип      | Описание                                                          |
|---------|----------|-------------------------------------------------------------------|
| levels  | string   | Этажи для точек (через запятую, кол-во = кол-во waypoints). Платный |

---

## 🚀 Режимы маршрутизации (mode)

| Значение   | Описание                        | Макс. waypoints | Учёт пробок |
|-----------|---------------------------------|-----------------|-------------|
| driving   | Легковой автомобиль (по умолч.)  | 50              | да          |
| truck     | Грузовой автомобиль              | 50              | да          |
| walking   | Пешеход                         | 25              | нет         |
| transit   | Общественный транспорт           | 25              | да          |
| bicycle   | Велосипед                       | 25              | нет         |
| scooter   | Электросамокат                  | 25              | нет         |

> Для проекта используются: walking и transit

---

## 📊 Структура ответа (JSON)

{
  "traffic_type": "realtime | forecast | disabled",
  "route": {
    "legs": [
      {
        "status": "OK | FAIL",
        "steps": [
          {
            "length": 150,
            "duration": 120,
            "mode": "walking",
            "polyline": {
              "points": [
                [55.760097, 37.617987],
                [55.759800, 37.618200]
              ]
            },
            "constructions": [],
            "levels": []
          }
        ]
      }
    ],
    "flags": {
      "hasTolls": false,
      "hasNonTransactionalTolls": false
    }
  },
  "routes": []
}

### Детали вложенных объектов

#### steps[].constructions[]
Только для walking / transit

{
  "count": 5,
  "construction_mask": {
    "stairs_up": true,
    "indoor": true
  }
}

#### steps[].levels[]
Только для walking / transit

{
  "count": 3,
  "level_info": {
    "level_id": "4",
    "level_name": "4 этаж",
    "connector": true
  }
}

#### traffic_type — значения

| Значение    | Описание                                    |
|------------|---------------------------------------------|
| realtime   | Пробки на момент запроса                     |
| forecast   | Прогноз пробок на ближайший час              |
| disabled   | Без учёта пробок                             |

---

## ❌ Коды ошибок

| Код     | Описание                                               | Действие                          |
|---------|--------------------------------------------------------|-----------------------------------|
| 400     | Отсутствует обязательный параметр                      | Проверить apikey и waypoints      |
| 401     | Неверный или отсутствующий apikey                       | Проверить ключ                    |
| 429     | Превышен лимит запросов                                | Добавить задержку между запросами |
| 500     | Системная ошибка сервера                               | Повторить с задержкой             |
| 504     | Таймаут сервера                                        | Повторить с задержкой             |

### Формат ошибки

{
  "errors": ["описание ошибки"]
}

---

## 🎯 Примеры запросов для проекта

### Пешеходный маршрут (Рязань)

GET https://api.routing.yandex.net/v2/route?waypoints=54.6269,39.6916|54.6350,39.7005&mode=walking&apikey=YOUR_API_KEY

### Маршрут на общественном транспорте (Рязань)

GET https://api.routing.yandex.net/v2/route?waypoints=54.6269,39.6916|54.6350,39.7005&mode=transit&apikey=YOUR_API_KEY

### Маршрут с несколькими точками (пешком)

GET https://api.routing.yandex.net/v2/route?waypoints=54.6269,39.6916|54.6300,39.6950|54.6350,39.7005&mode=walking&apikey=YOUR_API_KEY

### Маршрут с учётом времени отправления (транспорт)

const departureTime = Math.floor(Date.now() / 1000) + 30 * 60;

const url = `https://api.routing.yandex.net/v2/route`
  + `?waypoints=54.6269,39.6916|54.6350,39.7005`
  + `&mode=transit`
  + `&departure_time=${departureTime}`
  + `&apikey=${API_KEY}`;

---

## 🔧 Интеграция с Node.js (Express)

### Пример серверного прокси-эндпоинта

// server/routes/routing.js
const express = require('express');
const axios = require('axios');
const router = express.Router();

const YANDEX_ROUTING_API = 'https://api.routing.yandex.net/v2/route';
const API_KEY = process.env.YANDEX_ROUTING_API_KEY;

router.get('/route', async (req, res) => {
  try {
    const { waypoints, mode = 'walking' } = req.query;

    if (!waypoints) {
      return res.status(400).json({ error: 'waypoints is required' });
    }

    const response = await axios.get(YANDEX_ROUTING_API, {
      params: {
        apikey: API_KEY,
        waypoints,
        mode
      }
    });

    res.json(response.data);
  } catch (error) {
    if (error.response) {
      return res.status(error.response.status).json({
        error: error.response.data
      });
    }
    res.status(500).json({ error: 'Routing API unavailable' });
  }
});

module.exports = router;

### Вызов с клиента (React)

// client/src/api/routing.js
export const getRoute = async (waypoints, mode = 'walking') => {
  const waypointsStr = waypoints
    .map(point => `${point.lat},${point.lon}`)
    .join('|');

  const response = await fetch(
    `/api/route?waypoints=${waypointsStr}&mode=${mode}`
  );

  if (!response.ok) {
    throw new Error(`Routing error: ${response.status}`);
  }

  return response.json();
};

// Использование:
const routeData = await getRoute(
  [
    { lat: 54.6269, lon: 39.6916 },
    { lat: 54.6350, lon: 39.7005 }
  ],
  'transit'
);

---
