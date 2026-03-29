import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://0929d0c802c2cb0bac99ae010a5c5352@o4511125729116160.ingest.us.sentry.io/4511125772828672",
  tracesSampleRate: 1.0,
});
