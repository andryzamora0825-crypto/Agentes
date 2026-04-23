import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  '/',
  '/invite(.*)',               // Landing de invitaciones VIP debe ser pública
  '/api/whatsapp/webhook(.*)',  // Green-API necesita acceder sin autenticación
  '/api/cron(.*)',              // Crons de Vercel — protegidos vía CRON_SECRET dentro del route
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/sso-callback(.*)',          // Clerk OAuth redirect callbacks
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
