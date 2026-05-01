import React from "react";
import "./Button.css";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "success";

export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leftIcon?: React.ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  children,
  className = "",
  variant = "secondary",
  size = "md",
  leftIcon,
  loading = false,
  fullWidth = false,
  disabled,
  type = "button",
  ...props
}) => {
  return (
    <button
      type={type}
      className={[
        "app-button",
        `app-button--${variant}`,
        `app-button--${size}`,
        fullWidth ? "app-button--full-width" : "",
        loading ? "app-button--loading" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="app-button-spinner" aria-hidden />
      ) : (
        leftIcon ? <span className="app-button-icon">{leftIcon}</span> : null
      )}
      <span className="app-button-label">{children}</span>
    </button>
  );
};

export default Button;
