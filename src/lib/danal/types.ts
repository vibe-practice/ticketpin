// ============================================================
// 다날 본인인증 (T-PAY UAS) 타입 정의
// ============================================================

/** Ready 요청 파라미터 */
export interface DanalReadyParams {
  TXTYPE: "ITEMSEND";
  SERVICE: "UAS";
  AUTHTYPE: string; // "36" = SMS 인증
  CPID: string;
  CPPWD: string;
  TARGETURL: string;
  CHARSET: string;
  ORDERID: string;
}

/** Ready 응답 필드 (파싱 후) */
export interface DanalReadyResponse {
  RETURNCODE: string;
  RETURNMSG: string;
  TID?: string;
  // form submit에 필요한 hidden 필드들
  [key: string]: string | undefined;
}

/** Confirm 요청 파라미터 */
export interface DanalConfirmParams {
  TXTYPE: "CONFIRM";
  TID: string;
  CONFIRMOPTION: "0";
  IDENOPTION: "0";
}

/** Confirm 응답 필드 (파싱 후) */
export interface DanalConfirmResponse {
  RETURNCODE: string;
  RETURNMSG: string;
  NAME?: string;
  PHONE?: string;
  IDEN?: string; // 생년월일6자리 + 성별1자리
  CI?: string; // 연계정보
  DI?: string; // 중복확인정보
}

/** 인증 세션 데이터 (서버 인메모리) */
export interface IdentitySession {
  tid: string;
  createdAt: number;
  confirmed: boolean;
  result?: {
    name: string;
    phone: string;
  };
}

/** Ready API 응답 (프론트엔드에 전달) */
export interface IdentityReadyApiResponse {
  success: boolean;
  data?: {
    sessionId: string;
    tid: string;
    formAction: string;
    formFields: Record<string, string>;
  };
  error?: {
    code: string;
    message: string;
  };
}

/** Result API 응답 (프론트엔드에 전달) */
export interface IdentityResultApiResponse {
  success: boolean;
  data?: {
    name: string;
    phone: string;
    verified: boolean;
    existingUsername?: string; // 이미 가입된 계정의 아이디 (회원가입 시)
    username?: string; // 인증된 사용자의 아이디 (비밀번호 재설정 시)
    resetToken?: string; // 비밀번호 재설정용 일회용 토큰
  };
  error?: {
    code: string;
    message: string;
  };
}
