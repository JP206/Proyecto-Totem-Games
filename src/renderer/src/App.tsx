// src/renderer/src/App.tsx
import React, { useEffect } from "react";
import {
  HashRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { injectTheme } from "./theme";
import Login from "./features/login";
import Dashboard from "./features/dashboard";
import Landing from "./features/landing";
import TranslationPreview from "./features/translation-preview";
import Issues from "./features/issues";
import Notes from "./features/notes";
import Changes from "./features/change-history";
import ContextsGlossaries from "./features/contexts-glossaries";
import Profile from "./features/profile";
import Users from "./features/users";
import Projects from "./features/projects";

function App() {
  useEffect(() => {
    injectTheme();
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/login" />} />

        <Route path="/login" element={<Login />} />

        <Route path="/dashboard" element={<Dashboard />} />

        <Route path="/landing" element={<Landing />} />

        <Route path="/translation-preview" element={<TranslationPreview />} />

        <Route path="/issues" element={<Issues />} />

        <Route path="/notes" element={<Notes />} />

        <Route path="/changes" element={<Changes />} />

        <Route path="/contexts-glossaries" element={<ContextsGlossaries />} />

        <Route path="/profile" element={<Profile />} />

        <Route path="/users" element={<Users />} />

        <Route path="/projects" element={<Projects />} />
      </Routes>
    </Router>
  );
}

export default App;
