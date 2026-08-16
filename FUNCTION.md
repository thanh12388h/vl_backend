# Tài liệu chi tiết chức năng Backend — Cấu trúc JSON vào/ra

Tài liệu này liệt kê **từng hàm chính** trong Backend: làm gì, nhận JSON gì,
trả JSON gì — để ESP32 (firmware) và Node-RED (Dashboard) implement khớp
chính xác, không đoán mò.

---

## 1. `src/mqtt/mqttHandlers.js` — Xử lý dữ liệu từ ESP32

### `handleDeviceData(payload)`

**Được gọi khi:** có tin nhắn mới trên topic `PREFIX/device/data`

**ESP32 phải publish đúng JSON này lên topic `PREFIX/device/data`:**
```json
{
  "deviceId": "esp32_001",
  "spo2": 97.5,
  "bpm": 76,
  "timestamp": 1786874775
}
```
| Trường | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `deviceId` | string | ✅ | ID định danh thiết bị, phải khớp với ID dùng trong topic điều khiển |
| `spo2` | number | ✅ | 0–100, giá trị ngoài khoảng bị loại bỏ (xem `validateSample`) |
| `bpm` | number | ✅ | 20–250, giá trị ngoài khoảng bị loại bỏ |
| `timestamp` | number | Không | Unix time (giây). Nếu thiếu, Backend tự lấy giờ hiện tại |

**Backend làm gì với dữ liệu này (thứ tự xử lý):**
1. `validateSample()` — loại bỏ nếu spo2/bpm ngoài giới hạn sinh lý
2. `movingAverage.addSample()` — gom đủ 5 mẫu mới tính trung bình 1 lần
3. `alertDetection.analyze()` — phân loại NORMAL/WATCH/CRITICAL + đếm số lần bất thường liên tiếp
4. `firebaseService.addTelemetry()` — ghi vào Firebase `telemetry/{deviceId}/{pushId}`
5. Nếu đủ 3 lần liên tiếp bất thường → `firebaseService.addAlert()` + `notificationService.notifyAlert()`

**ESP32 không nhận phản hồi trực tiếp** cho message này (MQTT publish là "gửi rồi quên"). Muốn biết Backend đã xử lý, xem qua REST API `/api/v1/latest`.

---

### `handleDeviceStatus(payload)`

**Được gọi khi:** có tin nhắn mới trên topic `PREFIX/device/status`

**ESP32 phải publish JSON này định kỳ (khuyến nghị mỗi 30s):**
```json
{
  "deviceId": "esp32_001",
  "status": "online",
  "timestamp": 1786874775
}
```
| Trường | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `deviceId` | string | ✅ | |
| `status` | string | ✅ | Hiện chỉ xử lý giá trị `"online"` |
| `timestamp` | number | Không | Unix time (giây) |

**Backend làm gì:** gọi `deviceStatusService.markOnline()` → cập nhật `devices/{deviceId}` trên Firebase (`online: true`, `lastSeen`), đồng thời đặt hẹn giờ 90s (`DEVICE_OFFLINE_TIMEOUT_SEC`) — nếu không nhận thêm heartbeat nào trong 90s, tự động đổi `online: false`.

---

### `publishControl(mqttClient, deviceId, kind, payload)`

**Được Backend gọi khi:** Node-RED gửi lệnh điều khiển qua REST API (xem mục 3).

**Backend publish JSON này lên topic tương ứng — ESP32 phải subscribe và xử lý đúng:**

| `kind` | Topic Backend publish | JSON gửi đi | ESP32 phải làm |
|---|---|---|---|
| `buzzer` | `PREFIX/device/{deviceId}/control/buzzer` | `{"state": true}` | `digitalWrite(BUZZER_PIN, state ? HIGH : LOW)` |
| `led` | `PREFIX/device/{deviceId}/control/led` | tuỳ định nghĩa nhóm | Đổi màu/trạng thái LED |
| `oled` | `PREFIX/device/{deviceId}/control/oled` | `{"message": "UỐNG THUỐC", "scheduleTime": "08:00"}` | In `message` lên màn hình OLED tại `scheduleTime` (nếu có) hoặc ngay lập tức (nếu `scheduleTime: null`) |

---

## 2. `src/services/movingAverage.service.js` — Lọc nhiễu

### `addSample(deviceId, spo2, bpm)`

**Chức năng:** giữ 1 buffer riêng cho mỗi `deviceId`, gom đủ **5 mẫu** (`MOVING_AVERAGE_WINDOW`) mới tính trung bình cộng 1 lần, sau đó reset buffer.

