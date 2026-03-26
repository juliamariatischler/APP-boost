import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { StartupError } from "./components/StartupError.tsx";
import "./index.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Missing root element");
}

try {
  createRoot(rootElement).render(<App />);
} catch (error) {
  createRoot(rootElement).render(<StartupError error={error} />);
}
