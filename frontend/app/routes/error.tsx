import React from 'react';
import { Link, useLocation } from 'react-router';

export default function ErrorPage() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const errorCode = searchParams.get('code') || '500';
  const errorMessage = searchParams.get('message') || 'Internal Server Error';

  const getErrorDetails = (code: string) => {
    switch (code) {
      case '400':
        return {
          title: 'Bad Request',
          description: 'The request could not be understood by the server.'
        };
      case '403':
        return {
          title: 'Forbidden',
          description: 'You don\'t have permission to access this resource.'
        };
      case '404':
        return {
          title: 'Not Found',
          description: 'The requested page could not be found.'
        };
      case '500':
        return {
          title: 'Server Error',
          description: 'Something went wrong on our end. Please try again later.'
        };
      case '502':
        return {
          title: 'Bad Gateway',
          description: 'The server received an invalid response from an upstream server.'
        };
      case '503':
        return {
          title: 'Service Unavailable',
          description: 'The server is temporarily unavailable. Please try again later.'
        };
      default:
        return {
          title: 'Error',
          description: errorMessage || 'An unexpected error occurred.'
        };
    }
  };

  const errorDetails = getErrorDetails(errorCode);

  return (
    <div className="min-h-screen bg-[rgb(0,0,0)] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <div className="text-6xl font-bold text-white mb-4">{errorCode}</div>
          <h1 className="text-2xl font-semibold text-white mb-2">{errorDetails.title}</h1>
          <p className="text-[#a099d8] text-sm leading-relaxed">
            {errorDetails.description}
          </p>
        </div>
        
        <div className="space-y-4">
          <div className="glowing-input-container button-container w-full">
            <div className="white"></div>
            <div className="border"></div>
            <div className="darkBorderBg"></div>
            <div className="glow"></div>
            <Link 
              to="/"
              className="subscribe-button w-full h-12 text-white font-medium transition-all duration-200 flex items-center justify-center"
            >
              Go Home
            </Link>
            <div className="button-border"></div>
          </div>
          
          <button 
            onClick={() => window.location.reload()}
            className="w-full bg-[rgba(255,255,255,0.1)] text-white font-medium py-3 px-6 border border-[rgba(255,255,255,0.3)] hover:bg-[rgba(255,255,255,0.2)] transition-all duration-200"
          >
            Try Again
          </button>
          
          <button 
            onClick={() => window.history.back()}
            className="w-full bg-[rgba(255,255,255,0.05)] text-[#a099d8] font-medium py-3 px-6 border border-[rgba(255,255,255,0.2)] hover:bg-[rgba(255,255,255,0.1)] transition-all duration-200"
          >
            Go Back
          </button>
        </div>
        
        <div className="mt-8 text-xs text-[#6b7280]">
          If this problem persists, please{' '}
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