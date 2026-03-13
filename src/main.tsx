import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Log unhandled promise rejections without suppressing them
window.onunhandledrejection = (event: PromiseRejectionEvent) => {
  console.error("[Unhandled Rejection]", event.reason);
};

window.onerror = (message, source, lineno, colno, error) => {
  console.error("[Global Error]", { message, source, lineno, colno, error });
  // Return false so the browser (and any error-tracking tools) still handle it
  return false;
};

createRoot(document.getElementById("root")!).render(<App />);
