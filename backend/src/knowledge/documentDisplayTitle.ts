const FILE_EXTENSION = /\.(pdf|docx?|txt)$/i;
// " (2)", " copy", " - Copy" added by browsers and file managers.
const COPY_SUFFIX = /(\s*\(\d+\)|\s*-?\s*copy)+$/i;

// A document's title for people: uploads without a title were saved under
// their file name ("CAT_793F_Hydraulic_System_Maintenance_Bulletin (2).pdf"
// → "CAT 793F Hydraulic System Maintenance Bulletin"). Titles typed by
// hand come back unchanged. Falls back to the stored title if cleaning
// would leave nothing.
export const toDocumentDisplayTitle = (title: string): string => {
  const cleaned = title
    .trim()
    .replace(FILE_EXTENSION, '')
    .replace(COPY_SUFFIX, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || title;
};
