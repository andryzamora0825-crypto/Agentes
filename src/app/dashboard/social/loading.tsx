import { Share2 } from "lucide-react";

export default function SocialLoading() {
  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex items-center gap-3">
        <div className="bg-[#FFDE00]/20 p-2 rounded-xl">
          <Share2 className="w-8 h-8 text-[#FFDE00]/30" />
        </div>
        <div>
          <div className="h-8 w-48 bg-white/5 rounded-xl" />
          <div className="h-4 w-72 bg-white/5 rounded-lg mt-2" />
        </div>
      </div>

      {/* Filters Skeleton */}
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 w-24 bg-[#111111] rounded-xl border border-white/5" />
        ))}
      </div>

      {/* Cards Grid Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="bg-[#121212] rounded-2xl overflow-hidden border border-white/5"
          >
            <div className="aspect-square bg-white/5" />
            <div className="p-4 space-y-3">
              <div className="h-3 w-full bg-white/5 rounded" />
              <div className="h-3 w-3/4 bg-white/5 rounded" />
              <div className="h-3 w-1/2 bg-white/5 rounded" />
              <div className="flex gap-2 pt-3">
                <div className="h-8 flex-1 bg-white/5 rounded-lg" />
                <div className="h-8 flex-1 bg-white/5 rounded-lg" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
