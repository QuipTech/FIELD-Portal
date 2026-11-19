export interface DesignUploadFile {
  file: File;
  path: string;
}

export const selectDesignFiles = (files: FileList): DesignUploadFile[] =>
  Array.from(files, (file) => ({
    file,
    path: file.webkitRelativePath?.split("/").slice(1).join("/") || file.name,
  }));

export async function readDroppedDesignFiles(transfer: DataTransfer): Promise<DesignUploadFile[]> {
  const entries = Array.from(transfer.items)
    .filter((item) => item.kind === "file")
    .map((item) => item.webkitGetAsEntry?.());
  if (!entries.length || entries.some((entry) => !entry)) return selectDesignFiles(transfer.files);

  const files: DesignUploadFile[] = [];
  async function collect(entry: FileSystemEntry, path: string): Promise<void> {
    if (entry.isFile) {
      if (files.length >= 32) throw new Error("A version can contain up to 32 files.");
      const file = await new Promise<File>((resolve, reject) =>
        (entry as FileSystemFileEntry).file(resolve, reject),
      );
      files.push({ file, path: path + entry.name });
      return;
    }
    if (!entry.isDirectory) return;
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    while (true) {
      const children = await new Promise<FileSystemEntry[]>((resolve, reject) =>
        reader.readEntries(resolve, reject),
      );
      if (!children.length) return;
      for (const child of children) {
        await collect(child, `${path}${entry.name}/`);
      }
    }
  }

  const folder = entries.length === 1 && entries[0]?.isDirectory ? entries[0] : null;
  for (const entry of entries) await collect(entry!, "");
  return folder
    ? files.map(({ file, path }) => ({ file, path: path.slice(folder.name.length + 1) }))
    : files;
}

export function designUploadBody(project: string, files: DesignUploadFile[]) {
  if (!project.trim() || !files.length) throw new Error("Enter a project and select at least one file.");
  if (files.length > 32 || files.some(({ file }) => file.size > 5 * 1024 * 1024) ||
      files.reduce((total, { file }) => total + file.size, 0) > 20 * 1024 * 1024) {
    throw new Error("A version can contain 32 files, up to 5 MiB each and 20 MiB total.");
  }
  const body = new FormData();
  body.set("project", project);
  body.set("paths", JSON.stringify(files.map(({ path }) => path)));
  files.forEach(({ file }) => body.append("files", file));
  return body;
}
