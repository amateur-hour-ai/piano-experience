import { defaultCache } from "@serwist/next/worker";
import { Serwist, NetworkFirst } from "serwist";

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Cache all page requests (navigation AND fetch) with NetworkFirst
    // Matches page URLs: not API, not _next/static, not files with extensions
    {
      matcher: ({ request, url }) => {
        if (request.method !== "GET") return false;
        if (url.pathname.startsWith("/api/")) return false;
        if (url.pathname.startsWith("/_next/static")) return false;
        if (url.pathname.startsWith("/_next/image")) return false;
        // Match page navigations, RSC requests, and prefetch requests
        return request.mode === "navigate" ||
          request.headers.get("RSC") === "1" ||
          request.headers.get("Next-Router-State-Tree") != null ||
          (!url.pathname.includes(".") && !url.pathname.startsWith("/_next/"));
      },
      handler: new NetworkFirst({
        cacheName: "pages-cache",
        networkTimeoutSeconds: 5,
      }),
    },
    // Include the default caching rules
    ...defaultCache,
  ],
});

serwist.addEventListeners();
