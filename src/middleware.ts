import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { updateSession } from "@/lib/supabase/middleware";
import { getClientIp } from "@/lib/utils/ip";

// 인증이 필요한 경로
const PROTECTED_PATHS = ["/my", "/order"];
// 로그인 상태에서 접근 불가한 경로
const AUTH_PATHS = ["/auth/login", "/auth/register"];

// 관리자 경로 접두사
const ADMIN_PATH_PREFIX = "/adminmaster";
const ADMIN_API_PREFIX = "/api/admin";
const ADMIN_AUTH_API_PREFIX = "/api/auth/admin"; // 로그인/로그아웃 API (IP 체크만, 세션 체크 불필요)
const ADMIN_LOGIN_PATH = "/adminmaster/login";

// 관리자 세션 쿠키 이름 (src/lib/admin/auth.ts와 동일)
const ADMIN_SESSION_COOKIE = "admin_session";

// 업체 경로 접두사
const BUSINESS_PATH_PREFIX = "/business";
const BUSINESS_AUTH_API_PREFIX = "/api/auth/business"; // 업체 인증 API (세션 체크 불필요)
const BUSINESS_API_PREFIX = "/api/business"; // 업체 데이터 API (각 route에서 자체 인증)

// 업체 세션 쿠키 이름 (src/lib/business/auth.ts와 동일)
const BUSINESS_SESSION_COOKIE = "business_session";

/**
 * 업체 경로에서 businessId와 서브 경로 여부를 파싱한다.
 * /business/[businessId] → { businessId, hasSubPath: false }
 * /business/[businessId]/settlements → { businessId, hasSubPath: true }
 */
function parseBusinessPath(pathname: string): {
  businessId: string | null;
  hasSubPath: boolean;
} {
  // /business/[businessId] 이후 경로 추출
  const match = pathname.match(/^\/business\/([^/]+)(\/.*)?$/);
  if (!match) return { businessId: null, hasSubPath: false };
  return {
    businessId: match[1],
    hasSubPath: !!match[2] && match[2] !== "/",
  };
}

/**
 * Edge Runtime 호환 Supabase admin 클라이언트를 생성한다.
 * 미들웨어 내에서 한 번만 생성하여 공유한다.
 */
function createEdgeAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = ReturnType<typeof createClient<any>>;

/**
 * Supabase REST API로 허용된 IP 목록을 조회한다.
 * Edge Runtime 호환 (bcrypt, Node.js crypto 미사용).
 */
