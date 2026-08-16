require('dotenv').config();

module.exports = {
  DEV_EMBEDDED_BROKER: process.env.DEV_EMBEDDED_BROKER === 'true',
  BROKER_URL: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
  BROKER_PORT: Number(process.env.MQTT_BROKER_PORT || 1883),
  USERNAME: process.env.MQTT_USERNAME || undefined,
  PASSWORD: process.env.MQTT_PASSWORD || undefined,

  // Topic map — khớp với mục III.1 "Chi tiết giao thức MQTT" trong đặc tả
  TOPICS: {
    DEVICE_DATA: 'device/data',                       // ESP32 -> Backend (spo2, bpm)
    DEVICE_STATUS: 'device/status',                    // ESP32 -> Backend (heartbeat)
    DEVICE_CONTROL_BUZZER: (deviceId) => `device/${deviceId}/control/buzzer`, // Backend -> ESP32
    DEVICE_CONTROL_LED: (deviceId) => `device/${deviceId}/control/led`,
    DEVICE_CONTROL_OLED: (deviceId) => `device/${deviceId}/control/oled`,
  },
};
