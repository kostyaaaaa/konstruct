export type IconProps = {
  /**
   * File name of an SVG in `src/assets/icons`, without the extension:
   * `"docs"` renders `src/assets/icons/docs.svg`. Throws if no such file
   * exists.
   */
  name: string;
  /** Rendered width and height in px. */
  size?: number;
  className?: string;
};
