# MainPay PG API 연동 가이드

## 기본 정보

| 항목 | 값 |
|------|-----|
| PG사 | MainPay (섹타나인) |
| 상용 API HOST | https://relay.mainpay.co.kr |
| 테스트 API HOST | https://test-relay.mainpay.co.kr |
| 결제창 API HOST | https://api-std.mainpay.co.kr (상용) / https://test-api-std.mainpay.co.kr (테스트) |
| 프로토콜 | HTTPS, TLS1.2 only |
| Content-Type | application/x-www-form-urlencoded; charset=utf-8 |
| 응답 형식 | application/json; charset=utf-8 |

### 테스트 정보 (개발용)

| 항목 | 값 |
|------|-----|
| mbrNo | 100011 |
| apiKey | U1FVQVJFLTEwMDAxMTIwMTgwNDA2MDkyNTMyMTA1MjM0 |

### 실서비스 정보 (.env.local)

| 항목 | 환경변수 |
|------|---------|
| MBR | MAINPAY_MBR |
| API Key | MAINPAY_API_KEY |

---

## Signature 생성

모든 API 호출에 signature 필수.

- 알고리즘: SHA-256
- 대상: `mbrNo|mbrRefNo|amount|apiKey|timestamp`
- 구분자 `|`로 연결 후 해싱 (공백 제거)

```
sha256_hash(mbrNo|mbrRefNo|amount|apiKey|timestamp)
```

---

## 1. 결제창 연동 (인증결제)

지불수단: CARD (신용카드, 간편결제 포함)

### 1-1. 결제 준비

```
POST https://api-std.mainpay.co.kr/v1/payment/ready
```

**요청 파라미터 (*필수)**

| 변수명 | 설명 | 최대길이 |
|--------|------|---------|
| mbrNo* | 가맹점번호 | 6 |
| mbrRefNo* | 가맹점주문번호 (중복불가) | 20 |
| paymethod* | 지불수단 (CARD) | 5 |
| amount* | 총결제금액 | 10 |
| goodsName* | 상품명 | 30 |
| approvalUrl* | 인증결과 수신 URL | 500 |
| closeUrl* | 결제종료 수신 URL | 300 |
| timestamp* | 시스템시각 (yyMMddHHmmssSSS) | 18 |
| signature* | SHA-256 서명값 | 64 |
| customerTelNo | 구매자전화번호 | 12 |
| customerName | 구매자명 | 30 |
| customerEmail | 구매자이메일 | 50 |
| merchantData | 가맹점 전용필드 (URL인코딩 필수) | 500 |
| availableCards | 카드코드 지정 (JSON Array) | 100 |
| availableInstallment | 할부개월수 지정 (예: "03:04:05") | 100 |

**응답**

| 변수명 | 설명 |
|--------|------|
| resultCode | "200" = 성공 |
| resultMessage | 응답메시지 |
| data.aid | 결제 준비 일련번호 (승인 시 재사용) |
| data.nextPcUrl | PC 결제화면 URL (팝업 방식) |
| data.nextMobileUrl | 모바일 결제화면 URL (리다이렉트 방식) |

### 1-2. 결제화면 요청

- PC: `nextPcUrl`을 팝업으로 열기 (iframe 미지원)
- 모바일: `nextMobileUrl`로 리다이렉트 (팝업/iframe 미지원)

### 1-3. approvalUrl 수신 (PG -> 가맹점)

인증 성공 시 GET 방식으로 호출됨.

| 변수명 | 설명 |
|--------|------|
| aid | ready 호출 일련번호 |
| authToken | 거래인증용 토큰 (승인 시 필요) |
| payType | 결제타입 (망취소 시 필요) |
| merchantData | 가맹점 전용필드 |

### 1-4. 결제 승인

```
POST https://api-std.mainpay.co.kr/v1/payment/pay
```

**요청 파라미터 (*필수)**

| 변수명 | 설명 | 최대길이 |
|--------|------|---------|
| mbrNo* | 가맹점번호 | 6 |
| aid* | 결제 준비 응답의 aid | 40 |
| mbrRefNo* | 가맹점주문번호 | 20 |
| authToken* | approvalUrl에서 수신한 토큰 | 40 |
| paymethod* | 지불수단 (CARD) | 5 |
| amount* | 총결제금액 | 10 |
| timestamp* | 시스템시각 | 18 |
| signature* | SHA-256 서명값 | 64 |

