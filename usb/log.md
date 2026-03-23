# useB(유스비) eKYC / API 검토 로그

> 작성일: 2026-03-20

---

## 1. 서비스 개요

useB는 신분증 OCR, 진위확인, 1원 계좌인증, 안면인증, 사본판별 등을 제공하는 eKYC/API 서비스.

- 공식 문서: https://doc.useb.co.kr
- eKYC 연동 가이드: https://docs-ekyc.useb.co.kr
- eKYC 데모: https://kyc-demo.useb.co.kr

---

## 2. 티켓핀 회원가입 플로우 (확정)

| Step | 내용 | 방식 |
|------|------|------|
| 1 | 다날 휴대폰 본인인증 | 기존 구현 (이름, 생년월일, 전화번호 획득) |
| 2 | 신분증 인증 + 계좌 인증 | eKYC iframe 또는 API (미확정) |
| 3 | 아이디/비밀번호/이메일 입력 + 약관동의 | 자체 UI |
| 4 | 회원가입 완료 | 완료 화면 |

- 다날에서 받은 이름/생년월일/전화번호를 eKYC 파라미터로 전달
- email은 더미값 가능 (유스비 담당자 확인)
- 신분증 인증과 계좌 인증은 하나의 eKYC 세션(iframe)에서 연속 진행

---

## 3. eKYC SDK vs API Only 가격 비교 (월 3,000건 기준)

### eKYC SDK (패키지1: 신분증 OCR + 진위확인 + 1원 계좌인증)

| 플랜 | 월 비용 |
|------|---:|
| Standard (1,000건 기본) + 초과 2,000건 x 970원 | 약 2,910,000원 |

### API Only

| 서비스 | 기본료 (1,000건) | 초과 2,000건 | 소계 |
|--------|---:|---:|---:|
| 신분증 OCR | 300,000 | 160,000 | 460,000 |
| 진위확인 | 300,000 | 160,000 | 460,000 |
| 1원 계좌인증 (오픈뱅킹) | 200,000 | 320,000 | 520,000 |
| **합계** | | | **1,440,000** |

### 공통 비용

- 기술지원비: 1,000,000원 (도입 시 1회)
- 보증금: 월 구독료 1회분 (계약 종료 시 반환)
- 약정: 12개월, 중도해지 시 잔여 요금 전액 청구

### 건당 비교

| | eKYC SDK | API Only |
|---|---:|---:|
| 건당 단가 | 약 970원 | 약 480원 |
| 월 비용 | 약 2,910,000원 | 약 1,440,000원 |
| 연간 절감 | - | 약 17,600,000원 |

---

## 4. 경쟁 업체 견적 비교

### 기웅정보통신 (API Only)

| 항목 | 금액 |
|------|---:|
| 도입비 (사본판별 제외) | 2,000,000원 |
| 월 기본료 (사본판별 제외) | 900,000원 |
| 초과 건당: OCR 30원, 진위확인 200원, 1원인증 80원 | 310원/건 |
| 월 3,000건 예상 비용 | 약 1,520,000원 |

### 1년 총비용 비교

| | 유스비 API | 기웅정보통신 | 유스비 eKYC SDK |
|---|---:|---:|---:|
| 초기 비용 | 1,000,000 | 2,000,000 | 1,000,000 |
| 월 비용 x 12 | 17,280,000 | 18,240,000 | 34,920,000 |
| 1년 총액 | 약 18,280,000 | 약 20,240,000 | 약 35,920,000 |

### 기타 업체 (견적 미수신)

- 알체라: eKYC 솔루션 제공, 가격 비공개 (문의 필요)
- 컴트루(aiDee): eKYC 솔루션 제공, 가격 비공개 (문의 필요)
- 쿠콘: API 상품 (신분증 진위확인, 1원 계좌인증, 신분증 OCR) — 견적 문의 발송

---

## 5. 사본판별 불필요 판단

이미 4중 인증(휴대폰 본인인증 + 신분증 OCR + 진위확인 + 계좌인증)을 하기 때문에 사본판별은 불필요.
진위확인에서 정부DB와 대조하므로 가짜 정보면 걸림. 건당 550원 추가할 이유 없음.

---

## 6. 유스비 담당자 소통 내역

### 담당자: 김세은 매니저

### 1차 문의 답변 (2026-03-18)

