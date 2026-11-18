"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uploadDesign, type DesignVersion } from "@/lib/api/machineDesignApi";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { designUploadBody, readDroppedDesignFiles, selectDesignFiles, type DesignUploadFile } from "@/lib/machineControl/designFolder";

export function DesignUpload({ onUploaded }: { onUploaded: (version: DesignVersion) => void }) {
  const filePicker = useRef<HTMLInputElement>(null);
  const folderPicker = useRef<HTMLInputElement>(null);
  const [project, setProject] = useState("");
  const [files, setFiles] = useState<DesignUploadFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function choose(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files;
    if (!selected?.length) return;
    setFiles(selectDesignFiles(selected));
    setError("");
    event.target.value = "";
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const version = await uploadDesign(requireAccessToken(), designUploadBody(project, files));
      setFiles([]);
      onUploaded(version);
    } catch (err) {
      setError(toApiErrorMessage(err, err instanceof Error ? err.message : "Could not upload the design folder."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border p-4">
      <h2 className="font-semibold">Upload a design version</h2>
      <label className="block">
        Project name
        <Input required maxLength={100} value={project} disabled={busy} onChange={(event) => setProject(event.target.value)} />
      </label>
      <div
        className="space-y-2 rounded-lg border border-dashed p-4"
        onDragOver={(event) => event.preventDefault()}
        onDrop={async (event) => {
          event.preventDefault();
          if (busy) return;
          setBusy(true);
          setError("");
          try {
            const selected = await readDroppedDesignFiles(event.dataTransfer);
            if (!selected.length) throw new Error("The selection contains no files.");
            setFiles(selected);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not read the folder.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <p>Drop files or a folder here.</p>
        <div className="flex flex-wrap gap-2">
          <input type="file" hidden ref={filePicker} aria-label="Select files" multiple disabled={busy} onChange={choose} />
          <input type="file" hidden ref={folderPicker} aria-label="Select a folder" multiple disabled={busy}
            {...{ webkitdirectory: "" }}
            onChange={choose}
          />
          <Button type="button" disabled={busy} onClick={() => filePicker.current?.click()}>Choose files</Button>
          <Button type="button" disabled={busy} onClick={() => folderPicker.current?.click()}>Choose folder</Button>
        </div>
        {files.length > 0 && (
          <ul aria-label="Selected files" className="max-h-32 overflow-auto text-sm">
            {files.map(({ path }, index) => <li key={`${index}-${path}`}>{path}</li>)}
          </ul>
        )}
      </div>
      <p className="text-sm text-mutedGray">Up to 32 files, 5 MiB per file and 20 MiB total. Use the same project name to add a version.</p>
      {error && <p role="alert">{error}</p>}
      <Button type="submit" disabled={busy || !files.length}>{busy ? "Working…" : "Upload version"}</Button>
    </form>
  );
}
