function isBoolean(v) {
  return typeof v === 'boolean';
}

function isNumber(v) {
  return typeof v === 'number' && !isNaN(v);
}

/**
 * Validate lệnh set_threshold (ESP32 format)
 */
function validateThresholdRequest(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Body không hợp lệ' };
  }

  if (body.type !== 'set_threshold') {
    return { valid: false, error: "type phải là 'set_threshold'" };
  }

  const required = ['spo2_min', 'bpm_min', 'bpm_max', 'temp_min', 'temp_max'];
  const missing = required.filter(f => !(f in body));
  if (missing.length > 0) {
    return { valid: false, error: `Thiếu trường: ${missing.join(', ')}` };
  }

  // Kiểm tra kiểu và giới hạn
  if (!isNumber(body.spo2_min) || body.spo2_min < 50 || body.spo2_min > 100) {
    return { valid: false, error: 'spo2_min phải là number 50-100' };
  }
  if (!isNumber(body.bpm_min) || body.bpm_min < 30 || body.bpm_min > 220) {
    return { valid: false, error: 'bpm_min phải là number 30-220' };
  }
  if (!isNumber(body.bpm_max) || body.bpm_max < 30 || body.bpm_max > 220) {
    return { valid: false, error: 'bpm_max phải là number 30-220' };
  }
  if (!isNumber(body.temp_min) || body.temp_min < 20 || body.temp_min > 45) {
    return { valid: false, error: 'temp_min phải là number 20-45' };
  }
  if (!isNumber(body.temp_max) || body.temp_max < 20 || body.temp_max > 45) {
    return { valid: false, error: 'temp_max phải là number 20-45' };
  }

  // Logic
  if (body.bpm_min >= body.bpm_max) {
    return { valid: false, error: 'bpm_min phải < bpm_max' };
  }
  if (body.temp_min >= body.temp_max) {
    return { valid: false, error: 'temp_min phải < temp_max' };
  }

  return { valid: true };
}

/**
 * Validate lệnh reminder (ESP32 format)
 */
function validateReminderRequest(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Body không hợp lệ' };
  }

  if (body.type !== 'reminder') {
    return { valid: false, error: "type phải là 'reminder'" };
  }

  if (!body.message || typeof body.message !== 'string' || body.message.trim() === '') {
    return { valid: false, error: 'message phải là string không rỗng' };
  }

  if (body.duration_sec !== undefined) {
    if (!isNumber(body.duration_sec) || body.duration_sec < 1 || body.duration_sec > 300) {
      return { valid: false, error: 'duration_sec phải là number 1-300' };
    }
  }

  return { valid: true };
}

/**
 * Validate lệnh snooze (ESP32 format)
 */
function validateSnoozeRequest(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Body không hợp lệ' };
  }

  if (body.type !== 'snooze') {
    return { valid: false, error: "type phải là 'snooze'" };
  }

  if (body.duration_sec !== undefined) {
    if (!isNumber(body.duration_sec) || body.duration_sec < 1 || body.duration_sec > 600) {
      return { valid: false, error: 'duration_sec phải là number 1-600' };
    }
  }

  return { valid: true };
}

/**
 * Validate lệnh buzzer (ESP32 không hỗ trợ)
 */
function validateBuzzerRequest(body) {
  if (!body || !isBoolean(body.state)) {
    return { valid: false, error: "Trường 'state' phải là boolean (true/false)" };
  }
  
  // ESP32 không hỗ trợ điều khiển buzzer riêng
  return { 
    valid: false, 
    error: 'ESP32 không hỗ trợ điều khiển buzzer độc lập. Buzzer được điều khiển tự động theo cảnh báo.' 
  };
}

/**
 * Validate tổng hợp dựa theo type
 */
function validateCommand(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Body không hợp lệ' };
  }

  if (!body.type || typeof body.type !== 'string') {
    return { valid: false, error: "Thiếu trường 'type'" };
  }

  switch (body.type) {
    case 'set_threshold':
      return validateThresholdRequest(body);
    case 'reminder':
      return validateReminderRequest(body);
    case 'snooze':
      return validateSnoozeRequest(body);
    case 'buzzer':
      return validateBuzzerRequest(body);
    default:
      return { valid: false, error: `Không hỗ trợ loại lệnh: ${body.type}` };
  }
}

module.exports = {
  validateBuzzerRequest,
  validateThresholdRequest,
  validateReminderRequest,
  validateSnoozeRequest,
  validateCommand
};