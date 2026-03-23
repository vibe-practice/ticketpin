# useB API 연동 가이드

> 출처: https://doc.useb.co.kr
> 버전: v1.4.0
> 작성일: 2026-03-18

---

## 목차

1. [개요](#개요)
2. [인증 (OAuth)](#인증-oauth)
3. [암호화 가이드](#암호화-가이드)
4. [1원 계좌인증](#1원-계좌인증)
5. [OCR (신분증 인식)](#ocr-신분증-인식)
6. [마스킹](#마스킹)
7. [사본판별](#사본판별)
8. [안면인증](#안면인증)
9. [진위확인](#진위확인)
10. [공통 에러 코드](#공통-에러-코드)

---

## 개요

useB API는 신분증 OCR, 진위확인, 1원 계좌인증, 안면인증, 마스킹, 사본판별 등을 제공하는 RegTech API 서비스.

### 기본 정보

| 항목 | 값 |
|------|-----|
| API 서버 (OCR/진위확인/마스킹/안면인증) | `https://api3.useb.co.kr` |
| API 서버 (계좌인증) | `https://openapi.useb.co.kr` |
| 인증 서버 | `https://auth.useb.co.kr` |
| 인증 방식 | Bearer Token (JWT) |
| Content-Type | `application/json` (기본), `multipart/form-data` (이미지 업로드) |
| 파일 크기 제한 | 5MB 이하 |
| 프로토콜 | HTTPS만 허용 (HTTP 불가) |

---

## 인증 (OAuth)

모든 API 호출 전에 JWT 토큰을 발급받아야 함.

### 1. Client ID / Client Secret 조회

```
POST https://auth.useb.co.kr/oauth/get-client-secret
```

**Header**

| Field | Value |
|-------|-------|
| Content-Type | application/json |

**Request Body**

| Field | Type | 필수 | 설명 |
|-------|------|------|------|
| email | String | O | 계정 이메일 |
| password | String | O | 비밀번호 |

**Response**

| Field | Type | 설명 |
|-------|------|------|
| success | Boolean | 성공 여부 |
| message | String | 메시지 |
| data.client_id | String | 클라이언트 ID |
| data.client_secret | String | 클라이언트 시크릿 |
| transaction_id | String | API 로그 추적 ID |

**에러 코드**

| 코드 | 타입 | 설명 |
|------|------|------|
| KC001 | account_info_invalid | 계정 정보가 잘못된 경우 |

### 2. 토큰 생성

```
POST https://auth.useb.co.kr/oauth/token
```

**Header**

| Field | Value |
|-------|-------|
| Content-Type | application/json |
| Authorization | Basic {base64(client_id:client_secret)} |

**Response**

| Field | Type | 설명 |
|-------|------|------|
| success | Boolean | 성공 여부 |
| message | String | 메시지 |
| jwt | String | JWT 토큰 (이후 API 호출 시 사용) |
| expires_in | String | 만료시간 (예: 2021-05-08 18:39:00) |
| transaction_id | String | API 로그 추적 ID |

**에러 코드**

| 코드 | 타입 | 설명 |
|------|------|------|
| C003 | client_info_invalid | client_id/client_secret 정보가 잘못된 경우 |

**사용 예시**
```json
// 요청 (Authorization 헤더)
"Authorization": "Basic ZTcyYzQ4YWYtNmQyYi00MzUxLWFmMWYtNzQ5M2ZjYmYyMmQ2OmU3N2QzNDgzLTNlZTgtNDRhZi1hYzRkLWEyYzU2ZWZmODQxNQ=="

// 응답
{
  "success": true,
  "message": "Token issued successfully",
  "jwt": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "expires_in": "2021-05-08 18:39:00",
  "transaction_id": "6850de15be64750b2c4d13d73190cf58"
}
```

---

## 암호화 가이드

개인정보(주민번호, 계좌번호 등)를 AES256으로 암호화하여 전송 가능. `secret_mode: true`로 설정 시 적용.

### 플로우

1. Client ID/Secret 조회 → `POST /oauth/get-client-secret`
2. RSA2048 공개키/비밀키 생성 (테스트용) → `POST /keys/generate-key-pair`
3. 공개키 등록 → `POST /keys/register-public-key`
4. 키교환 (대칭키 발급) → `POST /keys/exchange-keys`
5. 대칭키로 AES256 암호화/복호화

### 키교환 API

```
POST https://auth.useb.co.kr/keys/exchange-keys
```

**Request Body**

| Field | Type | 설명 |
|-------|------|------|
| client_id | String | 클라이언트 ID |
| client_secret | String | 클라이언트 시크릿 |

**Response**

| Field | Type | 설명 |
|-------|------|------|
| encrypted_ses_key | String | RSA 암호화된 세션키 |
| encrypted_sym_key | String | AES 암호화된 대칭키 |
| expiry_date | String | 대칭키 만료 일자 |

### 테스트용 암호화/복호화 API

```
POST https://auth.useb.co.kr/keys/encrypt    // 암호화
POST https://auth.useb.co.kr/keys/decrypt    // 복호화
```

---

## 1원 계좌인증

사용자 본인 계좌를 인증하는 플로우. **오픈뱅킹**, **펌뱅킹**, **펌뱅킹-프리미엄** 3가지 방식 제공.

### 플로우 (오픈뱅킹 기준)

```
1. 계좌실명조회 → 예금주명 확인
2. 1원 입금이체 → 계좌로 1원 + 인증코드 송금
3. 인증코드 검증 → 사용자가 확인한 인증코드 입력하여 검증
```

### 1. [오픈뱅킹] 계좌실명조회

```
POST https://openapi.useb.co.kr/realname
```

**Header**

| Field | Value |
|-------|-------|
| Content-Type | application/json |
| Authorization | Bearer {jwt_token} |

**Request Body**

| Field | Type | 필수 | 설명 |
|-------|------|------|------|
| bank_code | String | O | 은행코드 (3자리). 예: 081(하나), 088(신한), 003(IBK기업), 004(KB국민), 011(NH농협), 020(우리), 090(카카오뱅크) |
| account_num | String | O | 계좌번호 |
| account_holder_info_type | String | O | " "(space): 생년월일, "6": 사업자등록번호 |
| account_holder_info | String | O | 생년월일(6자리, yymmdd) 또는 사업자등록번호 |
| secret_mode | Boolean | X | AES256 암호화 적용 여부 |

**Response**

| Field | Type | 설명 |
|-------|------|------|
| success | Boolean | 성공 여부 |
| message | String | 메시지 |
| data.bank_code | String | 은행코드 |
| data.bank_name | String | 은행명 |
| data.account_num | String | 계좌번호 |
| data.account_holder_name | String | 예금주명 |
| transaction_id | String | API 로그 추적 ID |

**에러 코드**

| 코드 | 타입 | 설명 |
|------|------|------|
| RN001 | bank_code_invalid | 존재하지 않는 은행코드 |
| RN002 | parameter_missing | 은행코드/계좌번호/생년월일 누락 |
| RN003 | account_holder_info_invalid | 생년월일 자릿수 오류 (6자리) |
| RN004 | account_info_invalid | 계좌번호 또는 생년월일 불일치 |
| RN013 | banking_system_checking_hours | 은행 점검시간 |

### 2. [오픈뱅킹] 1원 입금이체

```
POST https://openapi.useb.co.kr/send
```

**Request Body**

| Field | Type | 필수 | 설명 |
|-------|------|------|------|
| bank_code | String | O | 은행코드 (3자리) |
| account_num | String | O | 계좌번호 |
| account_holder_name | String | O | 예금주명 |
| code_type | String | O | 인증코드 타입: "korean", "english", "number" 또는 적요 글자(한글 1~3자, "1234+글자" 형태) |
| client_name | String | X | 고객사명 |
| client_business_num | String | X | 고객사 사업자등록번호 |
| code_position | String | X | 코드 위치: "front"(1234유스비) 또는 "back"(유스1234) |
| secret_mode | Boolean | X | AES256 암호화 적용 여부 |

**Response**

| Field | Type | 설명 |
|-------|------|------|
| success | Boolean | 성공 여부 |
| message | String | 메시지 |
| transaction_id | String | API 로그 추적 ID (**인증코드 검증 시 필요**) |

**에러 코드**

| 코드 | 타입 | 설명 |
|------|------|------|
| S001 | bank_code_invalid | 은행코드 자릿수 오류 (3자리) |
| S002 | parameter_missing | 은행코드/계좌번호/예금주명 누락 |
| S005 | Daily_limit_exceeded | 동일계좌 일일 10회 초과 |
| S006 | request_is_restricted | 동일계좌 일일 10회 초과 |
| S011 | account_info_invalid | 은행코드/계좌번호 불일치 |
| S012 | account_holder_name_invalid | 예금주명 불일치 |
| S013 | banking_system_checking_hours | 은행 점검시간 |

### 3. [오픈뱅킹] 1원 인증코드 검증

```
POST https://openapi.useb.co.kr/verify
```

**Request Body**

| Field | Type | 필수 | 설명 |
|-------|------|------|------|
| transaction_id | String | O | 1원 입금이체 응답의 transaction_id |
| print_content | String | O | 사용자가 입력한 인증코드 |

**Response**

| Field | Type | 설명 |
|-------|------|------|
| success | Boolean | 성공 여부 |
| message | String | 메시지 |
| data.pair_transaction_id | String | 1원 입금이체의 transaction_id |
| data.print_content | String | 인증코드 |
| transaction_id | String | API 로그 추적 ID |

**에러 코드**

| 코드 | 타입 | 설명 |
|------|------|------|
| V001 | code_mismatch | 인증코드 불일치 |
| V002 | parameter_missing | transaction_id/print_content 누락 |
| V021 | code_trial_exceeds_limit | 최대 시도 횟수 초과 (**5회**) |
| V031 | code_expired | 인증코드 만료 (**발송 5분 후 만료**) |

### 펌뱅킹 API (별도 계약)

| API | 엔드포인트 |
|-----|-----------|
| [펌뱅킹] 1원 입금이체 | `POST https://openapi.useb.co.kr/firmbank/send` |
| [펌뱅킹] 1원 인증코드 검증 | `POST https://openapi.useb.co.kr/firmbank/verify` |
| [펌뱅킹-프리미엄] 계좌실명조회 | `POST https://openapi.useb.co.kr/firmbank-custom/realname` |
| [펌뱅킹-프리미엄] 1원 입금이체 | `POST https://openapi.useb.co.kr/firmbank-custom/send` |
| [펌뱅킹-프리미엄] 1원 인증코드 검증 | `POST https://openapi.useb.co.kr/firmbank-custom/verify` |

> 요청/응답 형식은 오픈뱅킹과 동일. 펌뱅킹-프리미엄은 `tid` 필드를 사용하여 검증.

---

## OCR (신분증 인식)

신분증 이미지를 전송하면 텍스트 정보를 추출하여 반환.

### 지원 신분증 종류

| idType | 신분증 | 엔드포인트 |
|--------|--------|-----------|
| 1 | 주민등록증 | `POST /ocr/idcard-driver` |
| 2 | 운전면허증 | `POST /ocr/idcard-driver` |
| 3 | 한국여권 | `POST /ocr/passport` |
| 4 | 외국인여권 | `POST /ocr/passport-overseas` |
| 5 | 외국인등록증 | `POST /ocr/alien` |
| - | 사업자등록증 | `POST /ocr-doc/business-registration` |

> 기본 URL: `https://api3.useb.co.kr`

### OCR - 주민등록증/운전면허증

```
POST https://api3.useb.co.kr/ocr/idcard-driver
```

**Header**

| Field | Value |
|-------|-------|
| Content-Type | application/json 또는 multipart/form-data |
| Authorization | Bearer {jwt_token} |

**Request Body**

| Field | Type | 필수 | 설명 |
|-------|------|------|------|
| image_base64 | String | △ | 신분증 사진 (base64) — image와 택1 |
| image | File | △ | 신분증 사진 파일 (jpg, png, pdf) — image_base64와 택1 |
| mask_mode | Boolean | X | 마스킹 처리된 이미지 반환 여부 |
| secret_mode | Boolean | X | AES256 암호화 적용 여부 |
| ssa_mode | Boolean | X | 사본판별 기능 적용 (실물 여부 판단) |
| driver_type | Boolean | X | 운전면허증 종류 응답 추가 (운전면허증용) |
| serial_mode | Boolean | X | 운전면허증 암호일련번호 추가 (운전면허증용) |

**Response (주민등록증)**

| Field | Type | 설명 |
|-------|------|------|
| success | Boolean | 성공 여부 |
| data.idType | String | "1" (주민등록증) |
| data.userName | String | 이름 |
| data.juminNo1 | String | 주민번호 앞자리 (생년월일 6자리) |
| data.juminNo2 | String | 주민번호 뒷자리 (7자리) |
| data._juminNo2 | String | 주민번호 뒷자리 마스킹 (예: 1******) |
| data.issueDate | String | 발급일자 (예: 20140703) |
| data.id_real | Boolean | 사본판별 결과 (ssa_mode=true 시) |
| data.id_confidence | String | 사본판별 정확도 (0.5 이상이면 실물) |
| transaction_id | String | API 로그 추적 ID |

**Response (운전면허증)**

| Field | Type | 설명 |
|-------|------|------|
| data.idType | String | "2" (운전면허증) |
| data.userName | String | 이름 |
| data.driverNo | String | 운전면허번호 (예: 11-16-044390-60) |
| data.juminNo1 | String | 주민번호 앞자리 |
| data.juminNo2 | String | 주민번호 뒷자리 |
| data.issueDate | String | 발급일자 |
| data.driverType | String | 면허 종류 (driver_type=true 시) |
| data.serialNo | String | 암호일련번호 (serial_mode=true 시) |

**OCR 공통 에러 코드**

| 코드 | 타입 | 설명 |
|------|------|------|
| O002 | file_format_invalid | 파일 형식 오류 (jpg, png, pdf만 허용) |
| O003 | id_type_invalid | 다른 신분증 / 빛반사 / 화질 문제 |
| O004 | file_width_too_small | 가로 500px 이하 (500~1000px 권장) |
| O005 | copied_id_not_allowed | 흑백 복사본 신분증 |
| O007 | empty_data | 이미지 없이 호출 |
| O010 | partially_recognized | 부분 인식 (HTTP 200이지만 일부 정보 누락) |

---

## 마스킹

신분증 이미지에서 개인정보를 마스킹 처리한 이미지를 반환.

| 대상 | 엔드포인트 |
|------|-----------|
| 주민등록증 | `POST https://api3.useb.co.kr/masking/idcard` |
| 운전면허증 | `POST https://api3.useb.co.kr/masking/driver` |
| 한국여권 | `POST https://api3.useb.co.kr/masking/passport` |
| 외국인등록증 | `POST https://api3.useb.co.kr/masking/alien` |

**Response**

| Field | Type | 설명 |
|-------|------|------|
| data.image_base64_mask | String | 마스킹된 이미지 (base64) |

---

## 사본판별

신분증이 실물인지 사본(복사/촬영)인지 판별.

| 대상 | 엔드포인트 |
|------|-----------|
| 주민등록증/운전면허증 | `POST https://api3.useb.co.kr/ssa/idcard-driver` |
| 외국인등록증 | `POST https://api3.useb.co.kr/ssa/alien` |
| 한국여권 | `POST https://api3.useb.co.kr/ssa/passport` |

**Response**

| Field | Type | 설명 |
|-------|------|------|
| data.id_real | Boolean | 실물 여부 (true=실물) |
| data.id_confidence | String | 정확도 (0.5 이상이면 실물) |

---

## 안면인증

### 1. 안면 일치여부 확인

신분증 사진과 셀카 사진의 얼굴이 동일 인물인지 확인.

```
POST https://api3.useb.co.kr/facecheck
```

**Request Body**

| Field | Type | 필수 | 설명 |
|-------|------|------|------|
| image_base64_id | String | △ | 신분증 사진 (base64) |
| image_id | File | △ | 신분증 사진 파일 |
| image_base64_face | String | △ | 셀카 사진 (base64) |
| image_face | File | △ | 셀카 사진 파일 |

**Response**

| Field | Type | 설명 |
|-------|------|------|
| isIdentical | Boolean | 동일인 여부 |
| confidence | String | 일치 확률 (0.0~1.0) |

### 2. 안면 라이브니스

실제 사람의 얼굴인지 판별 (사진 공격 방지).

```
POST https://api3.useb.co.kr/face-liveness
```

**Request Body**: face1~face4 (최대 4장의 얼굴 사진)

**Response**

| Field | Type | 설명 |
|-------|------|------|
| isIdentical | Boolean | 실제 얼굴 여부 |
| confidence | String | 라이브니스 확률 |

---

## 진위확인

신분증 정보가 정부기관 데이터와 일치하는지 확인.

### 1. 진위확인 - 주민등록증

```
POST https://api3.useb.co.kr/status/idcard
```

**Request Body**

| Field | Type | 필수 | 설명 |
|-------|------|------|------|
| identity | String | O | 주민등록번호 13자리 (예: 8811211056911) |
| issueDate | String | O | 발급일자 8자리 (예: 20000301) |
| userName | String | O | 이름 |
| secret_mode | Boolean | X | AES256 암호화 적용 |

**Response**

| Field | Type | 설명 |
|-------|------|------|
| success | Boolean | true=진위확인 성공 (정보 일치) |
| message | String | 결과 메시지 |
| transaction_id | String | API 로그 추적 ID |

**에러 코드**

| 코드 | 타입 | 설명 |
|------|------|------|
| A001 | idcard_number_invalid | 주민등록번호 오류/자릿수 불일치 |
| A002 | idcard_issuedate_invalid | 발급일자 자릿수 불일치 |
| A003 | parameter_missing | 필수 파라미터 누락 |
| A004 | idcard_error | (1)이름 불일치 (2)발급일자 불일치 |
| A005 | issue_date_error | 발급일자 입력오류 5회 → 잠김 (gov.kr에서 해제 필요) |
| A006 | idcard_lost | 정보 일치하지만 분실 신고된 경우 |

### 2. 진위확인 - 운전면허증

```
POST https://api3.useb.co.kr/status/driver
```

**Request Body**

| Field | Type | 필수 | 설명 |
|-------|------|------|------|
| userName | String | O | 이름 |
| birthDate | String | O | 생년월일 8자리 (예: 19821120) |
| licenseNo | String | O | 운전면허번호 (예: 11-16-044391-61) |
| juminNo | String | X | 주민등록번호 (유효성 검사용) |
| serialNo | String | X | 암호일련번호 (예: 9WSWRQ) |
| secret_mode | Boolean | X | AES256 암호화 적용 |

**에러 코드**

| 코드 | 타입 | 설명 |
|------|------|------|
| A011 | id_number_invalid | 주민등록번호 유효성 검사 실패 |
| A013 | driver_error | 면허번호/생년월일/이름 오류 또는 누락 |
| A014 | serial_number_invalid | 암호일련번호 불일치 |
| A015 | scrapping_error | 스크래핑 에러 |
| A016 | license_number_invalid | 유효하지 않은 (과거) 면허번호 |

### 3. 진위확인 - 한국여권

```
POST https://api3.useb.co.kr/status/passport
```

**Request Body**

| Field | Type | 필수 | 설명 |
|-------|------|------|------|
| userName | String | O | 이름 |
| passportNo | String | O | 여권번호 (예: M56159620) |
| issueDate | String | O | 발급일자 8자리 |
| expirationDate | String | O | 만료일자 8자리 |
| birthDate | String | O | 생년월일 8자리 |
| secret_mode | Boolean | X | AES256 암호화 적용 |

**에러 코드**

| 코드 | 타입 | 설명 |
|------|------|------|
| A021 | passport_number_invalid | 여권번호 누락/오류 |
| A023 | passport_error | 여권 정보 일부 누락/오류 |
| A024 | passport_expired | 여권 만료 또는 분실 신고 |

### 4. 진위확인 - 외국인여권

```
POST https://api3.useb.co.kr/status/passport-overseas
POST https://api3.useb.co.kr/status/passport-overseas-detail  (체류만료일 조회 포함)
```

**Request Body**

| Field | Type | 필수 | 설명 |
|-------|------|------|------|
| passportNo | String | O | 여권번호 |
| nationality | String | O | 국적 3자리 코드 (예: CHN) |
| birthDate | String | O | 생년월일 8자리 |
| secret_mode | Boolean | X | AES256 암호화 적용 |

### 5. 진위확인 - 외국인등록증

```
POST https://api3.useb.co.kr/status/alien
```

### 6. 진위확인 - 사업자등록 및 휴폐업 조회

```
POST https://api3.useb.co.kr/status/business-registration
```

---

## 공통 에러 코드

### HTTP Status Code

| 코드 | 상태 | 설명 |
|------|------|------|
| 200 | OK | 정상 호출 |
| 400 | Bad Request | 잘못된 Content-Type 또는 Parameter |
| 401 | Unauthorized | 토큰 없음/잘못됨/만료 |
| 403 | Forbidden | 사용 불가 API scope / HTTP 호출 |
| 404 | Not Found | 잘못된 URL |
| 405 | Method Not Allowed | 잘못된 HTTP Method |
| 500 | Server Error | 정부기관 서버 점검/장애, API 서버 오류 |

### Common Error Code

| 코드 | 타입 | 설명 |
|------|------|------|
| C001 | content_type_invalid | 잘못된 Content-Type |
| C002 | json_format_error | JSON 형식이 아닌 경우 |
| C011 | token_invalid | Bearer Token 형식 아님/잘못됨/없음 |
| C013 | token_issuer_mismatch | 다른 서버에서 생성한 토큰 |
| C016 | network_time_out | 정부기관 네트워크 오류 |
| C021 | scope_invalid | API scope에 포함되지 않음 |
| C022 | http_not_allowed | HTTPS가 아닌 HTTP 호출 |
| C031 | url_invalid | 잘못된 URL |
| C041 | method_not_allowed | 잘못된 HTTP Method |
| C061 | server_error | 정부기관 서버 점검/장애 |
| C071 | out_of_credit | 테스트 한도 초과 (CS팀 문의) |
| C413 | payload_too_large | 파일 크기 5MB 초과 |
| C504 | gateway_time_out | 응답 지연 (15초 이상) |
| C004 | account_suspended | 서비스 중지된 계정 |
| C429 | too_many_requests | 동시 다량 API 호출 초과 |

### 필독 사항

- **C016, C061, C504** 에러 발생 시: 정부기관 점검/장애일 수 있으므로 "다른 신분증을 활용해 주세요" 메시지를 프론트에 세팅하는 것을 권장

---

## 티켓핀 연동 시 사용할 API 정리

회원가입 시 사용할 API만 정리:

### 1단계: 휴대폰 본인인증 (기존 구현 — 다날 T-PAY)

### 2단계: 신분증 진위확인 (useB)

| 순서 | API | 설명 |
|------|-----|------|
| ① | OCR (주민등록증 또는 운전면허증) | 신분증 사진 → 텍스트 추출 |
| ② | 진위확인 (주민등록증 또는 운전면허증) | OCR 결과로 정부기관 데이터와 대조 |

### 3단계: 1원 계좌인증 (useB)

| 순서 | API | 설명 |
|------|-----|------|
| ① | 계좌실명조회 | 은행코드 + 계좌번호 + 생년월일 → 예금주명 확인 |
| ② | 1원 입금이체 | 계좌로 1원 + 인증코드 송금 |
| ③ | 인증코드 검증 | 사용자가 확인한 인증코드 입력 → 검증 |

### 필요한 환경변수

```env
USEB_EMAIL=           # useB 계정 이메일
USEB_PASSWORD=        # useB 계정 비밀번호
USEB_CLIENT_ID=       # Client ID
USEB_CLIENT_SECRET=   # Client Secret
```

### 은행 코드표 (주요)

| 코드 | 은행명 |
|------|--------|
| 003 | IBK기업은행 |
| 004 | KB국민은행 |
| 011 | NH농협은행 |
| 020 | 우리은행 |
| 081 | 하나은행 |
| 088 | 신한은행 |
| 090 | 카카오뱅크 |
| 092 | 토스뱅크 |
