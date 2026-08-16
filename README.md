# VitaLink Backend — Hệ thống giám sát sức khỏe qua ESP32

Backend Node.js đóng vai trò trung tâm xử lý: nhận dữ liệu SpO2/BPM từ ESP32
qua MQTT, lọc nhiễu (Moving Average), phát hiện & xác nhận bất thường, lưu
Firebase Realtime Database, cung cấp REST API cho Dashboard, gửi lệnh điều
khiển thiết bị và thông báo Email/Telegram khi có cảnh báo.

## 1. Cấu trúc thư mục

```
vl-backend/
├── package.json
├── .env.example              # mẫu cấu hình môi trường
├── data/
│   └── mock-db.json          # "Firebase" mô phỏng (tự sinh khi chạy ở FIREBASE_MODE=mock)
├── src/
│   ├── server.js             # entry point: khởi tạo Express + MQTT
│   ├── config/
│   │   ├── mqtt.config.js        # URL broker, danh sách topic
│   │   └── thresholds.config.js  # ngưỡng cảnh báo mặc định + override theo thiết bị
│   ├── mqtt/
│   │   ├── mqttClient.js         # kết nối broker thật HOẶC tự chạy broker nhúng (Aedes) để dev/test
│   │   └── mqttHandlers.js       # xử lý message ESP32 -> Backend, gửi lệnh điều khiển
│   ├── services/
│   │   ├── movingAverage.service.js   # bộ lọc trung bình trượt N=5 (Chức năng 5)
│   │   ├── alertDetection.service.js  # tiền xử lý + phân loại ngưỡng + xác nhận liên tiếp (Chức năng 4-6)
│   │   ├── deviceStatus.service.js    # heartbeat / phát hiện mất kết nối (Chức năng 10)
│   │   ├── firebase.service.js        # lớp trừu tượng dữ liệu: mock (in-memory) hoặc firebase-admin thật
│   │   └── notification.service.js    # gửi Email/Telegram khi có cảnh báo (Chức năng 9)
│   ├── controllers/
│   │   └── api.controller.js     # logic cho từng REST endpoint
│   ├── routes/
│   │   └── api.routes.js         # khai báo route /api/v1/...
│   └── utils/
│       └── validators.js         # validate request body
└── test/
    ├── mock-esp32-simulator.js   # mô phỏng ESP32 gửi dữ liệu MQTT (kèm kịch bản bất thường)
    ├── test-frontend-api.js      # mô phỏng Dashboard gọi REST API (điều khiển + truy vấn)
    └── run-demo.js               # chạy toàn bộ luồng end-to-end trong 1 tiến trình
```

**Nguyên tắc thiết kế:**
- Mỗi luồng nghiệp vụ trong đặc tả (Dashboard→Backend→ESP32, ESP32→Backend→Firebase,
  Backend→Dashboard, Backend→Thông báo, Heartbeat) ánh xạ trực tiếp vào 1-2 module.

- `firebase.service.js` là lớp trừu tượng — code còn lại không biết đang chạy
  mock hay Firebase thật, chỉ cần đổi `FIREBASE_MODE` trong `.env`.
  
- `mqttClient.js` có thể tự chạy 1 MQTT broker nhúng (Aedes) khi
  `DEV_EMBEDDED_BROKER=true`, nên toàn bộ hệ thống chạy được **không cần
  cài Mosquitto/EMQX thật** — rất tiện để dev và demo.

## 2. Cài đặt

```bash
cd vl-backend
npm install
cp .env.example .env
```

## 3. Chạy backend

```bash
npm start
# -> [HTTP] Backend REST API đang chạy tại http://localhost:3000
# -> [MQTT] Broker nhúng (Aedes) đang chạy tại mqtt://localhost:1883
```

## 4. Test với dữ liệu ESP32 mô phỏng

Mở terminal thứ 2 (giữ `npm start` đang chạy ở terminal 1):

```bash
npm run simulate:esp32
```

Script này gửi 1 mẫu/giây (giống ESP32 thật), gồm 15 mẫu bình thường rồi
20 mẫu SpO2 tụt thấp liên tục. Quan sát log ở terminal 1: sau khi đủ
**3 lô liên tiếp** (mỗi lô = trung bình 5 mẫu) SpO2 dưới ngưỡng nguy hiểm,
Backend sẽ tự ghi alert vào "Firebase" và in thông báo (Chức năng 6 + 9).

## 5. Test REST API (mô phỏng Dashboard)

Mở terminal thứ 3:

```bash
npm run test:api
```

Script gọi lần lượt: `/health`, `/api/v1/latest`, `/api/v1/history`,
bật/tắt còi qua `/api/v1/device/buzzer`, kiểm tra request thiếu trường
(kỳ vọng lỗi 400), `/api/v1/device/status`, `/api/v1/alerts`, đọc/ghi
ngưỡng cảnh báo riêng theo thiết bị, và đặt lịch nhắn tin OLED.

## 6. Chạy demo end-to-end (1 lệnh duy nhất)

Không cần mở nhiều terminal — script này tự khởi động server, mô phỏng
ESP32, rồi gọi REST API và in tóm tắt dữ liệu đã lưu:

```bash
npm run demo
```

## 7. Chuyển sang Firebase & MQTT broker thật (production)

Trong `.env`:

```bash
DEV_EMBEDDED_BROKER=false
MQTT_BROKER_URL=mqtt://<broker-that>:1883

FIREBASE_MODE=real
FIREBASE_DB_URL=https://<project-id>-default-rtdb.firebaseio.com
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account", ... }'
```

Cần cài thêm `firebase-admin`: `npm install firebase-admin`
(gói này không cài sẵn để tránh phụ thuộc khi chỉ chạy demo/mock).

## 8. Tổng hợp REST API

| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/api/v1/latest?deviceId=` | Dữ liệu SpO2/BPM/status mới nhất |
| GET | `/api/v1/history?deviceId=&limit=` | Lịch sử đo |
| POST | `/api/v1/device/buzzer` | Bật/tắt còi `{ "state": true }` |
| GET | `/api/v1/device/status?deviceId=` | Trạng thái online/offline |
| GET | `/api/v1/alerts?deviceId=` | Danh sách cảnh báo đã ghi nhận |
| GET/PUT | `/api/v1/device/:id/thresholds` | Đọc/đặt ngưỡng cảnh báo riêng cho thiết bị |
| POST | `/api/v1/device/:id/oled/message` | Đặt lịch nhắn tin OLED |

## 9. Tổng hợp MQTT Topic

| Topic | Chiều | Nội dung |
|---|---|---|
| `device/data` | ESP32 → Backend | `{ deviceId, spo2, bpm, timestamp }` |
| `device/status` | ESP32 → Backend | `{ deviceId, status, timestamp }` (heartbeat) |
| `device/{id}/control/buzzer` | Backend → ESP32 | `{ state: true|false }` |
| `device/{id}/control/led` | Backend → ESP32 | Màu LED theo trạng thái sức khỏe |
| `device/{id}/control/oled` | Backend → ESP32 | `{ message, scheduleTime }` |