async function isIpAllowed(
  supabase: AnySupabaseClient,
  ip: string
): Promise<boolean> {
  // 개발 환경에서는 localhost IP 허용
  if (
    process.env.NODE_ENV === "development" &&
    (ip === "::1" || ip === "127.0.0.1" || ip === "::ffff:127.0.0.1" || ip === "unknown")
  ) {
    return true;
  }

  try {
    const { data, error } = await supabase
      .from("admin_allowed_ips")
      .select("id")
      .eq("ip_address", ip)
      .limit(1);

    if (error) {
      // DB 오류 시 안전하게 차단
      return false;
    }

    return (data?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

/**
 * 업체 세션 토큰이 유효한지 확인한다 (Edge Runtime 호환).
 */
async function isBusinessSessionValid(
  supabase: AnySupabaseClient,
  token: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("business_sessions")
      .select("id, expires_at")
      .eq("token", token)
      .single();

    if (error || !data) return false;

    const row = data as unknown as { id: string; expires_at: string };
    // 만료 체크
    return new Date(row.expires_at) > new Date();
  } catch {
    return false;
  }
}

/**
 * 관리자 세션 토큰이 유효한지 확인한다 (Edge Runtime 호환).
 */
async function isAdminSessionValid(
  supabase: AnySupabaseClient,
  token: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("admin_sessions")
      .select("id, expires_at")
      .eq("token", token)
      .single();

    if (error || !data) return false;

    const row = data as unknown as { id: string; expires_at: string };
    // 만료 체크
    return new Date(row.expires_at) > new Date();
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ─── 업체 API 처리 ──────────────────────────────────────────
  // /api/auth/business/* (인증 API) 및 /api/business/* (데이터 API)는
  // 각 route에서 자체 세션 검증하므로 미들웨어에서는 통과
  if (pathname.startsWith(BUSINESS_AUTH_API_PREFIX) || pathname.startsWith(BUSINESS_API_PREFIX)) {
    return NextResponse.next();
  }

  // ─── 업체 영역 처리 ──────────────────────────────────────────
  // /business/[businessId]/* 경로 감지
  if (pathname.startsWith(BUSINESS_PATH_PREFIX)) {
    const { businessId, hasSubPath } = parseBusinessPath(pathname);

    // /business 자체 경로는 통과 (businessId 없음)
    if (!businessId) {
      return NextResponse.next();
    }

    // /business/[businessId] 루트 경로는 통과 (로그인/SMS 인증 UI가 위치)
    if (!hasSubPath) {
      return NextResponse.next();
    }

    // 서브 경로 (settlements, gifts, info, logs 등)는 세션 DB 유효성 검증
    const sessionToken = request.cookies.get(BUSINESS_SESSION_COOKIE)?.value;
    if (!sessionToken) {
      // 세션 없으면 업체 루트(로그인 페이지)로 리다이렉트
      return NextResponse.redirect(
        new URL(`/business/${businessId}`, request.url)
      );
    }

    // DB에서 세션 유효성 + 만료 체크
    const supabaseForBusiness = createEdgeAdminClient();
    const businessSessionValid = await isBusinessSessionValid(supabaseForBusiness, sessionToken);
    if (!businessSessionValid) {
      // 만료/무효 세션 쿠키 삭제 후 업체 루트로 리다이렉트
      const redirectResponse = NextResponse.redirect(
        new URL(`/business/${businessId}`, request.url)
      );
      redirectResponse.cookies.set(BUSINESS_SESSION_COOKIE, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 0,
      });
      return redirectResponse;
    }

    return NextResponse.next();
  }

  // ─── 관리자 영역 처리 ──────────────────────────────────────────
  const isAdminPage = pathname.startsWith(ADMIN_PATH_PREFIX);
  const isAdminApi = pathname.startsWith(ADMIN_API_PREFIX);
  const isAdminAuthApi = pathname.startsWith(ADMIN_AUTH_API_PREFIX);

  if (isAdminPage || isAdminApi || isAdminAuthApi) {
    const clientIp = getClientIp(request.headers);

    // Supabase 클라이언트를 한 번만 생성하여 공유
    const supabase = createEdgeAdminClient();

    // 1. IP 허용 여부 확인
    const ipAllowed = await isIpAllowed(supabase, clientIp);
    if (!ipAllowed) {
      if (isAdminApi || isAdminAuthApi) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "IP_FORBIDDEN",
              message: "허용되지 않은 IP에서의 접근입니다.",
            },
          },
          { status: 403 }
        );
      }
      return new NextResponse("접근이 거부되었습니다.", { status: 403 });
    }

    // 2. 관리자 인증 API (login/logout)는 세션 체크 불필요
    if (isAdminAuthApi) {
      return NextResponse.next();
    }

    // 3. 로그인 페이지는 세션 체크 불필요
    if (pathname === ADMIN_LOGIN_PATH) {
      // 이미 로그인되어 있으면 대시보드로 리다이렉트
      const sessionToken = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
      if (sessionToken) {
        const valid = await isAdminSessionValid(supabase, sessionToken);
        if (valid) {
          return NextResponse.redirect(new URL("/adminmaster", request.url));
        }
      }
      return NextResponse.next();
    }

    // 4. 관리자 세션 체크
    const sessionToken = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    if (!sessionToken) {
      if (isAdminApi) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "ADMIN_UNAUTHORIZED",
              message: "관리자 로그인이 필요합니다.",
            },
          },
          { status: 401 }
        );
      }
      return NextResponse.redirect(
        new URL(ADMIN_LOGIN_PATH, request.url)
      );
    }

    const sessionValid = await isAdminSessionValid(supabase, sessionToken);
    if (!sessionValid) {
      if (isAdminApi) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "ADMIN_SESSION_EXPIRED",
              message: "세션이 만료되었습니다. 다시 로그인해 주세요.",
            },
          },
          { status: 401 }
        );
      }
      // 만료된 세션 쿠키 삭제 후 로그인 페이지로
      const loginRedirect = NextResponse.redirect(
        new URL(ADMIN_LOGIN_PATH, request.url)
      );
      loginRedirect.cookies.set(ADMIN_SESSION_COOKIE, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 0,
      });
      return loginRedirect;
    }

    return NextResponse.next();
  }

  // ─── 사용자 영역 처리 (기존 로직) ─────────────────────────────
  // 세션 갱신 (쿠키 리프레시)
  const response = await updateSession(request);

  // 인증 상태 확인 (쿠키에서 Supabase 세션 토큰 존재 여부)
  const hasSession = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.endsWith("-auth-token"));

  // 보호된 경로: 미인증 시 로그인 페이지로 리다이렉트
  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p));
  if (isProtected && !hasSession) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 계정 상태 확인은 AuthProvider + /api/auth/me에서 처리
  // (미들웨어에서 쿠키 직접 파싱은 청크 분할 쿠키 등으로 불안정)

  // 인증 경로: 로그인 상태에서 접근 시 메인으로 리다이렉트
  if (AUTH_PATHS.some((p) => pathname.startsWith(p)) && hasSession) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
