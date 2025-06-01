import React from 'react';

interface LoaderProps {
  className?: string;
}

export function Loader({ className = '' }: LoaderProps) {  
  return (
    <div className={`w-full max-w-4xl mx-auto space-y-6 ${className}`} style={{ zIndex: 500 }}>
      {/* Query Title Skeleton */}
      <div className="animate-pulse">
        <div className="h-8 bg-gray-700 rounded-md w-3/4 mb-6"></div>
      </div>

      {/* Analysis Results Skeleton */}
      <div className="animate-pulse bg-[rgba(13,10,33,0.6)] rounded-lg p-6 space-y-6">
        {/* Asset Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gray-700 rounded-full"></div>
            <div className="space-y-2">
              <div className="h-6 bg-gray-700 rounded w-32"></div>
              <div className="h-4 bg-gray-700 rounded w-20"></div>
            </div>
          </div>
          <div className="text-right space-y-2">
            <div className="h-6 bg-gray-700 rounded w-24"></div>
            <div className="h-4 bg-gray-700 rounded w-16"></div>
          </div>
        </div>

        {/* Chart Skeleton */}
        <div className="h-64 bg-gray-700 rounded-lg flex items-end justify-between p-4">
          {/* Simulate chart bars */}
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="bg-gray-600 rounded-t"
              style={{
                height: `${Math.random() * 60 + 20}%`,
                width: '10%'
              }}
            ></div>
          ))}
        </div>

        {/* Sentiment Section */}
        <div className="space-y-3">
          <div className="h-5 bg-gray-700 rounded w-40"></div>
          <div className="flex space-x-2">
            <div className="h-8 bg-gray-700 rounded-full w-20"></div>
            <div className="h-8 bg-gray-700 rounded-full w-24"></div>
            <div className="h-8 bg-gray-700 rounded-full w-16"></div>
          </div>
        </div>

        {/* Analysis Text Skeleton */}
        <div className="space-y-3">
          <div className="h-5 bg-gray-700 rounded w-32"></div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-700 rounded w-full"></div>
            <div className="h-4 bg-gray-700 rounded w-full"></div>
            <div className="h-4 bg-gray-700 rounded w-5/6"></div>
            <div className="h-4 bg-gray-700 rounded w-4/5"></div>
            <div className="h-4 bg-gray-700 rounded w-full"></div>
            <div className="h-4 bg-gray-700 rounded w-3/4"></div>
          </div>
        </div>

        {/* Action Buttons Skeleton */}
        <div className="flex space-x-3 pt-4">
          <div className="h-10 bg-gray-700 rounded w-24"></div>
          <div className="h-10 bg-gray-700 rounded w-20"></div>
        </div>
      </div>

      {/* News Section Skeleton */}
      <div className="space-y-4">
        <div className="h-6 bg-gray-700 rounded w-40 animate-pulse"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse bg-[rgba(13,10,33,0.4)] rounded-lg p-4 space-y-3">
              <div className="h-5 bg-gray-700 rounded w-full"></div>
              <div className="space-y-2">
                <div className="h-3 bg-gray-700 rounded w-full"></div>
                <div className="h-3 bg-gray-700 rounded w-4/5"></div>
              </div>
              <div className="flex justify-between items-center">
                <div className="h-6 bg-gray-700 rounded-full w-20"></div>
                <div className="h-4 bg-gray-700 rounded w-16"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Loader;