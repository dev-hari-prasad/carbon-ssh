declare module "*.css";

interface Window {
  electron?: {
    platform: NodeJS.Platform;
    setTitleBarOverlay?: (overlay: { color: string; symbolColor: string; height?: number }) => void;
    setZoomLevel: (level: number) => void;
    biometricUnlock: (reason: string) => Promise<boolean>;
    encryptString: (text: string) => Promise<string>;
    decryptString: (encrypted: string) => Promise<string>;
    setAppLockPassword?: (password: string) => Promise<boolean>;
    verifyAppLockPassword?: (candidate: string) => Promise<boolean>;
    clearAppLockPassword?: () => Promise<boolean>;
    getWsToken?: () => Promise<string>;
    saveConnectionSecret?: (
      connectionId: string,
      secrets: {
        authType: "password" | "privateKey";
        password?: string;
        privateKey?: string;
        passphrase?: string;
      },
    ) => Promise<boolean>;
    loadConnectionSecret?: (connectionId: string) => Promise<{
      authType: "password" | "privateKey";
      password?: string;
      privateKey?: string;
      passphrase?: string;
    } | null>;
    deleteConnectionSecret?: (connectionId: string) => Promise<boolean>;
    saveConnectionMetadata?: (
      connectionId: string,
      metadata: {
        id: string;
        name: string;
        host: string;
        port: number;
        username: string;
        authType: "password" | "privateKey";
      },
    ) => Promise<boolean>;
    deleteConnectionMetadata?: (connectionId: string) => Promise<boolean>;
    saveAiApiKey?: (provider: string, apiKey: string, baseUrl?: string) => Promise<boolean>;
    hasAiApiKey?: (provider: string) => Promise<boolean>;
    trustKnownHost?: (payload: {
      host: string;
      port: number;
      algorithm: string;
      fingerprint: string;
    }) => Promise<boolean>;
    aiAutocomplete?: (payload: unknown) => Promise<{
      suggestions?: Array<{ command: string; label: string; description: string }>;
    }>;
    aiTestConnection?: (payload: unknown) => Promise<{ ok?: boolean; error?: string }>;
  };
}
