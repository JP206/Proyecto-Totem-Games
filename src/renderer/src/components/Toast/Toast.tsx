import React from "react";
import { CheckCircle, AlertCircle, AlertTriangle } from "lucide-react";
import type { NotificationState } from "../../hooks/useNotification";
import "./Toast.css";

export interface ToastProps {
  notification: NotificationState | null;
  className?: string;
}

const Toast: React.FC<ToastProps> = ({ notification, className = "" }) => {
  if (!notification) return null;
  const { type, message } = notification;
  return (
    <div className={`app-toast ${type} ${className}`.trim()} role="alert">
      {type === "success" && <CheckCircle size={18} aria-hidden />}
      {type === "error" && <AlertCircle size={18} aria-hidden />}
      {type === "warning" && <AlertTriangle size={18} aria-hidden />}
      <span>{message}</span>
    </div>
  );
};

export default Toast;
