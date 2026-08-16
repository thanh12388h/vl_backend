const express = require('express');
const { makeControllers } = require('../controllers/api.controller');

function buildApiRouter(mqttClient) {
  const router = express.Router();
  const ctrl = makeControllers(mqttClient);

  // ---- Luồng 3: Backend -> Dashboard ----
  router.get('/latest', ctrl.getLatest);
  router.get('/history', ctrl.getHistory);
  router.get('/alerts', ctrl.getAlerts);

  // ---- Luồng 1: Dashboard -> Backend -> ESP32 ----
  router.post('/device/buzzer', ctrl.setBuzzer);
  router.get('/device/status', ctrl.getDeviceStatus);

  // ---- Tính năng bổ sung ----
  router.get('/device/:deviceId/thresholds', ctrl.getThresholds);
  router.put('/device/:deviceId/thresholds', ctrl.setThresholds);
  router.post('/device/:deviceId/oled/message', ctrl.setOledMessage);

  return router;
}

module.exports = { buildApiRouter };
