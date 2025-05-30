/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MONTHLY_PAYLINK_ID: string;
  readonly VITE_QUARTERLY_PAYLINK_ID: string;
  readonly VITE_YEARLY_PAYLINK_ID: string;
  // Add more environment variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
} 