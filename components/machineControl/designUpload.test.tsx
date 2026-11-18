import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { uploadDesign } from "@/lib/api/machineDesignApi";
import { DesignUpload } from "./designUpload";

vi.mock("@/lib/api/requireAccessToken", () => ({ requireAccessToken: () => "portal-token" }));
vi.mock("@/lib/api/machineDesignApi", () => ({ uploadDesign: vi.fn() }));

it("uploads individually selected PDF and Word files with their original names", async () => {
  const onUploaded = vi.fn();
  render(<DesignUpload onUploaded={onUploaded} />);
  fireEvent.change(screen.getByLabelText("Project name"), { target: { value: "North Pit" } });

  const filePicker = screen.getByLabelText("Select files");
  const chooseFiles = vi.spyOn(filePicker, "click");
  expect(filePicker.hasAttribute("webkitdirectory")).toBe(false);
  expect(screen.getByLabelText("Select a folder").hasAttribute("webkitdirectory")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Choose files" }));
  expect(chooseFiles).toHaveBeenCalledOnce();
  fireEvent.change(filePicker, {
    target: { files: [new File(["pdf"], "survey.pdf"), new File(["doc"], "notes.docx")] },
  });

  expect(screen.getByText("survey.pdf")).toBeTruthy();
  expect(screen.getByText("notes.docx")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Upload version" }));

  await waitFor(() => expect(onUploaded).toHaveBeenCalledOnce());
  const [token, body] = vi.mocked(uploadDesign).mock.calls[0];
  expect(token).toBe("portal-token");
  expect(body.get("project")).toBe("North Pit");
  expect(body.get("paths")).toBe('["survey.pdf","notes.docx"]');
  expect(body.getAll("files").map((file) => (file as File).name)).toEqual(["survey.pdf", "notes.docx"]);
});
