require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const { createBackendMqttClient } = require('./mqtt/mqttClient');
const { attachHandlers } = require('./mqtt/mqttHandlers');
const { buildApiRouter } = require('./routes/api.routes');
const firebaseService = require('./services/firebase.service');

const PORT = process.env.PORT || 3000;

function start() {
  // 1) Kết nối MQTT (tự chạy broker nhúng nếu DEV_EMBEDDED_BROKER=true)
  const { client: mqttClient, brokerHandle } = createBackendMqttClient();
  attachHandlers(mqttClient);

  // 2) Khởi tạo Express (REST API cho Dashboard)
  const app = express();
  app.use(cors());
  app.use(bodyParser.json());

  app.get('/health', (req, res) => {
    res.json({ ok: true, firebaseMode: firebaseService.mode, uptime: process.uptime() });
  });

  app.use('/api/v1', buildApiRouter(mqttClient));

  app.use((err, req, res, next) => {
    console.error('[HTTP] Lỗi không xác định:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  const server = app.listen(PORT, () => {
    console.log(`[HTTP] Backend REST API đang chạy tại http://localhost:${PORT}`);
    console.log(`[HTTP] Firebase mode: ${firebaseService.mode}`);
  });

  return { app, server, mqttClient, brokerHandle };
}

if (require.main === module) {
  start();
}

module.exports = { start };
