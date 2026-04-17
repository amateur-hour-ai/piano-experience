import { defaultCache } from "@serwist/next/worker";
import { Serwist, NetworkFirst, CacheFirst } from "serwist";

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Cache page navigations (HTML) with NetworkFirst
    // This ensures dynamic routes like /piece/[id] are cached on first visit
    {
      matcher: ({ request }) => request.mode === "navigate",
      handler: new NetworkFirst({
        cacheName: "pages-cache",
        networkTimeoutSeconds: 5,
      }),
    },
    // Cache Next.js RSC data requests
    {
      matcher: ({ request }) =>
        request.headers.get("RSC") === "1" ||
        request.headers.get("Next-Router-State-Tree") != null,
      handler: new NetworkFirst({
        cacheName: "rsc-cache",
        networkTimeoutSeconds: 5,
      }),
    },
    // Include the default caching rules from serwist
    ...defaultCache,
  ],
});

serwist.addEventListeners();