1. 웹(PC) 환경 정상 동작 확인. PC에서는 신분증 사진 업로드 기본. QR로 모바일 진행도 가능.
2. eKYC는 iframe 방식으로 임베드.
3. 인증 완료 시 postMessage로 결과 전달.

### 2차 문의 답변 (2026-03-20)

1. eKYC 파라미터 email 포함 필수이나 더미값 가능 (전화번호도 더미 가능).
2. 신분증 인증 + 계좌 인증이 하나의 iframe 세션에서 연속 진행.
3. 최소 계약기간 1년, 이후 자동 갱신.
4. OCR API 호출 시 이미지 전처리는 서버에서 자동.
5. eKYC는 API 성능을 최대치로 끌어올린 UI 포함 통합 솔루션.
6. API만 쓸 경우 개발/QA 리소스 많이 발생, 장애 시 대응 한계.
7. 견적 + 테스트 계정 발급은 차주 초~중 예정.

---

## 7. eKYC 연동 기술 정보 (docs-ekyc.useb.co.kr에서 확인)

### iframe 기본 설정

```html
<iframe id="kyc_iframe" allow="camera" src="https://kyc.useb.co.kr/auth"></iframe>
```

### 인증 방식

| 방식 | 설명 |
|------|------|
| Credential | customer_id, id, key 직접 전달 (테스트용) |
| Access Token | 서버에서 토큰 발급 후 전달 (운영용, 24시간 유효) |

### Access Token 발급

```
POST https://kyc-api.useb.co.kr/sign-in
{ "customer_id": 123, "username": "client_id", "password": "client_secret" }
```

### 파라미터 전달 (JSON -> URI인코딩 -> Base64)

```javascript
const params = {
  access_token: "<access_token>",
  name: "홍길동",
  birthday: "1984-11-23",
  phone_number: "01012345678",
  email: "dummy@ticketpin.kr"
};
const encoded = btoa(encodeURIComponent(JSON.stringify(params)));
document.getElementById("kyc_iframe").contentWindow.postMessage(encoded, "https://kyc.useb.co.kr");
```

### 결과 수신 (Base64 -> URI디코딩 -> JSON파싱)

```javascript
window.addEventListener("message", (e) => {
  const decoded = decodeURIComponent(atob(e.data));
  const json = JSON.parse(decoded);
  // json.result: "success" | "failed" | "complete" | "close"
  // json.review_result.result_type: 1(자동승인) | 2(자동거부) | 5(심사필요)
});
```

### postMessage 결과 데이터

| 필드 | 설명 |
|------|------|
| result | success / failed / complete / close |
| review_result.result_type | 1(자동승인), 2(자동거부), 5(심사필요) |
| review_result.id_card.verified | 진위확인 결과 |
| review_result.id_card.original_ocr_data | OCR 원본 데이터 |
| review_result.account.verified | 계좌인증 결과 |
| review_result.account.finance_company | 은행명 |
| review_result.account.account_number | 계좌번호 |
| review_result.account.account_holder | 예금주명 |

### 결과 수신 방식

| 방식 | 설명 |
|------|------|
| postMessage | 프론트에서 직접 수신 |
| postMessage + API | 서버에서 결과 조회 (보안 강화, reviewer account 필요) |

### HMAC 검증

postMessage 결과의 무결성 검증 가능. 비밀키로 HMAC 재계산 후 비교.

---

## 8. 미결정 사항

- [ ] eKYC SDK vs API Only 최종 결정 (견적 비교 후)
- [ ] 테스트 계정 수령 대기 (차주 초~중)
- [ ] eKYC SDK 사용 시 커스터마이징 범위 확인 (로고, 컬러, 폰트 — 유료)

---

## 9. 참고 파일

| 파일 | 내용 |
|------|------|
| usb/USEB-API.md | useB REST API 연동 가이드 (OCR, 진위확인, 계좌인증 등) |
| usb/useB.API_가격정책_v3.pdf | API Only 가격 정책 |
| usb/useB.eKYC(API+UI)_가격정책_v7.pdf | eKYC SDK 가격 정책 |
| usb/useB.API_서비스 소개서.pdf | API 서비스 소개 |
| usb/useB.eKYC 솔루션 소개서.pdf | eKYC 솔루션 소개 |
| docs/TASKS-USEB.md | useB API 연동 태스크 목록 (API 방식 기준, eKYC로 변경 시 수정 필요) |
