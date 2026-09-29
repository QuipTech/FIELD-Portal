// An SVG is markup and can carry script. Logos are shown through <img>
// (which never runs script), but a signed URL opened directly would render
// the SVG as a page, so anything active is refused outright rather than
// sanitised.
const SVG_ROOT =
  /^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i;
const ACTIVE_CONTENT = [
  /<script/i,
  /<foreignObject/i,
  /<(iframe|embed|object|audio|video|animate|set|handler)\b/i,
  /\son[a-z]+\s*=/i,
  /(javascript|vbscript|data:text\/html)/i,
  /<!ENTITY/i,
];

export const isSafeSvg = (buffer: Buffer): boolean => {
  const markup = buffer.toString('utf8').replace(/^﻿/, '');
  return (
    SVG_ROOT.test(markup) &&
    !ACTIVE_CONTENT.some((pattern) => pattern.test(markup))
  );
};
