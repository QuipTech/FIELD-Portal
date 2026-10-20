import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KnowledgeClassificationFields } from "./knowledgeClassificationFields";
import { listKnowledgeCategoriesRequest } from "@/lib/api/knowledgeBrandsApi";

vi.mock("@/lib/api/requireAccessToken", () => ({ requireAccessToken: () => "test-token" }));
vi.mock("@/lib/api/knowledgeBrandsApi", () => ({
  listKnowledgeBrandsRequest: vi.fn(async () => [
    { id: "cat", name: "Caterpillar", documentCount: 1 },
    { id: "komatsu", name: "Komatsu", documentCount: 2 },
  ]),
  listKnowledgeCategoriesRequest: vi.fn(async (_token: string, brandId: string) => [
    { id: `${brandId}-folder`, brandId, name: "Maintenance", parentId: null, slug: "maintenance", sortOrder: 0 },
  ]),
}));
const Example = () => {
  const [value, setValue] = useState({ brandId: "cat", categoryId: "cat-folder" });
  return <KnowledgeClassificationFields value={value} onChange={setValue} required />;
};
afterEach(cleanup);
describe("Knowledge classification controls", () => {
  it("clears the old category when a different brand is selected", async () => {
    render(<Example />);
    await screen.findByRole("option", { name: "Maintenance" });
    expect((screen.getByLabelText("Category") as HTMLSelectElement).value).toBe("cat-folder");
    fireEvent.change(screen.getByLabelText("Brand"), { target: { value: "komatsu" } });
    await waitFor(() => expect(listKnowledgeCategoriesRequest).toHaveBeenCalledWith("test-token", "komatsu"));
    expect((screen.getByLabelText("Category") as HTMLSelectElement).value).toBe("");
    expect(screen.queryByRole("option", { name: "Maintenance" })?.getAttribute("value")).not.toBe("cat-folder");
    expect((screen.getByLabelText("Category") as HTMLSelectElement).required).toBe(true);
  });
});
