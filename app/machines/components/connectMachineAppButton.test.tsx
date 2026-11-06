import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConnectMachineAppButton } from "./connectMachineAppButton";

vi.mock("@/lib/auth/usePermissions", () => ({ usePermissions: () => ({ isLoaded: true, can: () => true }) }));

afterEach(cleanup);

describe("ConnectMachineAppButton", () => {
  it("runs its action without following the row's link", () => {
    const onClick = vi.fn();
    render(
      <a href="/machines/1">
        <ConnectMachineAppButton isConnected={false} onClick={onClick} />
      </a>,
    );
    // fireEvent returns false when the click's default action was cancelled.
    expect(fireEvent.click(screen.getByRole("button", { name: "Connect app" }))).toBe(false);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("says Connected once the machine has paired", () => {
    render(<ConnectMachineAppButton isConnected onClick={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Connected" })).toBeTruthy();
  });
});
