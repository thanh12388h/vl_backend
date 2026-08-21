/**
 * MOCK ESP32 SIMULATOR
 *
 * Mô phỏng ESP32 thật:
 *
 * 1. Publish telemetry mỗi 1 giây:
 *    24127541/device/{DEVICE_ID}/data
 *
 *    Payload:
 *    {
 *      device_id,
 *      timestamp,
 *      spo2,
 *      bpm,
 *      temperature,
 *      finger_detected
 *    }
 *
 * 2. Publish status mỗi 3 giây (demo):
 *    24127541/device/{DEVICE_ID}/status
 *
 *    Payload:
 *    {
 *      online: true,
 *      last_seen
 *    }
 *
 * 3. Subscribe command:
 *    24127541/device/{DEVICE_ID}/control/oled
 *
 *    Có thể nhận:
 *      - set_threshold
 *      - snooze
 *      - reminder
 *
 * 4. Kịch bản dữ liệu:
 *    - 15 mẫu bình thường
 *    - 20 mẫu bất thường
 *    - quay lại bình thường
 *
 * Chạy:
 *    node test/mock-esp32-simulator.js
 *
 * Backend phải chạy trước.
 */

require('dotenv').config();

const mqtt = require('mqtt');

// ================================================================
// CONFIG
// ================================================================

const DEVICE_ID = process.env.SIM_DEVICE_ID || 'esp32_001';

const BROKER_URL =
    process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';

const PREFIX = '24127541';

const SAMPLE_INTERVAL_MS = 1000;      // ESP32 thật: 1Hz
const HEARTBEAT_INTERVAL_MS = 3000;   // Demo: 3s, ESP32 thật: 5s status

const TELEMETRY_TOPIC =
    `${PREFIX}/device/${DEVICE_ID}/data`;

const STATUS_TOPIC =
    `${PREFIX}/device/${DEVICE_ID}/status`;

const COMMAND_TOPIC =
    `${PREFIX}/device/${DEVICE_ID}/control/oled`;


// ================================================================
// MQTT CLIENT
// ================================================================

const client = mqtt.connect(BROKER_URL, {
    clientId: `esp32-sim-${DEVICE_ID}-${Date.now()}`
});


// ================================================================
// SIMULATION CONFIG
// ================================================================

let sampleCount = 0;

const TOTAL_NORMAL_SAMPLES = 15;
const TOTAL_ABNORMAL_SAMPLES = 20;

// Sau khi hết bất thường, gửi thêm mẫu bình thường
const TOTAL_RECOVERY_SAMPLES = 10;


// ================================================================
// THRESHOLDS
// Mô phỏng threshold hiện tại của ESP32
// ================================================================

let thresholds = {
    spo2_min: 90,
    bpm_min: 50,
    bpm_max: 120,
    temp_min: 35,
    temp_max: 38
};


// ================================================================
// HELPER
// ================================================================

function randomInRange(min, max) {
    return Math.round(
        (Math.random() * (max - min) + min) * 10
    ) / 10;
}


// ================================================================
// GENERATE SENSOR DATA
// ================================================================

function nextSample() {
    sampleCount += 1;

    // ------------------------------------------------------------
    // GIAI ĐOẠN 1: BÌNH THƯỜNG
    // ------------------------------------------------------------

    if (sampleCount <= TOTAL_NORMAL_SAMPLES) {
        return {
            spo2: randomInRange(96, 99),
            bpm: Math.round(randomInRange(70, 85)),
            temperature: randomInRange(36.2, 37.2),
            finger_detected: true
        };
    }


    // ------------------------------------------------------------
    // GIAI ĐOẠN 2: BẤT THƯỜNG
    //
    // SpO2 thấp
    // BPM cao
    // Temperature cao
    //
    // Backend phải phát hiện bất thường.
    // ------------------------------------------------------------

    if (
        sampleCount <=
        TOTAL_NORMAL_SAMPLES + TOTAL_ABNORMAL_SAMPLES
    ) {
        return {
            spo2: randomInRange(84, 89),
            bpm: Math.round(randomInRange(125, 135)),
            temperature: randomInRange(38.5, 39.2),
            finger_detected: true
        };
    }


    // ------------------------------------------------------------
    // GIAI ĐOẠN 3: QUAY LẠI BÌNH THƯỜNG
    // ------------------------------------------------------------

    if (
        sampleCount <=
        TOTAL_NORMAL_SAMPLES +
        TOTAL_ABNORMAL_SAMPLES +
        TOTAL_RECOVERY_SAMPLES
    ) {
        return {
            spo2: randomInRange(96, 99),
            bpm: Math.round(randomInRange(70, 85)),
            temperature: randomInRange(36.2, 37.2),
            finger_detected: true
        };
    }


    return null;
}


// ================================================================
// RECEIVE COMMAND FROM BACKEND
// ================================================================

