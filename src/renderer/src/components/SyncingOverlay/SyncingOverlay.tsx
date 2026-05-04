import React from "react";
import "./SyncingOverlay.css";

export interface SyncingOverlayProps {
  visible: boolean;
  message?: string;
}

const SyncingOverlay: React.FC<SyncingOverlayProps> = ({
  visible,
  message = "Guardando cambios...",
}) => {
  if (!visible) return null;
  return (
    <div className="app-syncing-overlay" role="presentation">
      <div className="app-syncing-content">
        <div className="app-syncing-spinner" />
        <p>{message}</p>
      </div>
    </div>
  );
};

export default SyncingOverlay;
