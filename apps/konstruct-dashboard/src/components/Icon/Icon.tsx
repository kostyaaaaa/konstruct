'use client';

import { type ComponentType, lazy, Suspense, type SVGProps, useMemo } from 'react';

import type { IconProps } from './types';

type SvgComponent = ComponentType<SVGProps<SVGSVGElement>>;

/**
 * One lazy component per icon name, so a name used in several places is loaded
 * and reconciled once rather than re-created on every render.
 */
const loaded = new Map<string, SvgComponent>();

function iconComponent(name: string): SvgComponent {
  const cached = loaded.get(name);
  if (cached) return cached;

  const component = lazy(async () => {
    try {
      // The template literal makes the bundler include every file in
      // src/assets/icons and pick one at runtime.
      return (await import(`../../assets/icons/${name}.svg`)) as { default: SvgComponent };
    } catch {
      throw new Error(
        `Icon "${name}" not found. Expected src/assets/icons/${name}.svg — check the name or add the file.`,
      );
    }
  });

  loaded.set(name, component);
  return component;
}

export function Icon({ name, size = 24, className }: IconProps) {
  const Svg = useMemo(() => iconComponent(name), [name]);

  return (
    <Suspense
      fallback={
        <span aria-hidden="true" className={className} style={{ width: size, height: size }} />
      }
    >
      <Svg width={size} height={size} className={className} aria-hidden="true" focusable="false" />
    </Suspense>
  );
}
