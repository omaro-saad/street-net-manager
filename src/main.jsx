// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App.jsx";
import "./index.css";
import { DataProvider } from "./DataContext.jsx";
import { AuthProvider } from "./contexts/AuthContext.jsx";
import { AlertProvider } from "./contexts/AlertContext.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HashRouter>
      <AuthProvider>
        <DataProvider>
          <AlertProvider>
            <App />
          </AlertProvider>
        </DataProvider>
      </AuthProvider>
    </HashRouter>
  </React.StrictMode>
);
