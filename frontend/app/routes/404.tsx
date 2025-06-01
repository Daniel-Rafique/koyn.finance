import React from 'react';
import { Link } from 'react-router';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[rgb(0,0,0)] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <div className="text-6xl font-bold text-white mb-4">404</div>
          <h1 className="text-2xl font-semibold text-white mb-2">Looking for something?</h1>
          <p className="text-[#a099d8] text-sm leading-relaxed">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>
        
        <div className="space-y-4">
                    <button 
            onClick={() => window.history.back()}
            className="w-full bg-[rgba(255,255,255,0.1)] text-white font-medium py-3 px-6 border border-[rgba(255,255,255,0.3)] hover:bg-[rgba(255,255,255,0.2)] transition-all duration-200"
          >
            Go Back
          </button>
        </div>
        
        <div className="mt-8 text-xs text-[#6b7280]">
          If you believe this is an error, please{' '}
          <a 
            href="mailto:support@koyn.finance" 
            className="text-[#a099d8] hover:text-white underline"
          >
            contact support
          </a>
        </div>
      </div>
    </div>
  );
} 