function handleCommand(topic, payloadBuffer) {

    if (topic !== COMMAND_TOPIC) {
        return;
    }

    let command;

    try {
        command = JSON.parse(payloadBuffer.toString());
    } catch (error) {
        console.error(
            '[ESP32-SIM] ❌ JSON command không hợp lệ:',
            error.message
        );
        return;
    }

    const type = command.type || '';

    console.log('\n[ESP32-SIM] ================= COMMAND =================');
    console.log('[ESP32-SIM] <- Topic:', topic);
    console.log('[ESP32-SIM] <- Payload:', command);


    // ============================================================
    // SET THRESHOLD
    // ============================================================

    if (type === 'set_threshold') {

        if (command.spo2_min !== undefined) {
            thresholds.spo2_min = Number(command.spo2_min);
        }

        if (command.bpm_min !== undefined) {
            thresholds.bpm_min = Number(command.bpm_min);
        }

        if (command.bpm_max !== undefined) {
            thresholds.bpm_max = Number(command.bpm_max);
        }

        if (command.temp_min !== undefined) {
            thresholds.temp_min = Number(command.temp_min);
        }

        if (command.temp_max !== undefined) {
            thresholds.temp_max = Number(command.temp_max);
        }

        console.log(
            '[ESP32-SIM] ✅ Threshold đã cập nhật:'
        );

        console.log(
            '[ESP32-SIM]    SpO2 min :',
            thresholds.spo2_min
        );

        console.log(
            '[ESP32-SIM]    BPM      :',
            thresholds.bpm_min,
            '->',
            thresholds.bpm_max
        );

        console.log(
            '[ESP32-SIM]    Temp     :',
            thresholds.temp_min,
            '->',
            thresholds.temp_max
        );
    }


    // ============================================================
    // SNOOZE
    // ============================================================

    else if (type === 'snooze') {

        const durationSec =
            Number(command.duration_sec) || 60;

        console.log(
            `[ESP32-SIM] 🔕 SNOOZE ${durationSec}s`
        );
    }


    // ============================================================
    // REMINDER
    // ============================================================

    else if (type === 'reminder') {

        const message =
            command.message || 'NHAC NHO';

        const durationSec =
            Number(command.duration_sec) || 15;

        console.log(
            `[ESP32-SIM] 🔔 REMINDER: "${message}" trong ${durationSec}s`
        );
    }


    // ============================================================
    // UNKNOWN COMMAND
    // ============================================================

    else {

        console.log(
            '[ESP32-SIM] ⚠️ Command không xác định:',
            type
        );
    }

    console.log(
        '[ESP32-SIM] ============================================\n'
    );
}


// ================================================================
// MQTT CONNECT
// ================================================================

client.on('connect', () => {

    console.log('');
    console.log('================================================');
    console.log('        ESP32 MOCK SIMULATOR STARTED');
    console.log('================================================');

    console.log('[ESP32-SIM] Device ID :', DEVICE_ID);
    console.log('[ESP32-SIM] Broker    :', BROKER_URL);

    console.log('');
    console.log('[ESP32-SIM] TELEMETRY :', TELEMETRY_TOPIC);
    console.log('[ESP32-SIM] STATUS    :', STATUS_TOPIC);
    console.log('[ESP32-SIM] COMMAND   :', COMMAND_TOPIC);

    console.log('================================================');
    console.log('');


    // ============================================================
    // SUBSCRIBE COMMAND
    // ============================================================

    client.subscribe(
        COMMAND_TOPIC,
        (err) => {

            if (err) {
                console.error(
                    '[ESP32-SIM] ❌ Subscribe command thất bại:',
                    err.message
                );
                return;
            }

            console.log(
                '[ESP32-SIM] ✅ Đã subscribe:',
                COMMAND_TOPIC
            );
        }
    );


    // ============================================================
    // RECEIVE MESSAGE
    // ============================================================

    client.on('message', handleCommand);


    // ============================================================
    // TELEMETRY TIMER
    // ============================================================

    const dataTimer = setInterval(() => {

        const sample = nextSample();

        if (!sample) {

            clearInterval(dataTimer);

            console.log('');
            console.log(
                '[ESP32-SIM] ✅ Kết thúc mô phỏng dữ liệu.'
            );

            return;
        }


        const payload = {

            device_id: DEVICE_ID,

            timestamp:
                new Date().toISOString(),

            spo2: sample.spo2,

            bpm: sample.bpm,

            temperature: sample.temperature,

            finger_detected:
                sample.finger_detected
        };


        client.publish(
            TELEMETRY_TOPIC,
            JSON.stringify(payload)
        );


        console.log(
            '[ESP32-SIM] -> TELEMETRY',
            JSON.stringify(payload)
        );

    }, SAMPLE_INTERVAL_MS);


    // ============================================================
    // HEARTBEAT TIMER
    // ============================================================

    const heartbeatTimer = setInterval(() => {

        const payload = {

            online: true,

            last_seen:
                new Date().toISOString()
        };


        client.publish(
            STATUS_TOPIC,
            JSON.stringify(payload)
        );


        console.log(
            '[ESP32-SIM] -> STATUS',
            JSON.stringify(payload)
        );

    }, HEARTBEAT_INTERVAL_MS);


    // Cho Node không bị giữ process chỉ vì heartbeat timer
    heartbeatTimer.unref?.();
});


// ================================================================
// MQTT ERROR
// ================================================================

client.on('error', (err) => {

    console.error(
        '[ESP32-SIM] ❌ MQTT Error:',
        err.message
    );
});


// ================================================================
// MQTT DISCONNECT
// ================================================================

client.on('close', () => {

    console.log(
        '[ESP32-SIM] MQTT connection closed.'
    );
});


// ================================================================
// PROCESS EXIT
// ================================================================

process.on('SIGINT', () => {

    console.log('');
    console.log('[ESP32-SIM] Đang ngắt kết nối...');

    client.end(
        true,
        () => {
            console.log(
                '[ESP32-SIM] Đã thoát simulator.'
            );
            process.exit(0);
        }
    );
});