import React, { useEffect } from "react";
import {
  HashRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Issues from "./pages/Issues";
import { injectTheme } from "./theme";

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

        {/* Ruta para Issues */}
        <Route path="/issues" element={ < Issues /> } />
      </Routes>
    </Router>
  );
}

export default App;
