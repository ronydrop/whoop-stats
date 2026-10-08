import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/acesso-negado", "/__clerk(.*)"]);

export default clerkMiddleware(async (auth, request) => {
  if (isPublicRoute(request)) return;
  const session = await auth();
  if (!session.userId && request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ message: "Autenticação necessária." }, { status: 401 });
  }
  await auth.protect();
}, () => ({ authorizedParties: [process.env.WHOOP_APP_ORIGIN ?? ""] }));

export const config = {
  matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)", "/(api|trpc)(.*)", "/__clerk/:path*"],
};
