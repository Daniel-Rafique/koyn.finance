"use client"

import React, { useEffect } from 'react';

// Interface for conversion event parameters
interface TwitterConversionParams {
  value?: number | null;
  currency?: string | null;
  conversion_id?: string | null;
  email_address?: string | null;
}

// Extend Window interface to include Twitter properties
interface TwitterWindow extends Window {
  twq?: TwitterPixelFunction;
}

// Types for Twitter tracking setup
interface TwitterPixelFunction {
  exe?: Function;
  apply: Function;
  queue: any[];
  version: string;
  (action: string, target: string, params?: object): void;
}

// Component to initialize Twitter tracking code
export function TwitterTrackingPixel() {
  useEffect(() => {
    // Only run in browser environment
    if (typeof window === 'undefined') return;

    // Check if Twitter tracking is already initialized
    if (!(window as TwitterWindow).twq) {
      // Initialize Twitter tracking
      const initializeTwitterPixel = () => {
        (function(e: TwitterWindow, t: Document, n: string) {
          let s: TwitterPixelFunction;
          let u: HTMLScriptElement;
          let a: Element;
          
          e.twq || ((s = e.twq = (function() {
            s.exe ? s.exe.apply(s, arguments) : s.queue.push(arguments);
          }) as unknown as TwitterPixelFunction),
          (s.version = '1.1'),
          (s.queue = []),
          (u = t.createElement(n) as HTMLScriptElement),
          (u.async = true),
          (u.src = 'https://static.ads-twitter.com/uwt.js'),
          (a = t.getElementsByTagName(n)[0]),
          a.parentNode?.insertBefore(u, a));
        })(window as TwitterWindow, document, 'script');
        
        // Configure Twitter pixel with ID
        (window as TwitterWindow).twq?.('config', 'q2npq');
      };

      // Execute initialization
      initializeTwitterPixel();
      console.log('Twitter tracking pixel initialized');
    }
  }, []);

  // Empty fragment as this component doesn't render anything
  return <></>;
}

// Function to track conversion events
export function trackTwitterConversion(params: TwitterConversionParams = {}) {
  if (typeof window === 'undefined' || !(window as TwitterWindow).twq) return;

  try {
    (window as TwitterWindow).twq?.('event', 'tw-q2npq-q2npr', {
      value: params.value || null,
      currency: params.currency || null, 
      conversion_id: params.conversion_id || null,
      email_address: params.email_address || null
    });
    console.log('Twitter conversion event tracked:', params);
  } catch (error) {
    console.error('Error tracking Twitter conversion:', error);
  }
}

// Function to track the specific event
export function trackTwitterEvent() {
  if (typeof window === 'undefined' || !(window as TwitterWindow).twq) return;

  try {
    (window as TwitterWindow).twq?.('event', 'tw-q2npq-q2nps', {});
    console.log('Twitter event tracked: tw-q2npq-q2nps');
  } catch (error) {
    console.error('Error tracking Twitter event:', error);
  }
}

// Default export - component to initialize tracking
export default function Tracking() {
  return <TwitterTrackingPixel />;
}
