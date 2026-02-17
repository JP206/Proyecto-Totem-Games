// src/renderer/src/App.tsx
import React, { useEffect } from "react";
import {
  HashRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { injectTheme } from "./theme";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Landing from "./pages/Landing";
import Issues from "./pages/Issues";
import Notes from "./pages/Notes";

function App() {
  useEffect(() => {
    injectTheme();
  }, []);

  return (
    <Router>
      <Routes>
        {/* Por defecto va a Login */}
        <Route path="/" element={<Navigate to="/login" />} />

        {/* Ruta para Login */}
        <Route path="/login" element={<Login />} />

        {/* Ruta para Dashboard */}
        <Route path="/dashboard" element={<Dashboard />} />
        
        {/* Ruta para Landing de un proyecto */}
        <Route path="/landing" element={<Landing />} />

        {/* Ruta para Issues */}
        <Route path="/issues" element={ < Issues /> } />

        {/* Ruta para Notes */}
        <Route path="/notes" element={ < Notes /> } />
      </Routes>
    </Router>
  );
}

export default App;
