import { Buffer } from "buffer";
// Polyfill Buffer for isomorphic-git (uses Node.js Buffer internally)
(window as unknown as Record<string, unknown>).Buffer = Buffer;

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import LandingPage from "./pages/LandingPage";
import "./styles/global.css";
import "katex/dist/katex.min.css";

// Initialize theme before React renders (sets data-theme on <html>)
import "./stores/themeStore";

function Root() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/app" element={<App />} />
      </Routes>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
