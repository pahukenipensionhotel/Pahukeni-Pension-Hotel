import React from "react";

export const SkeletonCard = () => (
  <div className="bg-white p-5 rounded-[1.5rem] border border-black/5 shadow-sm animate-pulse flex flex-col gap-4">
    <div className="aspect-[16/10] bg-gray-100 rounded-2xl"></div>
    <div className="space-y-3">
      <div className="h-4 bg-gray-100 rounded-lg w-2/3"></div>
      <div className="h-6 bg-gray-100 rounded-lg w-full"></div>
      <div className="flex justify-between pt-2">
        <div className="h-8 w-16 bg-gray-100 rounded-xl"></div>
        <div className="h-10 w-24 bg-gray-100 rounded-xl"></div>
      </div>
    </div>
  </div>
);

export const SkeletonTable = () => (
  <div className="w-full bg-white rounded-[2rem] border border-black/5 p-8 space-y-4">
    {[1, 2, 3, 4].map((i) => (
      <div key={i} className="flex gap-4 animate-pulse">
        <div className="w-12 h-12 rounded-2xl bg-gray-100"></div>
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-100 rounded-lg w-1/4"></div>
          <div className="h-3 bg-gray-100 rounded-lg w-1/2"></div>
        </div>
      </div>
    ))}
  </div>
);
