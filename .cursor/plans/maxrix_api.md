# 📏 Yandex Distance Matrix API v2 — Матрица расстояний (синхронное API)

---

## 🔗 Связь с Routing API v2

Данный API входит в тот же пакет ключей, что и Routing API v2 
(«Матрица Расстояний и Построение Маршрута»), поэтому используется 
**тот же API-ключ**.

**Различие:**
- **Routing API** — строит детальный маршрут с polyline (линия на карте), 
  шагами, конструкциями. Используется для **отрисовки маршрута на карте**.
- **Distance Matrix API** — возвращает только расстояние (м) и время (с) 
  между точками, без геометрии маршрута. Используется для **быстрого 
  сравнения/расчёта** дистанций между множеством точек.

**Применение в проекте:**
- Routing API — для отображения маршрута на Яндекс.Карте.
- Distance Matrix API — для расчёта общей протяжённости и длительности 
  маршрута, сравнения вариантов, определения ближайшей точки.

---

## 📌 Почему синхронное API

| Критерий                  | Синхронное          | Асинхронное                     |
|--------------------------|---------------------|---------------------------------|
| Макс. размер матрицы     | 100 элементов       | 25 млн элементов                |
| RPS                      | 40                  | 5                               |
| Режимы (mode)            | все (включая walking, transit) | только driving, truck  |
| Количество запросов      | 1                   | 3 (генерация → статус → скачивание) |
| Доступность              | сразу               | по доп. запросу на paid-api-maps@yandex-team.ru |

> Для проекта (туристические маршруты, walking/transit, малое число точек) 
> подходит **только синхронное API**, т.к. асинхронное не поддерживает 
> режимы walking и transit.

---

## 📌 Общая информация

| Параметр            | Значение                                                  |
|---------------------|-----------------------------------------------------------|
| **Base URL**        | `https://api.routing.yandex.net/v2/distancematrix`        |
| **Метод**           | GET                                                       |
| **Пакет ключа**     | «Матрица Расстояний и Построение Маршрута» (тот же ключ) |
| **Активация ключа** | до 15 минут после получения                               |
| **Формат ответа**   | JSON                                                      |

---

## ⚠️ Лимиты

| Ограничение                        | Значение |
|------------------------------------|----------|
| Запросов в секунду (RPS)           | 40       |
| Макс. размер матрицы (origins × destinations) | 100 элементов |
| Макс. точек в origins              | 100 (но origins × destinations <= 100) |
| Макс. точек в destinations         | 100 (но origins × destinations <= 100) |

> 💡 Примеры допустимых комбинаций: 10×10=100 ✅, 5×20=100 ✅, 50×10=500 ❌
> Если матрица больше 100 — разбить на несколько запросов.

---

## 🔗 Формат запроса

https://api.routing.yandex.net/v2/distancematrix
  ?apikey=<string>
  &origins=<lat1,lon1|lat2,lon2|...>
  &destinations=<lat1,lon1|lat2,lon2|...>
  &[mode=<string>]
  &[departure_time=<integer>]
  &[avoid_tolls=<boolean>]
  &[avoid_zones=<lat1,lon1|lat2,lon2|...>]
  &[traffic=<string>]

---

## 📥 Обязательные параметры

| Параметр      | Тип    | Описание                                                                |
|--------------|--------|-------------------------------------------------------------------------|
| apikey       | string | API-ключ из Кабинета Разработчика                                       |
| origins      | string | Начальные точки в формате lat,lon|lat,lon|... (WGS84)                   |
| destinations | string | Конечные точки в формате lat,lon|lat,lon|... (WGS84)                    |

> Маршруты строятся из КАЖДОЙ точки origins в КАЖДУЮ точку destinations.

---

## 📤 Необязательные параметры

### Общие (все режимы)

| Параметр         | Тип       | По умолчанию | Описание                                      |
|-----------------|-----------|-------------|-----------------------------------------------|
| mode            | string    | driving     | Способ перемещения (см. таблицу режимов ниже)  |

