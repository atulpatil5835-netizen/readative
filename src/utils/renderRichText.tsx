import { Fragment, type ReactNode } from "react";
import { TaggedUser } from "../types";

interface RenderRichTextOptions {
  text: string;
  mentions?: TaggedUser[];
  onOpenProfile?: (authorId: string) => void;
  linkClassName?: string;
  mentionClassName?: string;
}

function isSafeHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function renderRichText({
  text,
  mentions = [],
  onOpenProfile,
  linkClassName = "font-semibold text-emerald-700 underline underline-offset-2",
  mentionClassName = "font-semibold text-emerald-700 underline underline-offset-2",
}: RenderRichTextOptions) {
  const mentionMap = new Map(
    mentions.map((mention) => [mention.username.toLowerCase(), mention] as const)
  );
  const nodes: ReactNode[] = [];
  const tokenPattern =
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*\*([^*]+?)\*\*\*|\*\*([^*]+?)\*\*|\*([^*]+?)\*|(@[a-z0-9_]+)/gi;

  let cursor = 0;
  let index = 0;

  for (const match of text.matchAll(tokenPattern)) {
    const start = match.index ?? 0;

    if (start > cursor) {
      nodes.push(
        <Fragment key={`text-${index++}`}>{text.slice(cursor, start)}</Fragment>
      );
    }

    if (match[1] && match[2] && isSafeHttpUrl(match[2])) {
      nodes.push(
        <a
          key={`link-${index++}`}
          href={match[2]}
          target="_blank"
          rel="noreferrer noopener"
          className={linkClassName}
        >
          {match[1]}
        </a>
      );
    } else if (match[3]) {
      nodes.push(
        <span key={`triple-${index++}`} className="font-semibold text-emerald-600">
          {match[3]}
        </span>
      );
    } else if (match[4]) {
      nodes.push(
        <span key={`double-${index++}`} className="font-semibold text-rose-600">
          {match[4]}
        </span>
      );
    } else if (match[5]) {
      nodes.push(
        <strong key={`single-${index++}`} className="font-bold text-slate-900">
          {match[5]}
        </strong>
      );
    } else if (match[6]) {
      const mention = mentionMap.get(match[6].slice(1).toLowerCase());

      if (mention && onOpenProfile) {
        nodes.push(
          <button
            key={`mention-${index++}`}
            onClick={() => onOpenProfile(mention.authorId)}
            className={mentionClassName}
          >
            @{mention.username}
          </button>
        );
      } else {
        nodes.push(<Fragment key={`raw-${index++}`}>{match[6]}</Fragment>);
      }
    }

    cursor = start + match[0].length;
  }

  if (cursor < text.length) {
    nodes.push(<Fragment key={`tail-${index++}`}>{text.slice(cursor)}</Fragment>);
  }

  return nodes.length > 0 ? nodes : text;
}
