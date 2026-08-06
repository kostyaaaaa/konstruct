/**
 * SVGR turns every `.svg` import into a React component, so `*.svg` needs a
 * type. Configured by the `turbopack.rules` entry in `next.config.ts`.
 */
declare module '*.svg' {
  import type { FC, SVGProps } from 'react';

  const ReactComponent: FC<SVGProps<SVGSVGElement>>;
  export default ReactComponent;
}
