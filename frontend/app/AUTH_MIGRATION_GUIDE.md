# JWT Authentication Migration Guide

## Problem Solved

The old `SubscriptionContext` was causing hydration issues because it:
1. Did complex initialization during mount that differed between server and client
2. Mixed authentication state with subscription logic
3. Had race conditions between localStorage access and React state

## New Solution: AuthProvider + ProtectedPage

### Key Benefits

1. **No Hydration Issues**: Uses React 19's `useSyncExternalStore` with proper server/client snapshots
2. **Clean Separation**: Authentication is separate from page protection logic
3. **Simple Integration**: Just wrap components with `<ProtectedPage>` 
4. **Backwards Compatible**: Exports `useSubscription` hook for existing code

### How to Migrate

#### 1. Update root.tsx (Already Done)
```tsx
// Old
import { SubscriptionProvider } from "./context/SubscriptionContext";

// New  
import { AuthProvider } from "./context/AuthProvider";

// In Layout component:
<AuthProvider>
  {children}
</AuthProvider>
```

#### 2. Protect Pages (Simple Approach)

**Old way (complex):**
```tsx
// analysis.tsx - 1300+ lines with subscription logic mixed in
const [isProtected, setIsProtected] = useState(!isSubscribed);
// Complex useEffects for subscription checking
// Modal state management
// Protection logic throughout component
```

**New way (simple):**
```tsx
// analysis.tsx - Clean and simple
import ProtectedPage from '../components/ProtectedPage';

function AnalysisContent() {
  // Your existing logic without subscription checks
  return <div>Your analysis content</div>;
}

export default function Analysis() {
  return (
    <ProtectedPage requiresSubscription={true}>
      <AnalysisContent />
    </ProtectedPage>
  );
}
```

#### 3. Update Hook Usage

The hooks remain the same for backwards compatibility:
```tsx
// Still works exactly the same
const { isSubscribed, userEmail, user } = useSubscription();
```

#### 4. API Calls

**Old way:**
```tsx
// Complex makeAuthenticatedRequest with manual token management
const response = await makeAuthenticatedRequest('/api/auth/subscription');
```

**New way:**
```tsx
import { apiClient } from '../utils/apiClient';

// Automatic token management and refresh
const response = await apiClient.get('/api/auth/subscription');
```

### Migration Strategy

#### Phase 1: Switch Provider (Done)
- Update `root.tsx` to use `AuthProvider`
- This immediately fixes hydration issues

#### Phase 2: Simplify Pages
For each protected page:

1. **Extract Content Component**
   ```tsx
   // Take existing page content and wrap in a component
   function YourPageContent() {
     // Existing logic without subscription checks
     return <div>...</div>;
   }
   ```

2. **Wrap with Protection**
   ```tsx
   export default function YourPage() {
     return (
       <ProtectedPage requiresSubscription={true}>
         <YourPageContent />
       </ProtectedPage>
     );
   }
   ```

3. **Remove Old Logic**
   - Remove `isProtected` state
   - Remove subscription checking useEffects
   - Remove modal state management
   - Keep business logic

#### Phase 3: Update API Calls
Replace manual token management with the new API client:

```tsx
// Old
const response = await makeAuthenticatedRequest(url, options);

// New
const response = await apiClient.get(url);
```

### Examples

#### billing.tsx
```tsx
import ProtectedPage from '../components/ProtectedPage';

function BillingContent() {
  // All your existing billing logic
  // No more hydration issues or complex subscription checks
}

export default function Billing() {
  return (
    <ProtectedPage requiresSubscription={true}>
      <BillingContent />
    </ProtectedPage>
  );
}
```

#### Public Pages
```tsx
export default function Home() {
  return (
    <ProtectedPage requiresSubscription={false}>
      <HomeContent />
    </ProtectedPage>
  );
}
```

### Key Features

1. **Server-Side Safe**: No localStorage access during SSR
2. **React 19 Patterns**: Uses `useSyncExternalStore` for clean state management
3. **Automatic Token Refresh**: Handled transparently by the API client
4. **Error Boundaries**: Built-in error handling for auth failures
5. **Clean Architecture**: Separation of concerns between auth and UI

### Rollback Plan

If issues arise, you can quickly rollback by:
1. Reverting `root.tsx` to use `SubscriptionProvider`
2. The old components will continue to work as-is

The new system is designed to be a drop-in replacement that solves the JWT/hydration issues while maintaining all existing functionality. 