**Input:** `deviceId` (string), `spo2` (number), `bpm` (number) — lấy trực tiếp từ payload MQTT.

**Output:**
```js
// Khi chưa đủ 5 mẫu:
{ ready: false, count: 3, windowSize: 5 }

// Khi đủ 5 mẫu (đã tính xong trung bình):
{ ready: true, spo2Avg: 97.5, bpmAvg: 76.4, windowSize: 5 }
```
→ Chỉ khi `ready: true`, dữ liệu mới được ghi vào Firebase và đưa vào bước phân tích. Nghĩa là **cứ 5 giây (5 mẫu × 1Hz) mới có 1 bản ghi mới** trên Firebase/Dashboard, không phải mỗi giây.

---

## 3. `src/services/alertDetection.service.js` — Phát hiện & xác nhận bất thường

### `validateSample({ spo2, bpm })`

**Chức năng:** kiểm tra giá trị có nằm trong giới hạn sinh lý hợp lệ không (bước tiền xử lý, chạy trước Moving Average).

```js
// Giới hạn cứng trong code:
spo2: 0–100
bpm: 20–250
```
**Output:** `{ valid: true }` hoặc `{ valid: false, errors: ["spo2 ngoài giới hạn sinh lý: 150"] }`

### `analyze(deviceId, spo2Avg, bpmAvg)`

**Chức năng:** so sánh với ngưỡng cảnh báo (mặc định hoặc ngưỡng riêng theo thiết bị đã đặt qua API), đồng thời đếm số lần bất thường **liên tiếp** để tránh báo động giả.

**Ngưỡng mặc định** (đặt trong `.env`, có thể override riêng từng thiết bị):
```
spo2.warnMin = 95      // dưới 95%  -> WATCH
spo2.criticalMin = 90  // dưới 90%  -> CRITICAL
bpm.min = 50            // dưới 50  -> CRITICAL
bpm.max = 120           // trên 120 -> CRITICAL
ALERT_CONSECUTIVE_COUNT = 3   // cần đủ 3 lần liên tiếp mới xác nhận alert
```

**Output:**
```js
{
  status: 'CRITICAL',           // 'NORMAL' | 'WATCH' | 'CRITICAL'
  spo2Class: 'LOW_SPO2',
  bpmClass: 'NORMAL',
  counters: { spo2: 3, bpm: 0 }, // số lần liên tiếp hiện tại
  confirmedAlert: {              // null nếu chưa đủ 3 lần liên tiếp
    type: 'LOW_SPO2',
    message: 'SpO2 dưới ngưỡng nguy hiểm (86.1%) trong 3 lần đo liên tiếp'
  }
}
```
→ `status` này chính là trường `status` được ghi vào Firebase `telemetry/{deviceId}/{pushId}` — Node-RED có thể tô màu UI dựa trên giá trị này (xanh=NORMAL, vàng=WATCH, đỏ=CRITICAL).

---

## 4. `src/services/deviceStatus.service.js` — Heartbeat

### `markOnline(deviceId, timestamp)`
Cập nhật Firebase `devices/{deviceId}` = `{ online: true, lastSeen: <timestamp> }`, reset lại đồng hồ đếm ngược 90s.

Nếu ESP32 ngừng gửi heartbeat > 90s, Backend **tự động** cập nhật `online: false` — không cần ESP32 báo mất kết nối, cơ chế timeout tự lo.

---

## 5. `src/services/notification.service.js` — Gửi cảnh báo

### `notifyAlert({ deviceId, timestamp, spo2, bpm, type, message })`

**Được gọi khi:** `alertDetection.analyze()` trả về `confirmedAlert` khác `null`.

**Gửi tới:**
- Email (nếu `NOTIFY_EMAIL_ENABLED=true`) — tới danh sách trong `ALERT_EMAIL_TO` (cách nhau dấu phẩy để gửi nhiều người)
- Telegram (nếu `NOTIFY_TELEGRAM_ENABLED=true`)
- Console log — luôn chạy, hiển thị dạng: `[Notification] ✅ Gửi email thành công` hoặc `❌ ... thất bại: <lý do>`

**Nội dung gửi đi** (cả email lẫn log), giờ hiển thị theo múi giờ Việt Nam:
```
[CẢNH BÁO] Thiết bị esp32_001 - LOW_SPO2

Thời gian: 17:10:05 16/8/2026
Thiết bị: esp32_001
SpO2: 86.1%
BPM: 103.4
Nội dung: SpO2 dưới ngưỡng nguy hiểm (86.1%) trong 3 lần đo liên tiếp
```

