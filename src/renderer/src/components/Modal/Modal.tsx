import React from "react";
import { X } from "lucide-react";
import "./Modal.css";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  overlayClassName?: string;
  contentClassName?: string;
  hideCloseButton?: boolean;
}

const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  children,
  footer,
  className = "",
  overlayClassName = "",
  contentClassName = "",
  hideCloseButton = false,
}) => {
  if (!open) return null;
  return (
    <div
      className={`app-modal-overlay ${overlayClassName}`.trim()}
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`app-modal ${className} ${contentClassName}`.trim()}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {(title || !hideCloseButton) && (
          <div className="app-modal-header">
            {title && <div className="app-modal-title">{title}</div>}
            {!hideCloseButton && (
              <button
                type="button"
                className="app-modal-close"
                onClick={onClose}
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}
        <div className="app-modal-body">{children}</div>
        {footer && <div className="app-modal-footer">{footer}</div>}
      </div>
    </div>
  );
};

export default Modal;
