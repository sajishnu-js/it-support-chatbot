"use client";

import { useRef, useState } from "react";
import { CheckCircle2, FileUp, Loader2, RotateCcw, UploadCloud, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ApiError, uploadDocument } from "@/lib/api";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";

const ACCEPTED_EXTENSIONS = [".txt", ".md", ".pdf"];

type UploadStatus = "uploading" | "indexing" | "done" | "error";

interface UploadItem {
  id: string;
  file: File;
  status: UploadStatus;
  progress: number;
  error?: string;
}

export function KbUploadDialog({
  open,
  onOpenChange,
  onIndexed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onIndexed: () => void;
}) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isExtensionAllowed = (name: string) =>
    ACCEPTED_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext));

  const startUpload = (file: File, id: string) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, status: "uploading", progress: 0, error: undefined } : it))
    );

    uploadDocument(file, (percent) => {
      setItems((prev) =>
        prev.map((it) =>
          it.id === id
            ? { ...it, progress: percent, status: percent >= 100 ? "indexing" : "uploading" }
            : it
        )
      );
    })
      .then(() => {
        setItems((prev) =>
          prev.map((it) => (it.id === id ? { ...it, status: "done", progress: 100 } : it))
        );
        onIndexed();
      })
      .catch((err) => {
        const message = err instanceof ApiError ? err.message : "Upload failed.";
        setItems((prev) =>
          prev.map((it) => (it.id === id ? { ...it, status: "error", error: message } : it))
        );
      });
  };

  const addFiles = (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    const newItems: UploadItem[] = [];

    for (const file of files) {
      if (!isExtensionAllowed(file.name)) {
        newItems.push({
          id: crypto.randomUUID(),
          file,
          status: "error",
          progress: 0,
          error: "Unsupported file type. Use .txt, .md, or .pdf.",
        });
        continue;
      }
      newItems.push({ id: crypto.randomUUID(), file, status: "uploading", progress: 0 });
    }

    setItems((prev) => [...prev, ...newItems]);
    newItems
      .filter((it) => it.status === "uploading")
      .forEach((it) => startUpload(it.file, it.id));
  };

  const handleClose = (next: boolean) => {
    if (!next) setItems([]);
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add to Knowledge Base</DialogTitle>
          <DialogDescription>
            Upload .txt, .md, or .pdf files. Each file is chunked, embedded, and made searchable
            immediately.
          </DialogDescription>
        </DialogHeader>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors",
            dragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
          )}
        >
          <UploadCloud className="size-7 text-primary" />
          <p className="text-sm font-medium">Drag and drop files here</p>
          <p className="text-xs text-muted-foreground">or click to browse — .txt, .md, .pdf</p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPTED_EXTENSIONS.join(",")}
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {items.length > 0 && (
          <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
            {items.map((item) => (
              <div key={item.id} className="rounded-lg border border-border/70 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <FileUp className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate text-sm">{item.file.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatBytes(item.file.size)}
                    </span>
                  </div>
                  <StatusIcon status={item.status} />
                </div>

                {(item.status === "uploading" || item.status === "indexing") && (
                  <div className="mt-2 flex items-center gap-2">
                    <Progress
                      value={item.status === "indexing" ? null : item.progress}
                      className="h-1.5"
                    />
                    <span className="w-16 shrink-0 text-right text-[11px] text-muted-foreground">
                      {item.status === "indexing" ? "Indexing…" : `${item.progress}%`}
                    </span>
                  </div>
                )}

                {item.status === "error" && (
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <p className="text-xs text-destructive">{item.error}</p>
                    {isExtensionAllowed(item.file.name) && (
                      <Button
                        variant="ghost"
                        size="xs"
                        className="gap-1"
                        onClick={() => startUpload(item.file, item.id)}
                      >
                        <RotateCcw className="size-3" />
                        Retry
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatusIcon({ status }: { status: UploadStatus }) {
  if (status === "done") return <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />;
  if (status === "error") return <X className="size-4 shrink-0 text-destructive" />;
  return <Loader2 className="size-4 shrink-0 animate-spin text-primary" />;
}
