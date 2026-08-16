const PREFIX = '24127541'; 

module.exports = {
  DEV_EMBEDDED_BROKER: process.env.DEV_EMBEDDED_BROKER === 'true',
  BROKER_URL: process.env.MQTT_BROKER_URL || 'mqtt://broker.emqx.io:1883',
  BROKER_PORT: Number(process.env.MQTT_BROKER_PORT || 1883),
  USERNAME: process.env.MQTT_USERNAME || undefined,
  PASSWORD: process.env.MQTT_PASSWORD || undefined,

  TOPICS: {
    DEVICE_DATA: `${PREFIX}/device/data`,
    DEVICE_STATUS: `${PREFIX}/device/status`,
    DEVICE_CONTROL_BUZZER: (deviceId) => `${PREFIX}/device/${deviceId}/control/buzzer`,
    DEVICE_CONTROL_LED: (deviceId) => `${PREFIX}/device/${deviceId}/control/led`,
    DEVICE_CONTROL_OLED: (deviceId) => `${PREFIX}/device/${deviceId}/control/oled`,
  },
};