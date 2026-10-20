import "./assets/css/main.css";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import StyleGallery from "./gallery/StyleGallery";
import { initializeUiPreferences } from "./pages/settings/SettingsPage";

initializeUiPreferences();

const params = new URLSearchParams(window.location.search);
const isGalleryMode = params.get("gallery") === "1";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {isGalleryMode ? <StyleGallery /> : <App />}
  </React.StrictMode>
);
