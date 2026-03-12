import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Prevent unhandled promise rejections from freezing the app
window.onunhandledrejection = (event: PromiseRejectionEvent) => {
  console.error("[Unhandled Rejection]", event.reason);
  event.preventDefault();
};

window.onerror = (message, source, lineno, colno, error) => {
  console.error("[Global Error]", { message, source, lineno, colno, error });
  return true; // prevent default browser error overlay
};

createRoot(document.getElementById("root")!).render(<App />);
