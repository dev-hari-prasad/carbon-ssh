declare module "*.css";

interface Window {
  electron?: {
    platform: NodeJS.Platform;
    setTitleBarOverlay?: (overlay: { color: string; symbolColor: string; height?: number }) => void;
    setZoomLevel: (level: number) => void;
    biometricUnlock: (reason: string) => Promise<boolean>;
    encryptString: (text: string) => Promise<string>;
    decryptString: (encrypted: string) => Promise<string>;
  };
}
