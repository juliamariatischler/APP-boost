import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";
import App from "./App.tsx";
import { StartupError } from "./components/StartupError.tsx";
import "./index.css";

if (!Capacitor.isNativePlatform() && "serviceWorker" in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    });
  } else {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => {
        registrations.forEach((registration) => {
          void registration.unregister();
        });
      })
      .catch(() => {});
  }
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Missing root element");
}

const hideSplash = () => {
  if (Capacitor.isNativePlatform()) {
    void SplashScreen.hide({ fadeOutDuration: 200 });
  }
};

try {
  const root = createRoot(rootElement);
  root.render(<App />);
  // Hide splash once React has painted the first frame
  requestAnimationFrame(() => requestAnimationFrame(hideSplash));
} catch (error) {
  createRoot(rootElement).render(<StartupError error={error} />);
  hideSplash();
}
