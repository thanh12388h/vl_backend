# Chuyển đổi Backend từ Mock sang Thật — Hướng dẫn kết nối

## Tóm tắt kiến trúc

```
ESP32  <--MQTT-->  [ MQTT Broker ]  <--MQTT-->  Backend  <--HTTP-->  Frontend/Dashboard
                                                    |
                                                    v
                                              Firebase Realtime DB
```

Backend là **trung tâm duy nhất** giao tiếp trực tiếp với cả 3 bên còn lại
(ESP32 qua Broker, Frontend qua HTTP, dữ liệu qua Firebase). ESP32 và
Frontend **không bao giờ nói chuyện trực tiếp với nhau** — luôn phải đi
qua Backend.

## Việc Backend cần làm (chỉ 3 thứ, đều nằm trong file `.env`)

### 1. Email — đã cấu hình xong ✅
```env
NOTIFY_EMAIL_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<gmail-cua-ban>
SMTP_PASS=<app-password-16-ky-tu-khong-co-dau-cach->
ALERT_EMAIL_TO=<email-nhan-canh-bao>
```

### 2. Firebase — kết nối DB thật thay vì mock
```env
FIREBASE_MODE=real
FIREBASE_DB_URL=https://<project-id>-default-rtdb.firebaseio.com
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account", ...}'   # dán nguyên JSON, 1 dòng
```
Cách lấy: Firebase Console → Project Settings → Service accounts →
Generate new private key → tải file JSON → copy nguyên nội dung vào biến trên.

Cài thêm thư viện (chưa có sẵn để bản mock nhẹ):
```bash
npm install firebase-admin
```

Code `src/services/firebase.service.js` **không cần sửa** — tự động dùng
Firebase thật khi thấy `FIREBASE_MODE=real`.

### 3. MQTT Broker — trỏ sang broker thật thay vì broker nhúng
```env
DEV_EMBEDDED_BROKER=false
MQTT_BROKER_URL=mqtt://<dia-chi-broker-that>:1883
MQTT_USERNAME=<neu-broker-yeu-cau>
MQTT_PASSWORD=<neu-broker-yeu-cau>
```
Cần tự dựng hoặc thuê 1 broker: **Mosquitto** (tự cài trên VPS, miễn phí),
**EMQX**, hoặc **HiveMQ Cloud** (có gói free). ESP32 và Backend đều phải
trỏ về cùng 1 broker này.

**Toàn bộ code Backend không cần sửa gì thêm** — mọi chỗ đổi mock↔thật đều
đi qua biến môi trường.

---

## Trách nhiệm của ESP32 (firmware — code riêng, Arduino IDE/PlatformIO)

ESP32 hoàn toàn tách biệt khỏi project Backend này. Chỉ cần làm đúng 2 việc,
khớp với topic/định dạng Backend đang lắng nghe:

### A. Gửi dữ liệu lên Backend (publish)

| Topic | Khi nào gửi | Payload JSON |
|---|---|---|
| `device/data` | Mỗi giây (1Hz) | `{"deviceId":"esp32_001","spo2":97,"bpm":76,"timestamp":<unix-time>}` |
| `device/status` | Định kỳ 30s (heartbeat) | `{"deviceId":"esp32_001","status":"online","timestamp":<unix-time>}` |

```cpp
// Ví dụ dùng thư viện PubSubClient
StaticJsonDocument<200> doc;
doc["deviceId"] = "esp32_001";
doc["spo2"] = spo2Value;
doc["bpm"] = bpmValue;
doc["timestamp"] = millis() / 1000; // hoặc lấy giờ thật qua NTP
char buffer[200];
serializeJson(doc, buffer);
mqttClient.publish("device/data", buffer);
```

### B. Nhận lệnh điều khiển từ Backend (subscribe)

| Topic | Payload nhận được | Việc ESP32 phải làm |
|---|---|---|
| `device/{deviceId}/control/buzzer` | `{"state":true}` | Bật/tắt còi (digitalWrite) |
| `device/{deviceId}/control/led` | tuỳ định nghĩa | Đổi màu/trạng thái LED |
| `device/{deviceId}/control/oled` | `{"message":"...","scheduleTime":"..."}` | In chữ lên màn hình OLED |

```cpp
void callback(char* topic, byte* payload, unsigned int length) {
  StaticJsonDocument<200> doc;
  deserializeJson(doc, payload, length);
  bool state = doc["state"];
  digitalWrite(BUZZER_PIN, state ? HIGH : LOW);
}

void setup() {
  mqttClient.subscribe("device/esp32_001/control/buzzer");
  mqttClient.setCallback(callback);
}
```

**Lưu ý quan trọng:** `deviceId` trong topic điều khiển (`device/{deviceId}/...`)
phải khớp đúng với `deviceId` mà chính ESP32 đó gửi lên trong `device/data` —
đây là cách Backend biết lệnh điều khiển này dành cho thiết bị nào.

---

## Trách nhiệm của Frontend/Dashboard

Không dùng MQTT — chỉ gọi thẳng REST API của Backend qua HTTP.

```js
// Ví dụ Frontend gọi API
fetch('https://<domain-backend-that>/api/v1/latest?deviceId=esp32_001')
  .then(res => res.json())
  .then(data => console.log(data)); // { spo2, bpm, status }

fetch('https://<domain-backend-that>/api/v1/device/buzzer', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ state: true }),
});
```

Chỉ cần đổi `baseURL` từ `http://localhost:3000` sang domain thật của Backend
sau khi deploy. Toàn bộ endpoint (`/api/v1/latest`, `/history`, `/alerts`,
`/device/buzzer`, `/device/status`, `/device/:id/thresholds`) giữ nguyên,
không đổi gì thêm.

**Cần Backend mở CORS cho đúng domain Frontend** (sửa trong `src/server.js`):
```js
app.use(cors({ origin: 'https://domain-frontend-cua-ban.com' }));
```

---

## Một việc còn thiếu: nơi chạy Backend thật (deploy)

Hiện `npm start` chỉ chạy trên máy local. Để ESP32 thật và Frontend thật kết
nối được, Backend cần chạy trên 1 server có **địa chỉ public** — ví dụ VPS,
Render, Railway — và mở port cho:
- MQTT broker (nếu tự host, mặc định 1883)
- HTTP API (`PORT` trong `.env`, mặc định 3000, thường đặt sau Nginx/HTTPS)

## Checklist tổng hợp

| Việc | Ai làm | Ở đâu |
|---|---|---|
| Bật email thật | Backend | `.env` — đã xong |
| Kết nối Firebase thật | Backend | `.env` + `npm install firebase-admin` |
| Kết nối MQTT broker thật | Backend | `.env` |
| Giới hạn CORS | Backend | `src/server.js` |
| Deploy lên server public | Backend | hạ tầng (VPS/cloud) |
| Gửi dữ liệu spo2/bpm/heartbeat | ESP32 | firmware — publish đúng topic/JSON |
| Nhận & xử lý lệnh điều khiển | ESP32 | firmware — subscribe đúng topic |
| Gọi API hiển thị & điều khiển | Frontend | đổi baseURL sang domain thật |