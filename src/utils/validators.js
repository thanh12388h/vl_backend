function isBoolean(v) {
  return typeof v === 'boolean';
}

function validateBuzzerRequest(body) {
  if (!body || !isBoolean(body.state)) {
    return { valid: false, error: "Trường 'state' phải là boolean (true/false)" };
  }
  return { valid: true };
}

function validateThresholdRequest(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Body không hợp lệ' };
  }
  const { spo2, bpm } = body;
  if (spo2 && (typeof spo2.warnMin !== 'undefined' && typeof spo2.warnMin !== 'number')) {
    return { valid: false, error: 'spo2.warnMin phải là number' };
  }
  if (bpm && (typeof bpm.min !== 'undefined' && typeof bpm.min !== 'number')) {
    return { valid: false, error: 'bpm.min phải là number' };
  }
  return { valid: true };
}

module.exports = { validateBuzzerRequest, validateThresholdRequest };
