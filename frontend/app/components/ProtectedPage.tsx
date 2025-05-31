import React, { Suspense } from 'react';
import { useAuth } from '../context/AuthProvider';
import SubscriptionModal from './SubscriptionModal';
import Loader from './Loader';

interface ProtectedPageProps {
  children: React.ReactNode;
  requiresSubscription?: boolean;
  fallback?: React.ReactNode;
}

export default function ProtectedPage({ 
  children, 
  requiresSubscription = true,
  fallback 
}: ProtectedPageProps) {
  const { isSubscribed, isAuthenticated } = useAuth();

  // If subscription not required, always show content
  if (!requiresSubscription) {
    return <>{children}</>;
  }

  // If user is subscribed, show content
  if (isSubscribed) {
    return <>{children}</>;
  }

  // If custom fallback provided, use it
  if (fallback) {
    return <>{fallback}</>;
  }

  // Default behavior: show subscription modal
  return (
    <>
      {/* Still render the page content underneath */}
      {children}
      
      {/* Show subscription modal overlay */}
      <SubscriptionModal
        isOpen={true}
        onClose={() => {
          // Don't allow closing the modal for required subscriptions
          console.log('Subscription required to access this content');
        }}
        onSuccess={() => {
          // Modal will close automatically when subscription becomes active
          console.log('Subscription activated');
        }}
      />
    </>
  );
}

// Simple wrapper function for pages
export function withSubscriptionProtection<P extends object>(
  Component: React.ComponentType<P>,
  requiresSubscription: boolean = true
) {
  const WrappedComponent = (props: P) => (
    <ProtectedPage requiresSubscription={requiresSubscription}>
      <Component {...props} />
    </ProtectedPage>
  );

  WrappedComponent.displayName = `withSubscriptionProtection(${Component.displayName || Component.name})`;
  return WrappedComponent;
} 