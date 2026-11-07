import { cleanup, createEvent, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MachineRowPhotos } from "./machineRowPhotos";

afterEach(cleanup);

const machine = { label: "ABC-01" };
const image = () => screen.getByRole("img") as HTMLImageElement;

describe("a machine row's photos", () => {
  it("shows a placeholder without photos", () => {
    const { container } = render(<MachineRowPhotos machine={{ ...machine, photoUrl: null, photoUrls: [] }} />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows one photo with no arrows, including an inactive machine's single photoUrl", () => {
    render(<MachineRowPhotos machine={{ ...machine, photoUrl: "https://signed/a", photoUrls: [] }} />);
    expect(image().src).toBe("https://signed/a");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("slides through several photos, wrapping at both ends", () => {
    render(<MachineRowPhotos machine={{ ...machine, photoUrl: "https://signed/a", photoUrls: ["https://signed/a", "https://signed/b"] }} />);
    expect(screen.getByText("1/2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Next photo of ABC-01" }));
    expect(image().src).toBe("https://signed/b");
    fireEvent.click(screen.getByRole("button", { name: "Next photo of ABC-01" }));
    expect(image().src).toBe("https://signed/a");
    fireEvent.click(screen.getByRole("button", { name: "Previous photo of ABC-01" }));
    expect(image().src).toBe("https://signed/b");
  });

  it("doesn't open the machine when an arrow is clicked", () => {
    const onRowClick = vi.fn();
    render(
      <a href="/machines/m1" onClick={onRowClick}>
        <MachineRowPhotos machine={{ ...machine, photoUrls: ["https://signed/a", "https://signed/b"] }} />
      </a>,
    );
    const next = screen.getByRole("button", { name: "Next photo of ABC-01" });
    const click = createEvent.click(next);
    fireEvent(next, click);
    expect(click.defaultPrevented).toBe(true);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("falls back to the placeholder when a photo won't load", () => {
    const { container } = render(<MachineRowPhotos machine={{ ...machine, photoUrl: "https://signed/a.heic" }} />);
    fireEvent.error(image());
    expect(container.querySelector("img")).toBeNull();
  });
});
