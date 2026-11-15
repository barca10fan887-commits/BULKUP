import type { CapacitorConfig } from "@capacitor/cli";

// Change appId to your own reverse-domain ID before the first App Store upload
// (it must match the Bundle ID you register in App Store Connect).
const config: CapacitorConfig = {
  appId: process.env.APP_BUNDLE_ID || "app.bulkup.ios",
  appName: "BULKUP",
  webDir: "dist",
  backgroundColor: "#050608",
  ios: {
    contentInset: "never",
    backgroundColor: "#050608",
    scheme: "BULKUP",
  },
  plugins: {
    LocalNotifications: {
      iconColor: "#1f75ff",
    },
  },
};

export default config;
