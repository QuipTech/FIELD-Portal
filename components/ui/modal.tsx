import type { ReactNode } from "react";
import { Icon } from "../icons/icon";

interface ModalProps {
  title: string;
  children: ReactNode;
  // Omit to make the modal non-dismissable (e.g. a required step).
  onClose?: () => void;
  widthClassName?: string;
}

export const Modal = ({ title, children, onClose, widthClassName = "w-[440px]" }: ModalProps) => {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-inkStatic/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`flex max-h-[90vh] max-w-full flex-col overflow-y-auto rounded-2xl bg-surface ${widthClassName}`}
      >
        <div className="flex h-14 flex-none items-center border-b border-borderGray px-4">
          <span className="text-[15px] font-medium text-ink">{title}</span>
          {onClose && (
            <button type="button" aria-label="Close" onClick={onClose} className="ml-auto text-bodyGray">
              <Icon name="x" />
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
};
