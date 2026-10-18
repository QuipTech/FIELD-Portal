export const HighlightedSnippet = ({ text, highlights = [] }: { text: string; highlights?: string[] }) => {
  const words = new Set(highlights.map((word) => word.toLowerCase()));
  return (
    <>
      {text.split(new RegExp("([\\p{L}\\p{N}]+)", "gu")).map((part, index) =>
        words.has(part.toLowerCase()) ? (
          <mark key={index} className="rounded bg-primaryTint text-primaryTintText">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
};
