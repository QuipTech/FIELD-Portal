const BULLET = /^[•\-*–]\s+/;

type ContentBlock = { kind: "paragraph"; text: string } | { kind: "list"; items: string[] };

// Paragraphs (separated by a blank line) and runs of bullets as a list.
export const toContentBlocks = (content: string): ContentBlock[] =>
  content
    .split("\n\n")
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .reduce<ContentBlock[]>((blocks, paragraph) => {
      if (!BULLET.test(paragraph)) return [...blocks, { kind: "paragraph", text: paragraph }];
      const item = paragraph.replace(BULLET, "");
      const last = blocks[blocks.length - 1];
      if (last?.kind === "list") return [...blocks.slice(0, -1), { kind: "list", items: [...last.items, item] }];
      return [...blocks, { kind: "list", items: [item] }];
    }, []);

export const ArticleContent = ({ content }: { content: string }) => (
  <>
    {toContentBlocks(content).map((block, index) =>
      block.kind === "list" ? (
        <ul key={index} className="flex list-disc flex-col gap-1 pl-5 text-[15px] text-bodyGray">
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p key={index} className="text-[15px] leading-relaxed text-bodyGray">
          {block.text}
        </p>
      ),
    )}
  </>
);
