const express = require('express');
const { makeControllers } = require('../controllers/api.controller');
const { asyncHandler } = require('../utils/asyncHandler');

function buildApiRouter(mqttClient) {
  const router = express.Router();
  const ctrl = makeControllers(mqttClient);

  // ---- Luồng 3: Backend -> Dashboard ----
  router.get('/latest', asyncHandler(ctrl.getLatest));
  router.get('/history', asyncHandler(ctrl.getHistory));
  router.get('/alerts', asyncHandler(ctrl.getAlerts));

  // ---- Luồng 1: Dashboard -> Backend -> ESP32 ----
  router.post('/device/buzzer', asyncHandler(ctrl.setBuzzer));
  router.get('/device/status', asyncHandler(ctrl.getDeviceStatus));

  // ---- Tính năng bổ sung ----
  router.get('/device/:deviceId/thresholds', asyncHandler(ctrl.getThresholds));
  router.put('/device/:deviceId/thresholds', asyncHandler(ctrl.setThresholds));
  router.post('/device/:deviceId/oled/message', asyncHandler(ctrl.setOledMessage));

  return router;
}

module.exports = { buildApiRouter };