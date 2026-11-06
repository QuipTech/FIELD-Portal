// Draws a Word file into `target`, loading the library only when one is opened.
// Images stay inline, so they also work inside the viewer's sandboxed frame.
export const renderDocx = async (file: Blob, target: HTMLElement, styleTarget: HTMLElement): Promise<void> => {
  const { renderAsync } = await import("docx-preview");
  await renderAsync(file, target, styleTarget, { useBase64URL: true, inWrapper: true });
};
