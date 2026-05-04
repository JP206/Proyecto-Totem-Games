import React from "react";
import { Loader2, AlertCircle, CheckCircle, AlertTriangle } from "lucide-react";
import "./InlineBanner.css";

export type InlineBannerVariant = "info" | "success" | "warning" | "error";

export interface InlineBannerProps {
  message: React.ReactNode;
  variant?: InlineBannerVariant;
  loading?: boolean;
  className?: string;
}

const InlineBanner: React.FC<InlineBannerProps> = ({
  message,
  variant = "info",
  loading = false,
  className = "",
}) => {
  const icon = loading ? (
    <Loader2 size={16} className="app-inline-banner-spin" />
  ) : variant === "success" ? (
    <CheckCircle size={16} />
  ) : variant === "warning" ? (
    <AlertTriangle size={16} />
  ) : variant === "error" ? (
    <AlertCircle size={16} />
  ) : (
    <AlertCircle size={16} />
  );

  return (
    <div className={`app-inline-banner app-inline-banner--${variant} ${className}`.trim()}>
      <span className="app-inline-banner-icon">{icon}</span>
      <span className="app-inline-banner-message">{message}</span>
    </div>
  );
};

export default InlineBanner;
