import { EmptyState } from "@/components/ui/emptyState";

// No sections could be extracted (e.g. a scanned PDF without OCR): show
// the PDF itself.
export const PdfFallbackViewer = ({ pdfUrl, title }: { pdfUrl: string | null; title: string }) =>
  pdfUrl ? (
    <iframe src={pdfUrl} title={title} className="min-h-[600px] w-full flex-1 rounded-lg border border-borderGray" />
  ) : (
    <EmptyState icon="file" title="No readable text in this document" description="Use Download to open the file." />
  );
