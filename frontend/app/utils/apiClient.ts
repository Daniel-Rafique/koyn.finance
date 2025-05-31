// Simple API client that handles JWT authentication
class ApiClient {
  private getAuthStore() {
    // Access the auth store singleton (you may need to adjust this based on your setup)
    if (typeof window !== 'undefined') {
      const accessToken = localStorage.getItem('koyn_access_token');
      const refreshToken = localStorage.getItem('koyn_refresh_token');
      return { accessToken, refreshToken };
    }
    return { accessToken: null, refreshToken: null };
  }

  private async refreshToken(): Promise<boolean> {
    const { refreshToken } = this.getAuthStore();
    if (!refreshToken) return false;

    try {
      const hostname = window.location.hostname;
      const protocol = window.location.protocol;
      const port = hostname === 'localhost' || hostname === '127.0.0.1' ? ':3005' : ':3005';
      const refreshUrl = `${protocol}//${hostname}${port}/api/auth/refresh`;

      const response = await fetch(refreshUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) return false;

      const data = await response.json();
      if (data.success && data.auth) {
        // Update localStorage
        localStorage.setItem('koyn_access_token', data.auth.accessToken);
        const expiryTime = Date.now() + (data.auth.expiresIn * 1000);
        localStorage.setItem('koyn_token_expiry', expiryTime.toString());
        return true;
      }

      return false;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return false;
    }
  }

  async request(url: string, options: RequestInit = {}): Promise<Response> {
    const { accessToken } = this.getAuthStore();

    // First attempt with current token
    let response = await this.makeRequest(url, options, accessToken);

    // If unauthorized, try to refresh token and retry
    if (response.status === 401 || response.status === 403) {
      const refreshed = await this.refreshToken();
      if (refreshed) {
        const { accessToken: newToken } = this.getAuthStore();
        response = await this.makeRequest(url, options, newToken);
      }
    }

    return response;
  }

  private async makeRequest(url: string, options: RequestInit, token: string | null): Promise<Response> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Determine full URL
    let fullUrl: string;
    if (url.startsWith('/api/auth/')) {
      const hostname = window.location.hostname;
      const protocol = window.location.protocol;
      const port = hostname === 'localhost' || hostname === '127.0.0.1' ? ':3005' : ':3005';
      fullUrl = `${protocol}//${hostname}${port}${url}`;
    } else {
      fullUrl = url;
    }

    return fetch(fullUrl, {
      ...options,
      headers,
    });
  }

  // Convenience methods
  async get(url: string, options?: RequestInit): Promise<Response> {
    return this.request(url, { ...options, method: 'GET' });
  }

  async post(url: string, data?: any, options?: RequestInit): Promise<Response> {
    return this.request(url, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put(url: string, data?: any, options?: RequestInit): Promise<Response> {
    return this.request(url, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete(url: string, options?: RequestInit): Promise<Response> {
    return this.request(url, { ...options, method: 'DELETE' });
  }
}

// Create a singleton instance
export const apiClient = new ApiClient();

// Convenience function for making authenticated requests
export async function makeAuthenticatedRequest(url: string, options?: RequestInit): Promise<Response> {
  return apiClient.request(url, options);
} 