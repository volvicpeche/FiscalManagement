import type { ReactNode } from 'react';

/**
 * Two-column layout whose parameter panel folds away.
 *
 * Wide tables need the whole window, but the inputs have to stay one click
 * away — so the collapsed state keeps a labelled rail rather than hiding the
 * panel without trace. On narrow screens the panel stacks above the content and
 * the rail becomes a plain button, since there is no horizontal room to win.
 */
export function SidebarLayout({
  open,
  onToggle,
  sidebar,
  children,
  labelOuvrir = 'Parametres',
  labelFermer = 'Masquer les parametres',
}: {
  open: boolean;
  onToggle: () => void;
  sidebar: ReactNode;
  children: ReactNode;
  labelOuvrir?: string;
  labelFermer?: string;
}) {
  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
      {open ? (
        <div className="w-full lg:w-[380px] lg:shrink-0 space-y-4">
          <button
            type="button"
            onClick={onToggle}
            className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-600 bg-white border rounded-lg hover:bg-gray-50 hover:text-gray-900 transition-colors"
          >
            <span>{labelFermer}</span>
            <span aria-hidden className="text-gray-400">
              ◀
            </span>
          </button>
          {sidebar}
        </div>
      ) : (
        <button
          type="button"
          onClick={onToggle}
          title={labelOuvrir}
          className="lg:w-10 lg:shrink-0 lg:sticky lg:top-24 lg:self-start flex lg:flex-col items-center justify-center gap-2 px-3 py-2 lg:py-4 text-sm font-medium text-gray-500 bg-white border rounded-lg hover:bg-gray-50 hover:text-gray-900 transition-colors"
        >
          <span aria-hidden className="text-gray-400">
            ▶
          </span>
          <span className="lg:[writing-mode:vertical-rl] lg:rotate-180 whitespace-nowrap">
            {labelOuvrir}
          </span>
        </button>
      )}

      {/* min-w-0 lets a wide table scroll inside the column instead of pushing it */}
      <div className="flex-1 min-w-0 space-y-6">{children}</div>
    </div>
  );
}
