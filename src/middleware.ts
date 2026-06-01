import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/api/") && req.nextUrl.pathname !== "/api/ws") {
    const secret = process.env.INTERNAL_API_TOKEN?.trim();
    if (!secret) {
      if (process.env.NODE_ENV === "production") {
        return new NextResponse("Service unavailable", { status: 503 });
      }
      return NextResponse.next();
    }

    const token = req.headers.get("x-api-token");
    if (token !== secret) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
