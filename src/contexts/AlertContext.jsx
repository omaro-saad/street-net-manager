/**
 * Global in-app alert system: permission, validation, plan limit, error, success, confirm (delete).
 * Use instead of browser alert()/confirm() everywhere.
 */
import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import InAppAlert from "../components/InAppAlert.jsx";

const AlertContext = createContext(null);

export function AlertProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [variant, setVariant] = useState(null);
  const [message, setMessage] = useState("");
  const [fieldName, setFieldName] = useState("");
  const [confirmLabel, setConfirmLabel] = useState("حذف");
  const confirmCallbackRef = useRef(null);

  const closeAlert = useCallback(() => {
    setOpen(false);
    setVariant(null);
    setMessage("");
    setFieldName("");
    setConfirmLabel("حذف");
    confirmCallbackRef.current = null;
  }, []);

  const showPlanLimitAlert = useCallback(() => {
    setVariant("planLimit");
    setMessage("");
    setFieldName("");
    setOpen(true);
  }, []);

  const showReadOnlyAlert = useCallback(() => {
    setVariant("readOnly");
    setMessage("");
    setFieldName("");
    setOpen(true);
  }, []);

  /** Validation error: required field or invalid value. Optionally pass field name for clarity. */
  const showValidationAlert = useCallback((msg, field = "") => {
    setVariant("validation");
    setMessage(typeof msg === "string" ? msg : "");
    setFieldName(typeof field === "string" ? field : "");
    setOpen(true);
  }, []);

  /** General error: save failed, system not ready, etc. */
  const showErrorAlert = useCallback((msg) => {
    setVariant("error");
    setMessage(typeof msg === "string" ? msg : "حدث خطأ غير متوقع.");
    setFieldName("");
    setOpen(true);
  }, []);

  /** Success feedback (optional, for important confirmations). */
  const showSuccessAlert = useCallback((msg) => {
    setVariant("success");
    setMessage(typeof msg === "string" ? msg : "تمت العملية بنجاح.");
    setFieldName("");
    setOpen(true);
  }, []);

  /** Confirm (e.g. delete): two buttons — cancel and confirm. onConfirm runs when user clicks confirm. */
  const showConfirmAlert = useCallback(({ message: msg, confirmLabel: label = "حذف", onConfirm }) => {
    setVariant("confirm");
    setMessage(typeof msg === "string" ? msg : "هل أنت متأكد؟");
    setFieldName("");
    setConfirmLabel(typeof label === "string" ? label : "حذف");
    confirmCallbackRef.current = typeof onConfirm === "function" ? onConfirm : null;
    setOpen(true);
  }, []);

  const handleConfirm = useCallback(() => {
    const fn = confirmCallbackRef.current;
    closeAlert();
    if (typeof fn === "function") fn();
  }, [closeAlert]);

  const value = {
    showPlanLimitAlert,
    showReadOnlyAlert,
    showValidationAlert,
    showErrorAlert,
    showSuccessAlert,
    showConfirmAlert,
  };

  return (
    <AlertContext.Provider value={value}>
      {children}
      <InAppAlert
        open={open}
        variant={variant}
        message={message}
        fieldName={fieldName}
        confirmLabel={confirmLabel}
        onClose={closeAlert}
        onConfirm={variant === "confirm" ? handleConfirm : undefined}
      />
    </AlertContext.Provider>
  );
}

export function useAlert() {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error("useAlert must be used within AlertProvider.");
  return ctx;
}
