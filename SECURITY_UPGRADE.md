# Security Upgrade: JWT Token Authentication

## Critical Security Issue Fixed

**Problem**: The previous authentication system stored sensitive subscription data directly in localStorage, which could be easily copied and shared between users, creating a major security vulnerability.

**Previous Insecure Data** (stored in `localStorage`):
```json
{
  "id": "65e1df4d0ce08148bc333b62",
  "email": "koynlabs@gmail.com", 
  "status": "active",
  "startedAt": "2025-03-01T13:59:41.303Z",
  "renewalDate": "2026-04-01T13:59:41.303Z",
  "transactionId": "65e1df4d0ce08148bc333b62",
  "plan": "monthly",
  "paymentMethod": "helio",
  "amount": 9.9,
  "currency": "USDC",
  "transactionDetails": { /* sensitive payment data */ }
}
```

## Security Solution Implemented

### 1. JWT Token-Based Authentication

The new system uses secure JWT tokens instead of raw subscription data:

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 900,
  "tokenType": "Bearer"
}
```

### 2. Server-Side Validation

- All subscription status checks now require server-side validation
- Tokens are verified against active subscription status on each request
- No sensitive data is stored client-side

### 3. Token Expiration & Refresh

- **Access tokens**: Expire after 15 minutes
- **Refresh tokens**: Expire after 7 days
- Automatic token refresh prevents session interruption
- Expired tokens are automatically cleaned up

### 4. Session Management

- Server-side session tracking with unique session IDs
- Refresh tokens can be invalidated server-side
- Proper logout functionality clears all tokens

## Environment Configuration

Add these required environment variables:

```bash
# Generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=your_64_character_secret_here
JWT_REFRESH_SECRET=your_64_character_refresh_secret_here
```

## API Endpoints

### Secure Authentication Endpoints

- `POST /api/verification/verify` - Returns JWT tokens on successful verification
- `POST /api/auth/refresh` - Refresh access token using refresh token  
- `GET /api/auth/subscription` - Get subscription status (requires authentication)
- `POST /api/auth/logout` - Invalidate refresh token

### Legacy Endpoint (Deprecated)

- `GET /api/subscription/:email` - Now returns security warning

## Frontend Changes

### New Secure Context

```typescript
const { login, logout, isSubscribed, user } = useSubscription();

// Login with tokens (called after verification)
login({
  auth: { accessToken, refreshToken, expiresIn, tokenType },
  user: { email, plan, isActive }
});

// Secure logout
logout();
```

### Automatic Token Management

- Tokens are automatically refreshed before expiration
- Authentication failures trigger re-authentication flow
- Legacy insecure data is automatically removed

## Security Benefits

1. **No Sensitive Data Exposure**: Only tokens are stored client-side
2. **Server-Side Validation**: All requests are validated against live subscription status
3. **Token Expiration**: Limits exposure window if tokens are compromised
4. **Session Invalidation**: Proper logout and token revocation
5. **Cross-Device Security**: Tokens can't be easily shared between devices

## Migration Notes

- Legacy `koyn_subscription` localStorage data is automatically removed
- Users will need to re-authenticate using email verification
- All existing "logged in" states will be cleared for security

## Production Deployment

1. Set strong JWT secrets in environment variables
2. Ensure verification API is running with JWT support
3. Install jsonwebtoken dependency: `npm install jsonwebtoken`
4. Consider using Redis for refresh token storage in production (currently in-memory) 