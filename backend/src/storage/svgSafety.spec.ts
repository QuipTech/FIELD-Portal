import { isSafeSvg } from './svgSafety';

const svg = (markup: string) => Buffer.from(markup);

describe('isSafeSvg', () => {
  it('accepts a plain SVG, with or without an XML prolog', () => {
    expect(
      isSafeSvg(
        svg(
          '<svg xmlns="http://www.w3.org/2000/svg"><rect width="4" height="4"/></svg>',
        ),
      ),
    ).toBe(true);
    expect(
      isSafeSvg(
        svg(
          '<?xml version="1.0"?>\n<!-- logo -->\n<svg viewBox="0 0 4 4"></svg>',
        ),
      ),
    ).toBe(true);
  });

  it('refuses anything that is not an SVG', () => {
    expect(isSafeSvg(svg('<html><body>hi</body></html>'))).toBe(false);
    expect(isSafeSvg(svg('not markup'))).toBe(false);
  });

  it('refuses SVGs with scripts, event handlers, links to script or embedded content', () => {
    expect(isSafeSvg(svg('<svg><script>alert(1)</script></svg>'))).toBe(false);
    expect(isSafeSvg(svg('<svg onload="alert(1)"></svg>'))).toBe(false);
    expect(
      isSafeSvg(
        svg('<svg><a href="javascript:alert(1)"><text>x</text></a></svg>'),
      ),
    ).toBe(false);
    expect(
      isSafeSvg(svg('<svg><foreignObject><div/></foreignObject></svg>')),
    ).toBe(false);
    expect(isSafeSvg(svg('<!DOCTYPE svg [<!ENTITY x "y">]><svg></svg>'))).toBe(
      false,
    );
  });
});
