# VitaLink Backend — Hệ thống giám sát sức khỏe qua ESP32

Backend Node.js đóng vai trò trung tâm xử lý: nhận dữ liệu SpO2/BPM từ ESP32
qua MQTT, lọc nhiễu (Moving Average), phát hiện & xác nhận bất thường, lưu
Firebase Realtime Database, cung cấp REST API cho Dashboard, gửi lệnh điều
khiển thiết bị và thông báo Email/Telegram khi có cảnh báo.

## Trạng thái hiện tại

| Hạng mục | Trạng thái |
|---|---|
| Logic core (Moving Average, phát hiện bất thường, xác nhận liên tiếp) | ✅ Xong |
| Email cảnh báo (nhiều người nhận) | ✅ Xong |
| Firebase Realtime Database thật | ✅ Xong |
| MQTT Broker thật | ✅ Xong |
| Frontend (Node-RED Dashboard) | ⏳ Chưa làm — xem mục "Định hướng tiếp theo" |
| ESP32 firmware thật | ⏳ Chưa làm — xem mục "Định hướng tiếp theo" |

## 1. Cấu trúc thư mục

```
vl-backend/
├── package.json
├── .env                       # cấu hình thật đang dùng (KHÔNG đưa lên Git công khai)
├── data/
│   └── mock-db.json          # chỉ dùng khi FIREBASE_MODE=mock, hiện không dùng nữa
├── src/
│   ├── server.js             # entry point: khởi tạo Express + MQTT
│   ├── config/
│   │   ├── mqtt.config.js        # URL broker, danh sách topic
│   │   └── thresholds.config.js  # ngưỡng cảnh báo mặc định + override theo thiết bị
│   ├── mqtt/
│   │   ├── mqttClient.js         # kết nối broker thật
│   │   └── mqttHandlers.js       # xử lý message ESP32 -> Backend, gửi lệnh điều khiển
│   ├── services/
│   │   ├── movingAverage.service.js   # bộ lọc trung bình trượt N=5
│   │   ├── alertDetection.service.js  # tiền xử lý + phân loại ngưỡng + xác nhận liên tiếp
│   │   ├── deviceStatus.service.js    # heartbeat / phát hiện mất kết nối
│   │   ├── firebase.service.js        # kết nối Firebase Realtime Database thật
│   │   └── notification.service.js    # gửi Email/Telegram khi có cảnh báo
│   ├── controllers/
│   │   └── api.controller.js     # logic cho từng REST endpoint
│   ├── routes/
│   │   └── api.routes.js         # khai báo route /api/v1/... (bọc asyncHandler chống crash)
│   └── utils/
│       ├── validators.js         # validate request body
│       └── asyncHandler.js       # bắt lỗi async tự động, tránh sập server
└── test/
    ├── mock-esp32-simulator.js       # mô phỏng ESP32 gửi dữ liệu MQTT
    ├── test-frontend-api.js          # mô phỏng Dashboard gọi REST API
    ├── test-firebase-connection.js   # test kết nối Firebase độc lập
    └── run-demo.js                   # chạy toàn bộ luồng end-to-end trong 1 tiến trình
```

## 2. Chạy Backend

```bash
npm install
npm start
```

Các script test hữu ích:
```bash
npm run simulate:esp32    # mô phỏng ESP32 gửi dữ liệu (kịch bản có bất thường)
npm run test:api          # mô phỏng Dashboard gọi REST API
node test/test-firebase-connection.js   # test riêng kết nối Firebase
```

## 3. REST API — Frontend phải gọi đúng các endpoint này

| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/api/v1/latest?deviceId=` | Dữ liệu SpO2/BPM/status mới nhất |
| GET | `/api/v1/history?deviceId=&limit=` | Lịch sử đo |
| POST | `/api/v1/device/buzzer` | Bật/tắt còi `{ "state": true }` |
| GET | `/api/v1/device/status?deviceId=` | Trạng thái online/offline |
| GET | `/api/v1/alerts?deviceId=` | Danh sách cảnh báo đã ghi nhận |
| GET/PUT | `/api/v1/device/:id/thresholds` | Đọc/đặt ngưỡng cảnh báo riêng cho thiết bị |
| POST | `/api/v1/device/:id/oled/message` | Đặt lịch nhắn tin OLED |

## 4. MQTT Topic — ESP32 phải gửi/nhận đúng các topic này

**PREFIX = MSSV** (đặt trong `.env`, dùng để tránh trùng topic với nhóm khác nếu chung 1 broker công cộng).

| Topic | Chiều | Nội dung |
|---|---|---|
| `PREFIX/device/data` | ESP32 → Backend | `{ deviceId, spo2, bpm, timestamp }` |
| `PREFIX/device/status` | ESP32 → Backend | `{ deviceId, status, timestamp }` (heartbeat) |
| `PREFIX/device/{id}/control/buzzer` | Backend → ESP32 | `{ state: true\|false }` |
| `PREFIX/device/{id}/control/led` | Backend → ESP32 | Màu LED theo trạng thái sức khỏe |
| `PREFIX/device/{id}/control/oled` | Backend → ESP32 | `{ message, scheduleTime }` |

---

## 5. Định hướng tiếp theo

### A. Frontend — dựng Dashboard bằng Node-RED

Node-RED **không cần sửa gì ở Backend** — chỉ cần gọi đúng API/topic ở trên.

| Việc | Node dùng | Kết nối tới |
|---|---|---|
| Hiển thị SpO2/BPM real-time | `mqtt in` | Subscribe `PREFIX/device/data` trên cùng broker |
| Vẽ biểu đồ/gauge | `ui_chart` / `ui_gauge` (gói `node-red-dashboard`) | Nhận dữ liệu từ node `mqtt in` |
| Nút bấm bật/tắt còi | `http request` (POST) | `http://<backend>:3000/api/v1/device/buzzer` |
| Xem lịch sử đo | `http request` (GET) | `.../api/v1/history?deviceId=` |
| Xem danh sách cảnh báo | `http request` (GET) | `.../api/v1/alerts?deviceId=` |
| Đặt ngưỡng riêng theo thiết bị | `http request` (PUT) | `.../api/v1/device/:id/thresholds` |

Các bước: `npm install -g node-red` → `npm install node-red-dashboard` → kéo-thả node, nối dây theo bảng trên, không cần viết code. Sau khi xong, **export flow → JSON** để nộp bài.

### B. ESP32 — viết firmware thật (Arduino IDE/PlatformIO)

Firmware tách biệt hoàn toàn khỏi project Backend, chỉ cần khớp đúng topic/định dạng ở mục 4.

**Việc 1 — Gửi dữ liệu (publish):**
```cpp
StaticJsonDocument<200> doc;
doc["deviceId"] = "esp32_001";
doc["spo2"] = spo2Value;
doc["bpm"] = bpmValue;
doc["timestamp"] = millis() / 1000; // hoặc lấy giờ thật qua NTP
char buffer[200];
serializeJson(doc, buffer);
mqttClient.publish("PREFIX/device/data", buffer);       // mỗi giây (1Hz)
mqttClient.publish("PREFIX/device/status", "{...}");    // heartbeat, mỗi 30s
```

**Việc 2 — Nhận lệnh điều khiển (subscribe):**
```cpp
void callback(char* topic, byte* payload, unsigned int length) {
  StaticJsonDocument<200> doc;
  deserializeJson(doc, payload, length);
  bool state = doc["state"];
  digitalWrite(BUZZER_PIN, state ? HIGH : LOW);
}

void setup() {
  mqttClient.subscribe("PREFIX/device/esp32_001/control/buzzer");
  mqttClient.setCallback(callback);
}
```

⚠️ `deviceId` trong topic điều khiển phải khớp đúng `deviceId` mà chính ESP32 đó gửi lên trong `device/data` — đây là cách Backend biết lệnh dành cho thiết bị nào.

### C. Kết nối tổng thể — thứ tự làm việc đề xuất

1. ESP32/Wokwi kết nối vào broker thật (đã có sẵn) → xác nhận `npm run simulate:esp32` không cần nữa, dữ liệu thật đã chảy vào Backend.
2. Dựng flow Node-RED, trỏ `mqtt in` vào đúng topic + `http request` vào đúng API.
3. Kiểm tra 2 chiều: dữ liệu ESP32 → hiện trên Node-RED; bấm nút trên Node-RED → còi ESP32 kêu.
4. Quay video demo toàn bộ luồng, export flow Node-RED thành JSON để nộp bài.

**Lưu ý CORS:** nếu Node-RED Dashboard chạy ở domain/port khác Backend, cần mở CORS đúng origin trong `src/server.js`:
```js
app.use(cors({ origin: 'https://domain-nodered-cua-ban.com' }));


```


