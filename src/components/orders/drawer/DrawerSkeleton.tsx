/**
 * Skeleton loader dla OrderDrawer.
 * Renderuje się natychmiast podczas ładowania danych zlecenia (fetch + lock).
 * Imituje layout OrderForm — nagłówek, sekcja trasy, towar, przewoźnik, finanse.
 */

import { memo } from "react";

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`bg-slate-200 dark:bg-slate-700 rounded animate-pulse ${className}`} />;
}

function SkeletonSection({ children }: { children: React.ReactNode }) {
  return <div className="space-y-3">{children}</div>;
}

export const DrawerSkeleton = memo(function DrawerSkeleton() {
  return (
    <div className="flex-1 overflow-y-auto py-6 pl-6 pr-8 space-y-8">
      {/* Osoba kontaktowa */}
      <SkeletonSection>
        <div className="flex items-center gap-2">
          <SkeletonBlock className="w-4 h-4 rounded" />
          <SkeletonBlock className="h-4 w-36" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <SkeletonBlock className="h-3 w-20" />
            <SkeletonBlock className="h-8 w-full rounded-lg" />
          </div>
          <div className="space-y-1.5">
            <SkeletonBlock className="h-3 w-16" />
            <SkeletonBlock className="h-8 w-full rounded-lg" />
          </div>
          <div className="space-y-1.5">
            <SkeletonBlock className="h-3 w-14" />
            <SkeletonBlock className="h-8 w-full rounded-lg" />
          </div>
        </div>
      </SkeletonSection>

      {/* Sekcja 1: Trasa */}
      <SkeletonSection>
        <div className="flex items-center gap-2">
          <SkeletonBlock className="w-4 h-4 rounded bg-primary/20" />
          <SkeletonBlock className="h-4 w-28" />
        </div>
        <SkeletonBlock className="h-8 w-44 rounded-lg" />
        {/* Punkt trasy 1 */}
        <div className="flex gap-2">
          <SkeletonBlock className="w-5 h-5 mt-1" />
          <div className="flex-1 border border-slate-200 dark:border-slate-800 rounded-lg p-3 space-y-2">
            <SkeletonBlock className="h-5 w-24 bg-emerald-100 dark:bg-emerald-500/10" />
            <div className="grid grid-cols-4 gap-2">
              <SkeletonBlock className="h-8 col-span-2 rounded-lg" />
              <SkeletonBlock className="h-8 rounded-lg" />
              <SkeletonBlock className="h-8 rounded-lg" />
            </div>
            <SkeletonBlock className="h-3 w-56" />
          </div>
        </div>
        {/* Punkt trasy 2 */}
        <div className="flex gap-2">
          <SkeletonBlock className="w-5 h-5 mt-1" />
          <div className="flex-1 border border-slate-200 dark:border-slate-800 rounded-lg p-3 space-y-2">
            <SkeletonBlock className="h-5 w-24 bg-blue-100 dark:bg-blue-500/10" />
            <div className="grid grid-cols-4 gap-2">
              <SkeletonBlock className="h-8 col-span-2 rounded-lg" />
              <SkeletonBlock className="h-8 rounded-lg" />
              <SkeletonBlock className="h-8 rounded-lg" />
            </div>
            <SkeletonBlock className="h-3 w-48" />
          </div>
        </div>
      </SkeletonSection>

      {/* Sekcja 2: Towar */}
      <SkeletonSection>
        <div className="flex items-center gap-2">
          <SkeletonBlock className="w-4 h-4 rounded bg-amber-200/50 dark:bg-amber-500/20" />
          <SkeletonBlock className="h-4 w-24" />
        </div>
        <div className="flex gap-2">
          <SkeletonBlock className="w-5 h-5 mt-1" />
          <div className="flex-1 border border-slate-200 dark:border-slate-800 rounded-lg p-3 space-y-2">
            <SkeletonBlock className="h-5 w-20 bg-amber-100 dark:bg-amber-500/10" />
            <div className="grid grid-cols-12 gap-2">
              <SkeletonBlock className="h-8 col-span-6 rounded-lg" />
              <SkeletonBlock className="h-8 col-span-2 rounded-lg" />
              <SkeletonBlock className="h-8 col-span-4 rounded-lg" />
            </div>
          </div>
        </div>
      </SkeletonSection>

      {/* Sekcja 3: Firma transportowa */}
      <SkeletonSection>
        <div className="flex items-center gap-2">
          <SkeletonBlock className="w-4 h-4 rounded bg-violet-200/50 dark:bg-violet-500/20" />
          <SkeletonBlock className="h-4 w-40" />
        </div>
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
          <div className="flex gap-2">
            <SkeletonBlock className="h-8 basis-1/2 rounded-lg" />
            <SkeletonBlock className="h-8 basis-[30%] rounded-lg" />
            <SkeletonBlock className="h-8 basis-[20%] rounded-lg" />
          </div>
          <SkeletonBlock className="h-8 w-full rounded-lg" />
        </div>
      </SkeletonSection>

      {/* Sekcja 4: Finanse */}
      <SkeletonSection>
        <div className="flex items-center gap-2">
          <SkeletonBlock className="w-4 h-4 rounded bg-yellow-200/50 dark:bg-yellow-500/20" />
          <SkeletonBlock className="h-4 w-28" />
        </div>
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="grid grid-cols-2 gap-3">
            <SkeletonBlock className="h-12 rounded-lg" />
            <SkeletonBlock className="h-12 rounded-lg" />
            <SkeletonBlock className="h-12 rounded-lg" />
            <SkeletonBlock className="h-12 rounded-lg" />
          </div>
        </div>
      </SkeletonSection>
    </div>
  );
});
