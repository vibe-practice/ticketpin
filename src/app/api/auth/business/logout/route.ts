import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUSINESS_SESSION_COOKIE } from "@/lib/business/auth";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(BUSINESS_SESSION_COOKIE)?.value;

    // DB에서 세션 삭제
    if (sessionToken) {
      const adminClient = createAdminClient();
      await adminClient
        .from("business_sessions")
        .delete()
        .eq("token", sessionToken);
    }

    // 쿠키 삭제
    const response = NextResponse.json(
      { success: true },
      { status: 200 }
    );

    response.cookies.set(BUSINESS_SESSION_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "서버 오류가 발생했습니다.",
        },
      },
      { status: 500 }
    );
  }
}
