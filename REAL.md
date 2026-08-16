Hoàn thiện các chức năng thực tế 


Backend: 
- email
- Firebase
- MQTT 


ESP32 phải code:
- gửi dữ liệu 
- nhận lệnh điều khiển — kèm ví dụ code mẫu Arduino cho từng topic

Frontend cần làm;
- chỉ đổi baseURL, kèm lưu ý về CORS



1. Gửi email 
- Lấy mật khẩu ứng dụng trên google email account 

NOTIFY_EMAIL_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=lochithanh160905@gmail.com
SMTP_PASS=wrlactmlthzuxcol
ALERT_EMAIL_TO=lcthanh2425@clc.fitus.edu.vn

npm install nodemailer


2. firebase 
- Tạo real time firebase
- Lấy link 
- Lấy server account 

FIREBASE_MODE=real 
FIREBASE_DB_URL=https://vlbackend-e9b82-default-rtdb.firebaseio.com/
FIREBASE_SERVICE_ACCOUNT={
  "type": "service_account",
  "project_id": "vlbackend-e9b82",
  "private_key_id": "4dfa41144ab0d7ba8875ab984bc6dbb1d837f5e2",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC/4QooLc+GLxrC\nzm7thNUtLqpumJGoUXqVGZxjeAH1rJDpmnACIKyTOUAPiP0bhEUh0BjErRPtjpnF\n6GQpO1/oWsbS/m0fgrvhojFRBnxecqMZmvTesRh6vaoo0ZvWf65GLp1Q7XaFhZNV\nyf2tnr7ETtI6jBfrDNaH41y8qs1dfyjMlxT8AOKoMxcCRMK1etAqzxEoXg2Kx7ZJ\nwqMxxuq/Q093C1x8+8LidBnsc54NbmjuqzK5LmTCFD+sLYJjzB4M9leTtLr7nNSQ\nOJgYtvtXVSJ3gSOt8Clfe34WOzzHXMgVnG4PX27xLGuZm0ImrUimvZNvv6fQKZem\nN6In8K/ZAgMBAAECggEACNzeYB9krvPGCuNAx/w905uMpKOPb62JHUrUqKG/TlBf\nG9XV4/ULvHvMewepQiLIlAM/U2gUEVcvFcvFtJj1fKvNnseH8ew2oIeiOxKISWuj\nAy/C5fZazHCR1bqcYI/+/vUa6OGWJarse7UNp34CgNpTLjkexwl/b0EsVhN6C4/i\niUWeMtHIH1pDW4aE0iAyrh40zsSglRCRhWPwHvKoP2ZZLQRzxYrWCFu1alkZfP9S\nAvq2la/bktCz+9YMzqHd7QmPEfiVc9l9mhVkHdpVUWKOs0wZN1bKyPzP6AKDcsUr\nd0fIF2+hfR0J9ewhMczAd051NkdYp7Qev3rFknH+sQKBgQD6g/ebnCadhLOzcJoI\n1DTF39XOn6vnEzzg7cUWltjOaOM7LhY2Pk+VuKwOIsvwf3ekkRBtGzT76lEFLKpe\ntz/5mRZAXDBvXHy7TBnSBPGs8b7AG+BOJlj4Tfe0SWLOrczn6DwawJTKwgt7lckj\nJN/HJXuFEikbqfmRF1q9JKJYYwKBgQDEFHCvuYj8PPefqyRdEAUZIaqlJzBE/oeu\n2w8WQ970z4WUSEGSGVq5sPHXocnu0Jx0trxHhNkXbjJvX7rwKSUvG2c95THOAl4H\n5lCdb2yinSaFMaIbL90SpGX7YdIWE7ixdQEPTiN0YvjMbvPpIhM5hbWDzEUc78W2\nWGJ2XmoFkwKBgQCuIGZOSiZpHKEPm7flZSLdWy0w9rk036FUMtDoV6eRKUSwkOMt\nhvgoeHlXRgZ9Pwx5Xb+OJvgYFhGEyDwPo84a/raBu9KKxT2JrmbQHVGixVGyFG4/\nw9XZmdAQB2ZfhFzF4R1N9wg1OtVibIWnIO1ObhZCM5JRQT9QA2y1xa32QwKBgDfX\nOmBRDloHYt3t92Upcso9dEOkbXK4qht590n3+j7t+rTH/ySEY/oOElG+mauRbX0v\nrV8QzmKF14cwVCShEx3fR/+wjgaFVhIZ3Ut4uA93gcjc4bWsY+EzQHfe2929sBOZ\nprudHSvAI+rUjlIOijsPgSoPun8LKdtMQH5FVRxRAoGBAMqktZWJhb9fogxCLDKX\n2pZivnfJBnZU0HB8dNHAyboJFw0u7a3IFcUbXvEfX1jSeQ5uYUimZg7MzXy965KO\nM0+/5OT5R0C4xBcM2Uni8Tk9oZlCRvHXqv++5Ea4Lraf26cqFTc4VQLhwpYrgfHk\nFqcp8BWWfK/l9AZmxQTbCGhG\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-fbsvc@vlbackend-e9b82.iam.gserviceaccount.com",
  "client_id": "113189434053237793786",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40vlbackend-e9b82.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
}

npm install firebase-admin

3. MQTT 




4. Chức năng còn thiếu:
- Điều chỉnh ngưỡng min, max spO2, BPM