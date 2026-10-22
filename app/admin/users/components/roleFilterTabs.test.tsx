import { useState } from "react";
import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RoleFilterTabs } from "./roleFilterTabs";

const Example = () => {
  const [value, setValue] = useState("");
  return <RoleFilterTabs value={value} roleNames={["Customer", "Owner"]} panelId="users" onChange={setValue} />;
};

afterEach(cleanup);

describe("role filter tabs", () => {
  it("selects a role and returns to all users", () => {
    render(<Example />);
    fireEvent.click(screen.getByRole("tab", { name: "Owner" }));
    expect(screen.getByRole("tab", { selected: true }).textContent).toBe("Owner");
    fireEvent.click(screen.getByRole("tab", { name: "All" }));
    expect(screen.getByRole("tab", { selected: true }).textContent).toBe("All");
  });

  it("supports arrow keys, Home and End with a single keyboard focus stop", () => {
    // jsdom has no layout or native scrollIntoView implementation.
    HTMLElement.prototype.scrollIntoView = () => {};
    render(<Example />);
    const all = screen.getByRole("tab", { name: "All" });
    fireEvent.keyDown(all, { key: "ArrowLeft" });
    const owner = screen.getByRole("tab", { name: "Owner" });
    expect(document.activeElement).toBe(owner);
    expect(owner.getAttribute("aria-selected")).toBe("true");
    expect(all.tabIndex).toBe(-1);
    fireEvent.keyDown(owner, { key: "Home" });
    expect(document.activeElement).toBe(all);
    fireEvent.keyDown(all, { key: "ArrowRight" });
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Customer" }));
    fireEvent.keyDown(document.activeElement!, { key: "End" });
    expect(document.activeElement).toBe(owner);
    expect(owner.getAttribute("aria-controls")).toBe("users");
  });
});