### Только driving / truck

| Параметр              | Тип       | По умолчанию | Описание                                           |
|----------------------|-----------|-------------|-----------------------------------------------------|
| departure_time       | integer   | текущее     | UNIX-время отправления (не в прошлом)                |
| avoid_tolls          | boolean   | false       | Исключить платные дороги                             |
| avoid_zones          | string    | —           | Геозоны для исключения (мин. 3 точки на зону)        |
| traffic              | string    | —           | disabled — без учёта пробок                          |

### Только truck

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

---

## 🚀 Режимы маршрутизации (mode)

| Значение   | Описание                        | Учёт пробок |
|-----------|---------------------------------|-------------|
| driving   | Легковой автомобиль (по умолч.)  | да          |
| truck     | Грузовой автомобиль              | да          |
| walking   | Пешеход                         | нет         |
| transit   | Общественный транспорт           | да          |
| bicycle   | Велосипед                       | нет         |
| scooter   | Электросамокат                  | нет         |

> Для проекта используются: **walking** и **transit**

> departure_time НЕ учитывается для walking, bicycle, scooter.

---

## 📊 Структура ответа (JSON)

{
  "rows": [
    {
      "elements": [
        {
          "status": "OK",
          "distance": {
            "value": 1500
          },
          "duration": {
            "value": 1200
          }
        },
        {
          "status": "FAIL"
        }
      ]
    }
  ]
}

### Описание полей

| Поле              | Тип    | Описание                                                      |
|-------------------|--------|---------------------------------------------------------------|
| rows              | array  | Массив строк. Порядок соответствует порядку origins            |
| rows[].elements   | array  | Массив элементов. Порядок соответствует порядку destinations   |
| elements[].status | string | OK — маршрут рассчитан; FAIL — не удалось рассчитать          |
| elements[].distance.value | integer | Длина маршрута в метрах                              |
| elements[].duration.value | integer | Продолжительность маршрута в секундах                |

### Логика чтения матрицы

origins:      [A, B]
destinations: [X, Y]

rows[0].elements[0] = маршрут A → X
rows[0].elements[1] = маршрут A → Y
rows[1].elements[0] = маршрут B → X
rows[1].elements[1] = маршрут B → Y

---

## ❌ Коды ошибок

| Код     | Описание                                | Действие                          |
|---------|-----------------------------------------|-----------------------------------|
| 400     | Отсутствует обязательный параметр       | Проверить origins, destinations   |
| 401     | Неверный или отсутствующий apikey        | Проверить ключ                    |
| 429     | Превышен лимит запросов (40 RPS)        | Добавить задержку                 |
| 500     | Системная ошибка                        | Повторить с задержкой             |
| 504     | Таймаут сервера                         | Повторить с задержкой             |

### Формат ошибки

{
  "errors": ["описание ошибки"]
}

---

## 🎯 Примеры запросов для проекта

### Расстояние между двумя точками пешком (Рязань)

GET https://api.routing.yandex.net/v2/distancematrix
  ?origins=54.6269,39.6916
  &destinations=54.6350,39.7005
  &mode=walking
  &apikey=YOUR_API_KEY

### Расстояние от одной точки до нескольких (пешком)
Полезно: найти ближайшую достопримечательность к текущей позиции.

GET https://api.routing.yandex.net/v2/distancematrix
  ?origins=54.6269,39.6916
  &destinations=54.6350,39.7005|54.6300,39.6800|54.6400,39.7100
  &mode=walking
  &apikey=YOUR_API_KEY

### Матрица между всеми точками маршрута (transit)
Полезно: рассчитать общую длительность маршрута с транспортом.

GET https://api.routing.yandex.net/v2/distancematrix
  ?origins=54.6269,39.6916|54.6300,39.6950|54.6350,39.7005
  &destinations=54.6269,39.6916|54.6300,39.6950|54.6350,39.7005
  &mode=transit
  &apikey=YOUR_API_KEY

