import React, { ReactNode, Fragment } from "react";

interface HighlightRange {
  startOffset: number;
  endOffset: number;
  id: string;
}

export function highlightReactTree(
  nodes: ReactNode,
  highlights: HighlightRange[],
  charTracker = { current: 0 }
): ReactNode {
  if (!nodes) return null;

  if (typeof nodes === "string") {
    const text = nodes;
    const len = text.length;
    const startIdx = charTracker.current;
    const endIdx = startIdx + len;

    charTracker.current = endIdx;

    // Find highlights intersecting the range [startIdx, endIdx]
    const intersectingHighlights = highlights
      .map((hl) => {
        const start = Math.max(hl.startOffset, startIdx);
        const end = Math.min(hl.endOffset, endIdx);
        return { start, end, id: hl.id };
      })
      .filter((hl) => hl.start < hl.end)
      // Sort ascending by start offset
      .sort((a, b) => a.start - b.start);

    if (intersectingHighlights.length === 0) {
      return text;
    }

    const segments: ReactNode[] = [];
    let currentPos = startIdx;

    for (const hl of intersectingHighlights) {
      if (hl.start > currentPos) {
        segments.push(text.slice(currentPos - startIdx, hl.start - startIdx));
      }

      const highlightText = text.slice(hl.start - startIdx, hl.end - startIdx);
      segments.push(
        <mark
          key={`hl-${hl.id}-${hl.start}`}
          data-highlight-id={hl.id}
          className="bg-[#FEF3C7] border-b border-[#F59E0B]/30 px-0.5 rounded-sm cursor-pointer select-text"
          title="Click to remove highlight"
        >
          {highlightText}
        </mark>
      );
      currentPos = hl.end;
    }

    if (currentPos < endIdx) {
      segments.push(text.slice(currentPos - startIdx));
    }

    return <Fragment>{segments}</Fragment>;
  }

  if (Array.isArray(nodes)) {
    return (
      <Fragment>
        {nodes.map((node, i) =>
          React.isValidElement(node) || typeof node === "string"
            ? highlightReactTree(node, highlights, charTracker)
            : node
        )}
      </Fragment>
    );
  }

  if (React.isValidElement<{ children?: ReactNode }>(nodes)) {
    const element = nodes;
    if (element.props.children) {
      const highlightedChildren = highlightReactTree(
        element.props.children,
        highlights,
        charTracker
      );
      return React.cloneElement(element, {}, highlightedChildren);
    }
    return element;
  }

  return nodes;
}

function resolveTextNodeAndOffset(node: Node, offset: number): { node: Node; offset: number } {
  if (node.nodeType === Node.TEXT_NODE) {
    return { node, offset };
  }
  if (node.childNodes.length > 0 && offset < node.childNodes.length) {
    let target = node.childNodes[offset];
    while (target && target.nodeType !== Node.TEXT_NODE && target.childNodes.length > 0) {
      target = target.childNodes[0];
    }
    if (target && target.nodeType === Node.TEXT_NODE) {
      return { node: target, offset: 0 };
    }
  }
  return { node, offset };
}

export function getAbsoluteOffsets(paragraphElement: HTMLElement, range: Range) {
  const start = resolveTextNodeAndOffset(range.startContainer, range.startOffset);
  const end = resolveTextNodeAndOffset(range.endContainer, range.endOffset);

  let startOffset = 0;
  let endOffset = 0;
  let foundStart = false;
  let foundEnd = false;

  const walker = document.createTreeWalker(
    paragraphElement,
    NodeFilter.SHOW_TEXT,
    null
  );

  let currentNode = walker.nextNode();
  let charCount = 0;

  while (currentNode) {
    if (currentNode === start.node) {
      startOffset = charCount + start.offset;
      foundStart = true;
    }
    if (currentNode === end.node) {
      endOffset = charCount + end.offset;
      foundEnd = true;
      break;
    }
    charCount += currentNode.nodeValue?.length || 0;
    currentNode = walker.nextNode();
  }

  if (!foundStart) startOffset = range.startOffset;
  if (!foundEnd) endOffset = range.endOffset;

  return { startOffset, endOffset };
}
