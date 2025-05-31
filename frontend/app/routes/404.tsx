import React from 'react';
import { Link } from 'react-router';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0d0a21] to-[#1a1535] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <div className="text-6xl font-bold text-[#8B5CF6] mb-4">404</div>
          <h1 className="text-2xl font-semibold text-white mb-2">Page Not Found</h1>
          <p className="text-[#a099d8] text-sm leading-relaxed">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>
        
        <div className="space-y-4">
          <Link 
            to="/"
            className="inline-block w-full bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] text-white font-medium py-3 px-6 rounded-lg hover:from-[#7C3AED] hover:to-[#DB2777] transition-all duration-200 transform hover:scale-105"
          >
            Go Home
          </Link>
          
          <button 
            onClick={() => window.history.back()}
            className="inline-block w-full bg-[rgba(139,92,246,0.1)] text-[#8B5CF6] font-medium py-3 px-6 rounded-lg hover:bg-[rgba(139,92,246,0.2)] transition-all duration-200"
          >
            Go Back
          </button>
        </div>
        
        <div className="mt-8 text-xs text-[#6b7280]">
          If you believe this is an error, please{' '}
          <a 
            href="mailto:support@koyn.finance" 
            className="text-[#8B5CF6] hover:text-[#7C3AED] underline"
          >
            contact support
          </a>
        </div>
      </div>
    </div>
  );
} 