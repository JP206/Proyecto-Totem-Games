import React from "react";
import Modal from "../Modal/Modal";
import "./ConfirmDialog.css";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
  busy?: boolean;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  onConfirm,
  onCancel,
  destructive = false,
  busy = false,
}) => {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      hideCloseButton
      contentClassName="confirm-dialog-modal"
      footer={
        <>
          <button
            type="button"
            className="confirm-dialog-btn secondary"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`confirm-dialog-btn ${destructive ? "destructive" : "primary"}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="confirm-dialog-message">{message}</div>
    </Modal>
  );
};

export default ConfirmDialog;