**응답 (신용카드)**

| 변수명 | 설명 | DB 저장 필요 |
|--------|------|-------------|
| data.mbrNo | 가맹점번호 | |
| data.refNo | 거래번호 (취소 시 필요) | O (필수) |
| data.tranDate | 거래일자 (취소 시 필요) | O (필수) |
| data.tranTime | 거래시각 | O |
| data.mbrRefNo | 가맹점주문번호 | O |
| data.amount | 결제금액 | O |
| data.applNo | 승인번호 | O |
| data.cardNo | 카드번호 (마스킹, 예: 949019******8803) | O |
| data.installment | 할부 개월수 | O |
| data.issueCompanyNo | 발급사코드 (공통코드 참조) | O |
| data.acqCompanyNo | 매입사코드 | O |
| data.payType | 결제타입 (취소 시 필요) | O (필수) |

---

## 2. 결제 취소

### 2-1. 전액 취소

```
POST https://relay.mainpay.co.kr/v1/api/payments/payment/cancel
```

> 주의: HOST가 결제창과 다름!

**요청 파라미터 (*필수)**

| 변수명 | 설명 | 최대길이 |
|--------|------|---------|
| mbrNo* | 가맹점번호 | 6 |
| mbrRefNo* | 가맹점주문번호 (새로 생성) | 20 |
| orgRefNo* | 원거래번호 (승인 시 보관한 refNo) | 12 |
| orgTranDate* | 원거래 승인일자 (승인 시 보관한 tranDate) | 6 |
| payType* | 원거래 결제타입 (승인 시 보관한 payType) | 2 |
| paymethod* | 지불수단 (CARD) | 5 |
| amount* | 원거래 금액 | 11 |
| timestamp* | 시스템시각 | 18 |
| signature* | SHA-256 서명값 | 64 |

**응답**

| 변수명 | 설명 |
|--------|------|
| data.refNo | 취소 거래번호 |
| data.tranDate | 취소 거래일자 |
| data.tranTime | 취소 거래시각 |
| data.mbrRefNo | 가맹점주문번호 |

### 2-2. 부분 취소

```
POST https://relay.mainpay.co.kr/v1/api/payments/payment/part-cancel
```

요청/응답은 전액 취소와 동일. `amount`에 부분취소 금액 입력.
부분 취소된 거래는 부분 취소를 통해서만 전액취소 가능.

---

## 3. 공통코드

### 신용카드 발급사 코드 (issueCompanyNo)

| 코드 | 발급사명 |
|------|---------|
| 01 | 비씨카드 |
| 02 | 신한카드 |
| 03 | 삼성카드 |
| 04 | 현대카드 |
| 05 | 롯데카드 |
| 06 | 해외JCB카드 |
| 07 | 국민카드 |
| 08 | 하나카드(구외환) |
| 09 | 해외카드 |
| 11 | 수협카드 |
| 12 | 농협카드 |
| 15 | 씨티카드 |
| 21 | 신한카드 |
| 22 | 제주카드 |
| 23 | 광주카드 |
| 24 | 전북카드 |
| 26 | 신협카드 |
| 27 | 하나카드 |
| 30 | 신세계카드 |
| 31 | 우리카드 |
| 37 | 해외은련카드 |
| 38 | 롯데아멕스 |
| 42 | 해외VISA |
| 43 | 해외MASTER |

---

## 연동 흐름 요약

```
[사용자] -> [가맹점 서버] -> POST /v1/payment/ready -> [PG]
                                                         |
                                            응답: aid, nextPcUrl, nextMobileUrl
                                                         |
[사용자] <- 결제창 팝업/리다이렉트 <-----------------------+
                    |
              카드 인증 완료
                    |
[가맹점 approvalUrl] <- GET ?aid=...&authToken=...&payType=...
                    |
[가맹점 서버] -> POST /v1/payment/pay (aid, authToken, signature...) -> [PG]
                                                                         |
                                            응답: refNo, cardNo, installment,
                                                  issueCompanyNo, applNo 등
                                                         |
                                            DB에 결제 정보 저장
```
