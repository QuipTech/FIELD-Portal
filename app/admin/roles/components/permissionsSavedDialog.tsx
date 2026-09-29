import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/iconTile";

interface PermissionsSavedDialogProps {
  roleName: string;
  grantedCount: number;
  totalCount: number;
  onClose: () => void;
}

// Shown only after the backend confirms the save, so it never claims a
// change that didn't happen.
export const PermissionsSavedDialog = ({ roleName, grantedCount, totalCount, onClose }: PermissionsSavedDialogProps) => {
  return (
    <Modal title="Changes saved" onClose={onClose} widthClassName="w-[400px]">
      <div className="flex flex-col items-center gap-3 p-6 text-center">
        <IconTile icon="check" tone="ok" />
        <span className="text-[15px] font-medium text-ink">Permissions for {roleName} were updated</span>
        <span className="text-sm text-mutedGray">
          {grantedCount} of {totalCount} permissions are now enabled. This change has been recorded in the audit log.
        </span>
        <Button variant="primary" className="mt-2 w-full" onClick={onClose} autoFocus>
          OK
        </Button>
      </div>
    </Modal>
  );
};
