import { Fragment, type ReactNode } from "react";
import { TaggedUser } from "../types";

interface RenderRichTextOptions {
  text: string;
  mentions?: TaggedUser[];
  onOpenProfile?: (authorId: string) => void;
  linkClassName?: string;
  mentionClassName?: string;
}

interface RenderRichTextNodeOptions extends RenderRichTextOptions {
  allowLinks?: boolean;
  allowMentions?: boolean;
  keyPrefix?: string;
}

function isSafeHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function renderRichTextNodes({
  text,
  mentions = [],
  onOpenProfile,
  linkClassName = "font-semibold text-emerald-700 underline underline-offset-2",
  mentionClassName = "font-semibold text-emerald-700 underline underline-offset-2",
  allowLinks = true,
  allowMentions = true,
  keyPrefix = "rich",
}: RenderRichTextNodeOptions): ReactNode[] | string {
  const mentionMap = new Map(
    mentions.map((mention) => [mention.username.toLowerCase(), mention] as const)
  );
  const nodes: ReactNode[] = [];
  const tokenPattern =
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*\*([\s\S]+?)\*\*\*|\*\*([\s\S]+?)\*\*|\*([\s\S]+?)\*|(@[a-z0-9_]+)/gi;

  let cursor = 0;
  let index = 0;

  for (const match of text.matchAll(tokenPattern)) {
    const start = match.index ?? 0;

    if (start > cursor) {
      nodes.push(
        <Fragment key={`${keyPrefix}-text-${index++}`}>
          {text.slice(cursor, start)}
        </Fragment>
      );
    }

    if (match[1] && match[2] && allowLinks && isSafeHttpUrl(match[2])) {
      const currentIndex = index++;
      nodes.push(
        <a
          key={`${keyPrefix}-link-${currentIndex}`}
          href={match[2]}
          target="_blank"
          rel="noreferrer noopener"
          className={linkClassName}
        >
          {renderRichTextNodes({
            text: match[1],
            mentions,
            linkClassName,
            mentionClassName,
            allowLinks: false,
            allowMentions: false,
            keyPrefix: `${keyPrefix}-link-content-${currentIndex}`,
          })}
        </a>
      );
    } else if (match[1] && match[2]) {
      nodes.push(
        <Fragment key={`${keyPrefix}-raw-link-${index++}`}>{match[0]}</Fragment>
      );
    } else if (match[3]) {
      nodes.push(
        <span
          key={`${keyPrefix}-triple-${index++}`}
          className="font-semibold text-emerald-600"
        >
          {renderRichTextNodes({
            text: match[3],
            mentions,
            onOpenProfile,
            linkClassName,
            mentionClassName,
            allowLinks,
            allowMentions,
            keyPrefix: `${keyPrefix}-triple-content-${index}`,
          })}
        </span>
      );
    } else if (match[4]) {
      nodes.push(
        <span
          key={`${keyPrefix}-double-${index++}`}
          className="font-semibold text-rose-600"
        >
          {renderRichTextNodes({
            text: match[4],
            mentions,
            onOpenProfile,
            linkClassName,
            mentionClassName,
            allowLinks,
            allowMentions,
            keyPrefix: `${keyPrefix}-double-content-${index}`,
          })}
        </span>
      );
    } else if (match[5]) {
      nodes.push(
        <strong key={`${keyPrefix}-single-${index++}`} className="font-bold">
          {renderRichTextNodes({
            text: match[5],
            mentions,
            onOpenProfile,
            linkClassName,
            mentionClassName,
            allowLinks,
            allowMentions,
            keyPrefix: `${keyPrefix}-single-content-${index}`,
          })}
        </strong>
      );
    } else if (match[6] && allowMentions) {
      const mention = mentionMap.get(match[6].slice(1).toLowerCase());

      if (mention && onOpenProfile) {
        nodes.push(
          <a
            key={`${keyPrefix}-mention-${index++}`}
            href={`/profile/${encodeURIComponent(mention.authorId)}`}
            onClick={(event) => {
              event.preventDefault();
              onOpenProfile(mention.authorId);
            }}
            className={mentionClassName}
          >
            @{mention.username}
          </a>
        );
      } else {
        nodes.push(
          <Fragment key={`${keyPrefix}-raw-${index++}`}>{match[6]}</Fragment>
        );
      }
    } else if (match[6]) {
      nodes.push(
        <Fragment key={`${keyPrefix}-raw-mention-${index++}`}>{match[6]}</Fragment>
      );
    }

    cursor = start + match[0].length;
  }

  if (cursor < text.length) {
    nodes.push(<Fragment key={`tail-${index++}`}>{text.slice(cursor)}</Fragment>);
  }

  return nodes.length > 0 ? nodes : text;
}

export function renderRichText(options: RenderRichTextOptions) {
  return renderRichTextNodes(options);
}
