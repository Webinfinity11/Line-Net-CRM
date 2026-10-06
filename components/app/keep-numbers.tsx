import { Fragment } from "react";

/** Keeps order numbers like LN-00547 on one line: a narrow column otherwise breaks them at the hyphen. */
export function KeepNumbers({ text }: { text: string }) {
  return text.split(/(LN-\d+)/).map((part, i) => (i % 2 ? <span key={i} className="whitespace-nowrap">{part}</span> : <Fragment key={i}>{part}</Fragment>));
}
