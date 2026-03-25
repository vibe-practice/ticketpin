import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "개인정보처리방침 | 티켓매니아",
};

const SECTIONS = [
  {
    title: "1. 개인정보의 수집 항목 및 수집 방법",
    content: `티켓매니아(이하 '회사')는 서비스 제공을 위해 다음과 같은 개인정보를 수집합니다.

가. 필수 수집 항목
· 회원가입 시: 아이디, 비밀번호, 이름, 휴대폰 번호, 이메일
· 본인 인증 시: 이름, 휴대폰 번호, 생년월일, 성별

나. 자동 수집 항목
· 서비스 이용 기록, 접속 로그, IP 주소, 쿠키, 기기 정보

다. 수집 방법
· 회원가입, 서비스 이용, 고객 문의를 통한 직접 수집
· 서비스 이용 과정에서 자동 수집`,
  },
  {
    title: "2. 개인정보의 수집 및 이용 목적",
    content: `회사는 수집한 개인정보를 다음의 목적을 위해 이용합니다.

· 회원 관리: 회원 가입, 본인 확인, 부정 이용 방지
· 서비스 제공: 교환권 구매·관리·선물, 결제 처리, SMS 발송
· 고객 지원: 공지사항 전달, 서비스 관련 안내
· 마케팅 및 광고: 이벤트 정보 제공 (별도 동의 시)
· 서비스 개선: 서비스 이용 통계 분석, 신규 서비스 개발`,
  },
  {
    title: "3. 개인정보의 보유 및 이용 기간",
    content: `회사는 원칙적으로 개인정보 수집 및 이용 목적이 달성된 후에는 해당 정보를 지체 없이 파기합니다. 단, 관계 법령에 의해 보존할 필요가 있는 경우 아래와 같이 보관합니다.

· 계약 또는 청약철회 등에 관한 기록: 5년 (전자상거래 등에서의 소비자보호에 관한 법률)
· 대금결제 및 재화 등의 공급에 관한 기록: 5년 (동법)
· 소비자의 불만 또는 분쟁 처리에 관한 기록: 3년 (동법)
· 접속에 관한 기록: 3개월 (통신비밀보호법)

회원 탈퇴 시 개인정보는 즉시 삭제합니다. 단, 위 법령에 따라 일정 기간 보관이 필요한 정보는 별도 분리 보관 후 기간 경과 시 파기합니다.`,
  },
  {
    title: "4. 개인정보의 제3자 제공",
    content: `회사는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 다만, 다음의 경우에는 예외로 합니다.

· 이용자가 사전에 동의한 경우
· 법령의 규정에 의하거나, 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우

제공 대상 및 목적:
· PG사(결제대행사): 결제 처리 목적으로 이름, 전화번호, 결제 정보 제공
· SMS 발송 업체: 알림 서비스 목적으로 전화번호 제공`,
  },
  {
    title: "5. 개인정보의 처리 위탁",
    content: `회사는 원활한 서비스 제공을 위해 다음과 같이 개인정보 처리 업무를 위탁합니다.

· 결제 처리: PG사 (결제 정보 처리)
· SMS 발송: 알리고 (문자 메시지 발송)

위탁받은 업체는 위탁받은 업무 목적 외에 개인정보를 이용할 수 없으며, 회사는 위탁 업체의 개인정보 관리를 감독합니다.`,
  },
  {
    title: "6. 개인정보의 파기 절차 및 방법",
    content: `가. 파기 절차
이용자가 회원가입 등을 위해 입력한 정보는 목적 달성 후 별도의 DB에 옮겨져 내부 방침 및 관련 법령에 따라 일정 기간 저장된 후 파기됩니다.

나. 파기 방법
· 전자적 파일 형태의 정보: 기록을 재생할 수 없는 기술적 방법을 사용하여 삭제
· 종이에 출력된 개인정보: 분쇄기로 분쇄하거나 소각하여 파기`,
  },
  {
    title: "7. 이용자의 권리와 행사 방법",
    content: `이용자는 언제든지 다음의 개인정보 보호 관련 권리를 행사할 수 있습니다.

· 개인정보 열람 요구
· 오류 등이 있을 경우 정정 요구
· 삭제 요구
· 처리 정지 요구

권리 행사는 마이페이지 또는 고객센터를 통해 할 수 있으며, 회사는 지체 없이 조치합니다.`,
  },
  {
    title: "8. 개인정보의 안전성 확보 조치",
    content: `회사는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다.

· 관리적 조치: 개인정보 보호 담당자 지정, 내부 관리계획 수립, 정기 점검
· 기술적 조치: 개인정보 암호화(AES-256-GCM), 접속 기록 보관, 해킹 등 방지를 위한 보안 시스템 운영
· 물리적 조치: 전산실 및 자료 보관실 접근 통제`,
  },
  {
    title: "9. 개인정보 보호 책임자",
    content: `회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한 이용자의 불만 처리 및 피해 구제 등을 위하여 아래와 같이 개인정보 보호 책임자를 지정하고 있습니다.

· 개인정보 보호 책임자: 개인정보보호팀
· 이메일: privacy@ticketpin.co.kr
· 전화: 고객센터 (평일 09:00 ~ 20:00, 토요일 10:00 ~ 15:00)`,
  },
  {
    title: "10. 개인정보처리방침의 변경",
    content:
      "본 방침은 시행일로부터 적용되며, 법령 및 방침에 따른 변경 내용의 추가, 삭제 및 정정이 있는 경우에는 변경사항 시행 7일 전부터 공지사항을 통해 고지합니다.",
  },
  {
    title: "시행일",
    content: "본 개인정보처리방침은 2026년 3월 1일부터 시행합니다.",
  },
];

export default function PrivacyPage() {
  return (
    <div className="flex flex-1 flex-col bg-background">
      <div className="border-b border-border bg-card">
        <div className="container-main py-8">
          <h1 className="text-2xl font-bold text-foreground">
            개인정보처리방침
          </h1>
          <p className="mt-1 text-[16px] text-muted-foreground">
            시행일: 2026년 3월 1일
          </p>
        </div>
      </div>

      <div className="container-main py-8">
        <div className="max-w-3xl space-y-0">

          {/* 목차 (TOC) */}
          <nav
            aria-label="목차"
            className="mb-8 rounded-xl border border-border bg-card p-6"
          >
            <h2 className="mb-4 text-[16px] font-semibold text-foreground">목차</h2>
            <ol className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {SECTIONS.map((section, i) => (
                <li key={i}>
                  <a
                    href={`#section-${i}`}
                    className="text-[15px] text-muted-foreground hover:text-foreground hover:underline underline-offset-2 transition-colors duration-150"
                  >
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          {/* 섹션 목록 — border-b로 구분 */}
          <div className="divide-y divide-border border-t border-border">
            {SECTIONS.map((section, i) => (
              <div key={i} id={`section-${i}`} className="py-7 scroll-mt-20">
                <h2 className="text-[18px] font-semibold text-foreground">
                  {section.title}
                </h2>
                <p className="mt-3 whitespace-pre-line text-[16px] leading-relaxed text-muted-foreground">
                  {section.content}
                </p>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