### С учётом времени отправления (transit)

const departureTime = Math.floor(Date.now() / 1000) + 30 * 60;

const url = `https://api.routing.yandex.net/v2/distancematrix`
  + `?origins=54.6269,39.6916`
  + `&destinations=54.6350,39.7005`
  + `&mode=transit`
  + `&departure_time=${departureTime}`
  + `&apikey=${API_KEY}`;

---

## 🔧 Интеграция с Node.js (Express)

### Серверный прокси-эндпоинт

// server/routes/distanceMatrix.js
const express = require('express');
const axios = require('axios');
const router = express.Router();

const YANDEX_MATRIX_API = 'https://api.routing.yandex.net/v2/distancematrix';
const API_KEY = process.env.YANDEX_ROUTING_API_KEY;

router.get('/distance-matrix', async (req, res) => {
  try {
    const { origins, destinations, mode = 'walking' } = req.query;

    if (!origins || !destinations) {
      return res.status(400).json({ 
        error: 'origins and destinations are required' 
      });
    }

    const response = await axios.get(YANDEX_MATRIX_API, {
      params: {
        apikey: API_KEY,
        origins,
        destinations,
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
    res.status(500).json({ error: 'Distance Matrix API unavailable' });
  }
});

module.exports = router;

### Вызов с клиента (React)

// client/src/api/distanceMatrix.js
export const getDistanceMatrix = async (origins, destinations, mode = 'walking') => {
  const originsStr = origins
    .map(p => `${p.lat},${p.lon}`)
    .join('|');
  const destinationsStr = destinations
    .map(p => `${p.lat},${p.lon}`)
    .join('|');

  const response = await fetch(
    `/api/distance-matrix?origins=${originsStr}&destinations=${destinationsStr}&mode=${mode}`
  );

  if (!response.ok) {
    throw new Error(`Distance Matrix error: ${response.status}`);
  }

  return response.json();
};

// Использование: найти ближайшую точку маршрута
const matrix = await getDistanceMatrix(
  [{ lat: 54.6269, lon: 39.6916 }],           // текущая позиция
  [
    { lat: 54.6350, lon: 39.7005 },            // точка 1
    { lat: 54.6300, lon: 39.6800 },            // точка 2
    { lat: 54.6400, lon: 39.7100 }             // точка 3
  ],
  'walking'
);

// Парсинг ответа — найти минимальное расстояние
const elements = matrix.rows[0].elements;
let nearest = { index: 0, distance: Infinity };
elements.forEach((el, i) => {
  if (el.status === 'OK' && el.distance.value < nearest.distance) {
    nearest = { index: i, distance: el.distance.value };
  }
});
console.log(`Ближайшая точка: ${nearest.index}, расстояние: ${nearest.distance} м`);

---

## 📝 Важные заметки для проекта

1. Используется **тот же API-ключ**, что и для Routing API (один пакет).
2. API-ключ НЕ передавать на клиент — все запросы через серверный прокси.
3. Для проекта: **walking** и **transit** режимы.
4. Формат координат: **широта,долгота** (lat,lon) — как в Routing API.
5. Размер матрицы origins × destinations **не более 100**.
6. status: "FAIL" — обязательно обрабатывать (точка не найдена / нет дороги).
7. distance.value — **метры**, duration.value — **секунды**.
8. Полезные сценарии в проекте:
   - Расчёт общей протяжённости и времени маршрута.
   - Определение ближайшей достопримечательности.
   - Сравнение walking vs transit по времени.

---

## 🗂️ Сводка API проекта

| API              | Назначение                           | Эндпоинт сервера      |
|-----------------|--------------------------------------|------------------------|
| Routing API v2  | Построение маршрута с геометрией     | /api/route             |
| Distance Matrix | Расчёт расстояний/времени без линии  | /api/distance-matrix   |