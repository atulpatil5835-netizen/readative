import { KnowledgeImageCarousel } from "../KnowledgeImageCarousel";
import { CardMediaProps } from "./cardTypes";

export function CardMedia({ entryImages, imageLayout, title }: CardMediaProps) {
  if (entryImages.length === 0) return null;

  return (
    <KnowledgeImageCarousel
      images={entryImages}
      layout={imageLayout}
      altBase={title}
    />
  );
}
