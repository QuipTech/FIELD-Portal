import { Icon } from "@/components/icons/icon";
import type { ArticleFigure as ArticleFigureData } from "@/lib/types/knowledgeArticle";

// The extracted page image with its caption, or a captioned placeholder
// when there's no image.
export const ArticleFigure = ({ figure }: { figure: ArticleFigureData }) => (
  <figure className="flex flex-col gap-1.5">
    {figure.imageUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={figure.imageUrl} alt={figure.caption} className="max-h-[360px] rounded-lg border border-borderGray object-contain" />
    ) : (
      <div className="flex h-[150px] flex-col items-center justify-center gap-1.5 rounded-lg border border-borderGrayStrong bg-fillGray px-4 text-center text-xs text-mutedGray">
        <Icon name="image" className="h-6 w-6" />
        {figure.caption}
      </div>
    )}
    {figure.imageUrl && (
      <figcaption className="text-xs text-mutedGray">
        {figure.caption}
        {figure.page ? ` · p. ${figure.page}` : ""}
      </figcaption>
    )}
  </figure>
);
