import React from "react";
import "./LoadingState.css";

export interface LoadingStateProps {
  message?: string;
  className?: string;
  fullPage?: boolean;
}

const LoadingState: React.FC<LoadingStateProps> = ({
  message = "Cargando...",
  className = "",
  fullPage = false,
}) => {
  return (
    <div
      className={`app-loading-state ${fullPage ? "full-page" : ""} ${className}`.trim()}
      role="status"
      aria-live="polite"
    >
      <div className="app-spinner-large" />
      {message ? <p>{message}</p> : null}
    </div>
  );
};

export default LoadingState;
