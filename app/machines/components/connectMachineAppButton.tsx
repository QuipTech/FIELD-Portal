import type { MouseEvent } from "react";
import { PermissionButton } from "@/components/auth/permissionButton";
import { Icon } from "@/components/icons/icon";
import { PERMISSIONS } from "@/lib/auth/permissionCodes";

interface ConnectMachineAppButtonProps {
  isConnected: boolean;
  onClick: () => void;
}

// The row is a link; these buttons mustn't also open the machine.
export const ConnectMachineAppButton = ({ isConnected, onClick }: ConnectMachineAppButtonProps) => {
  const handleClick = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onClick();
  };
  return (
    <span className="inline-flex flex-none" onClick={(event) => event.preventDefault()}>
      <PermissionButton permission={PERMISSIONS.manageMachine} size="sm" onClick={handleClick}>
        <Icon name={isConnected ? "check" : "cloud"} className="h-3.5 w-3.5" />
        {isConnected ? "Connected" : "Connect app"}
      </PermissionButton>
    </span>
  );
};
