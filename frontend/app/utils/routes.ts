/**
 * Route utility functions to handle path prefixes
 */

// The route prefix to avoid conflicts with Nitter profile routes
export const ROUTE_PREFIX = '/app';

/**
 * Generate a route path with the app prefix
 * @param path Route path without the prefix
 * @returns Full route path with prefix
 */
export function getRoutePath(path: string): string {
  // Don't add prefix for home route
  if (path === '/' || path === '') {
    return '/';
  }
  
  // If path already starts with prefix, return as is
  if (path.startsWith(ROUTE_PREFIX)) {
    return path;
  }
  
  // Ensure path starts with a slash
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  
  // Combine prefix with path
  return `${ROUTE_PREFIX}${normalizedPath}`;
}

/**
 * Routes object for easy access to common routes
 */
export const Routes = {
  HOME: '/',
  ANALYSIS: `${ROUTE_PREFIX}/analysis`,
  BILLING: `${ROUTE_PREFIX}/billing`,
}; 