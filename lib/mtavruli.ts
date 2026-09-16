import { Children, Fragment, cloneElement, isValidElement, type ReactNode } from "react";

/**
 * Georgian "TT": convert Mkhedruli letters to Mtavruli code points.
 * CSS text-transform is not allowed to do this in Chrome/Firefox (CSS Text 3), so
 * headings and buttons convert the characters themselves for a consistent look.
 */
export function toMtavruli(s: string): string {
  let out = "";
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if (cp >= 0x10d0 && cp <= 0x10fa) out += String.fromCodePoint(cp + 0xbc0);
    else if (cp >= 0x10fd && cp <= 0x10ff) out += String.fromCodePoint(cp + 0xbc0);
    else out += ch;
  }
  return out;
}

/** Converts string children (also inside plain host elements and fragments); leaves components alone. */
export function mtavruliNodes(children: ReactNode): ReactNode {
  return Children.map(children, (child) => {
    if (typeof child === "string") return toMtavruli(child);
    if (isValidElement<{ children?: ReactNode }>(child) && (typeof child.type === "string" || child.type === Fragment) && child.props.children !== undefined) {
      return cloneElement(child, undefined, mtavruliNodes(child.props.children));
    }
    return child;
  });
}
