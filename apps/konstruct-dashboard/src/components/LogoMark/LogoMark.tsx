/**
 * The 2x2 Konstruct mark. Built from divs rather than an SVG asset so it picks
 * up the brand tokens directly.
 */
export function LogoMark() {
  return (
    <div className="grid size-[34px] grid-cols-2 grid-rows-2 gap-[3px] rounded-[9px] bg-brand p-1.5">
      <div className="rounded-[2px] bg-brand-mark" />
      <div className="rounded-[2px] bg-brand-mark-dim" />
      <div className="rounded-[2px] bg-brand-mark-dim" />
      <div className="rounded-[2px] bg-brand-mark" />
    </div>
  );
}
