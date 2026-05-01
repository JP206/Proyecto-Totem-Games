import { useState, useCallback, useRef, useEffect } from "react";

export type NotificationType = "success" | "error" | "warning";

export interface NotificationState {
  type: NotificationType;
  message: string;
}

const DEFAULT_DURATION_MS = 3000;

export function useNotification(durationMs: number = DEFAULT_DURATION_MS) {
  const [notification, setNotification] = useState<NotificationState | null>(
    null,
  );
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setNotification(null);
  }, []);

  const showNotification = useCallback(
    (type: NotificationType, message: string) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      setNotification({ type, message });
      timerRef.current = setTimeout(() => {
        setNotification(null);
        timerRef.current = null;
      }, durationMs);
    },
    [durationMs],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { notification, showNotification, dismiss, setNotification };
}
