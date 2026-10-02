import { Fragment } from "react";

// Claude answers in light Markdown. Only what reads well in a chat bubble
// is honoured: paragraphs, line breaks, **bold**, list markers and the
// [n] citations (highlighted). Headings lose their #s.
const INLINE_PATTERN = /(\*\*[^*]+\*\*|\[\d+(?:\s*,\s*\d+)*\])/g;

const renderInline = (line: string) =>
  line.split(INLINE_PATTERN).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (/^\[\d/.test(part)) {
      return (
        <span key={index} className="font-medium text-primary">
          {part}
        </span>
      );
    }
    return <Fragment key={index}>{part}</Fragment>;
  });

const cleanLine = (line: string) => line.replace(/^#{1,6}\s+/, "").replace(/^\s*[-*]\s+/, "• ");

export const AnswerText = ({ text }: { text: string }) => (
  <>
    {text
      .trim()
      .split(/\n{2,}/)
      .map((paragraph, paragraphIndex) => (
        <p key={paragraphIndex} className="text-[15px] leading-relaxed text-ink">
          {paragraph.split("\n").map((line, lineIndex) => (
            <Fragment key={lineIndex}>
              {lineIndex > 0 && <br />}
              {renderInline(cleanLine(line))}
            </Fragment>
          ))}
        </p>
      ))}
  </>
);
