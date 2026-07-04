import React, { Fragment, type ReactNode } from "react";
import type { NotebookHighlight } from "./types";

interface DisplayRange {
  startOffset: number;
  endOffset: number;
}

function mergeDisplayRanges(highlights: NotebookHighlight[]) {
  const sorted = highlights
    .map(({ startOffset, endOffset }) => ({ startOffset, endOffset }))
    .sort((left, right) => left.startOffset - right.startOffset);
  const merged: DisplayRange[] = [];

  for (const range of sorted) {
    const previous = merged[merged.length - 1];
    if (previous && range.startOffset <= previous.endOffset) {
      previous.endOffset = Math.max(previous.endOffset, range.endOffset);
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

export function highlightNotebookReactTree(
  nodes: ReactNode,
  highlights: NotebookHighlight[],
  charTracker = { current: 0 },
): ReactNode {
  if (nodes === null || nodes === undefined || nodes === false) return nodes;
  const ranges = mergeDisplayRanges(highlights);

  if (typeof nodes === "string") {
    const startIndex = charTracker.current;
    const endIndex = startIndex + nodes.length;
    charTracker.current = endIndex;
    const intersections = ranges
      .map((range) => ({
        start: Math.max(range.startOffset, startIndex),
        end: Math.min(range.endOffset, endIndex),
      }))
      .filter((range) => range.start < range.end);

    if (intersections.length === 0) return nodes;
    const segments: ReactNode[] = [];
    let cursor = startIndex;
    intersections.forEach((range, index) => {
      if (range.start > cursor) {
        segments.push(nodes.slice(cursor - startIndex, range.start - startIndex));
      }
      segments.push(
        <mark
          key={`notebook-highlight-${range.start}-${range.end}-${index}`}
          className="readative-notebook-highlight"
        >
          {nodes.slice(range.start - startIndex, range.end - startIndex)}
        </mark>,
      );
      cursor = range.end;
    });
    if (cursor < endIndex) segments.push(nodes.slice(cursor - startIndex));
    return <Fragment>{segments}</Fragment>;
  }

  if (Array.isArray(nodes)) {
    return (
      <Fragment>
        {nodes.map((node, index) => (
          <Fragment key={index}>
            {highlightNotebookReactTree(node, highlights, charTracker)}
          </Fragment>
        ))}
      </Fragment>
    );
  }

  if (React.isValidElement<{ children?: ReactNode }>(nodes)) {
    if (nodes.props.children === undefined) return nodes;
    return React.cloneElement(
      nodes,
      {},
      highlightNotebookReactTree(nodes.props.children, highlights, charTracker),
    );
  }

  return nodes;
}