---

## 6. `src/controllers/api.controller.js` — REST API cho Node-RED

Toàn bộ endpoint trả về `Content-Type: application/json`. Đường dẫn đầy đủ: `http://<backend>:3000/api/v1/...`

### `getLatest` — `GET /api/v1/latest?deviceId=esp32_001`
```json
// Response 200
{ "spo2": 97.8, "bpm": 79.2, "status": "NORMAL" }
// Response 404 nếu thiết bị chưa có dữ liệu
{ "error": "Chưa có dữ liệu cho thiết bị này" }
```

### `getHistory` — `GET /api/v1/history?deviceId=esp32_001&limit=10`
```json
// Response 200 — mảng, sắp theo thời gian tăng dần
[
  { "time": "2026-08-16T13:01:46.000Z", "spo2": 98, "bpm": 77.4, "status": "NORMAL" },
  { "time": "2026-08-16T13:02:01.000Z", "spo2": 86.4, "bpm": 101.6, "status": "CRITICAL" }
]
```

### `setBuzzer` — `POST /api/v1/device/buzzer?deviceId=esp32_001`
```json
// Request body
{ "state": true }
// Response 200
{ "success": true }
// Response 400 nếu thiếu/sai kiểu "state"
{ "success": false, "error": "Trường 'state' phải là boolean (true/false)" }
```
→ Backend publish `{"state": true}` lên MQTT topic `PREFIX/device/{deviceId}/control/buzzer` ngay khi nhận request này.

### `getDeviceStatus` — `GET /api/v1/device/status?deviceId=esp32_001`
```json
{ "online": true }
```

### `getAlerts` — `GET /api/v1/alerts?deviceId=esp32_001`
```json
[
  {
    "deviceId": "esp32_001",
    "timestamp": 1786874482,
    "type": "LOW_SPO2",
    "message": "SpO2 dưới ngưỡng nguy hiểm (86.4%) trong 3 lần đo liên tiếp"
  }
]
```

### `getThresholds` / `setThresholds` — `GET`/`PUT /api/v1/device/:deviceId/thresholds`
```json
// GET response / PUT request body
{
  "spo2": { "warnMin": 97, "criticalMin": 92 },
  "bpm": { "min": 50, "max": 120 }
}
```
→ Đặt xong, ngưỡng này áp dụng ngay cho lần `analyze()` tiếp theo của đúng `deviceId` đó — không cần restart Backend.

### `setOledMessage` — `POST /api/v1/device/:deviceId/oled/message`
```json
// Request body
{ "message": "UỐNG THUỐC", "scheduleTime": "08:00" }
// Response 200
{ "success": true }
```

---

## 7. `src/services/firebase.service.js` — Cấu trúc dữ liệu lưu trữ

Đây là **cấu trúc thật** trên Firebase Realtime Database — Node-RED có thể đọc trực tiếp qua Firebase REST API nếu muốn (thay vì luôn phải qua Backend), miễn giữ đúng structure này:

```
devices/
  esp32_001/
    name: "esp32_001"
    online: true
    lastSeen: 1786874775

telemetry/
  esp32_001/
    -N001: { timestamp: 1786874775, spo2: 97.5, bpm: 76, status: "NORMAL" }
    -N002: { timestamp: 1786874780, spo2: 86.4, bpm: 101.6, status: "CRITICAL" }

alerts/
  -A001: { deviceId: "esp32_001", timestamp: 1786874482, type: "LOW_SPO2", message: "..." }
```

---

## Tóm tắt nhanh — Ai gửi gì, nhận gì

| Đối tượng | Gửi (publish/request) | Nhận (subscribe/response) |
|---|---|---|
| **ESP32** | `PREFIX/device/data`, `PREFIX/device/status` (MQTT) | `PREFIX/device/{id}/control/*` (MQTT) |
| **Backend** | `PREFIX/device/{id}/control/*` (MQTT), JSON response (HTTP) | `PREFIX/device/data`, `PREFIX/device/status` (MQTT), HTTP request (REST) |
| **Node-RED** | HTTP request tới `/api/v1/*`, hoặc MQTT publish trực tiếp nếu muốn bypass Backend | JSON response từ Backend, hoặc subscribe trực tiếp `PREFIX/device/data` (MQTT) để hiển thị real-time |