import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@understood/design-tokens";
import WorkerPortal from "./WorkerPortal";
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WorkerPortal />
  </StrictMode>,
);
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker
      .register("/i/sw.js", { scope: "/i/" })
      .catch(() => undefined);
  });
}
