/**
 * Version management utilities for TurfTrack frontend.
 * Provides functions to fetch and display version information.
 */

export interface VersionInfo {
  version: string;
  build_date: string;
  git: {
    commit_hash: string;
    branch: string;
    tag: string;
  };
  environment: {
    python_version: string;
    platform: string;
  };
}

export interface FrontendVersionInfo {
  version: string;
  build_date: string;
  backend_version?: string;
  git?: {
    commit_hash: string;
    branch: string;
    tag: string;
  };
}

/**
 * Fetch version information from the backend API.
 *
 * @param baseUrl - Base URL for the API (defaults to current origin)
 * @returns Promise<VersionInfo> - Version information from backend
 */
export async function fetchBackendVersion(
  baseUrl?: string
): Promise<VersionInfo> {
  const apiUrl = baseUrl || window.location.origin;

  try {
    const response = await fetch(`${apiUrl}/api/v1/version`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Failed to fetch backend version:", error);
    throw error;
  }
}

/**
 * Get frontend version information.
 * This includes the frontend build time and optionally backend version.
 *
 * @param includeBackend - Whether to include backend version info
 * @returns Promise<FrontendVersionInfo> - Frontend version information
 */
export async function getFrontendVersion(
  includeBackend: boolean = true
): Promise<FrontendVersionInfo> {
  const frontendInfo: FrontendVersionInfo = {
    version: import.meta.env.VITE_APP_VERSION || "development",
    build_date: import.meta.env.VITE_APP_BUILD_DATE || new Date().toISOString(),
  };

  if (includeBackend) {
    try {
      const backendInfo = await fetchBackendVersion();
      frontendInfo.backend_version = backendInfo.version;
      frontendInfo.git = backendInfo.git;
    } catch (error) {
      console.warn("Could not fetch backend version:", error);
    }
  }

  return frontendInfo;
}

/**
 * Format version information for display.
 *
 * @param versionInfo - Version information object
 * @returns string - Formatted version string
 */
export function formatVersion(
  versionInfo: VersionInfo | FrontendVersionInfo
): string {
  const parts = [versionInfo.version];

  if ("git" in versionInfo && versionInfo.git) {
    if (versionInfo.git.commit_hash !== "unknown") {
      parts.push(`(${versionInfo.git.commit_hash})`);
    }
    if (versionInfo.git.tag !== "unknown") {
      parts.push(`[${versionInfo.git.tag}]`);
    }
  }

  return parts.join(" ");
}

/**
 * Check if the current version is a development build.
 *
 * @param version - Version string to check
 * @returns boolean - True if development version
 */
export function isDevelopmentVersion(version: string): boolean {
  return (
    version === "development" ||
    version.includes("dev") ||
    version.includes("alpha") ||
    version.includes("beta")
  );
}

/**
 * Compare two version strings.
 *
 * @param version1 - First version string
 * @param version2 - Second version string
 * @returns number - -1 if version1 < version2, 0 if equal, 1 if version1 > version2
 */
export function compareVersions(version1: string, version2: string): number {
  const normalize = (version: string) => {
    return version.replace(/^v/, "").split(".").map(Number);
  };

  const v1 = normalize(version1);
  const v2 = normalize(version2);

  const maxLength = Math.max(v1.length, v2.length);

  for (let i = 0; i < maxLength; i++) {
    const num1 = v1[i] || 0;
    const num2 = v2[i] || 0;

    if (num1 < num2) return -1;
    if (num1 > num2) return 1;
  }

  return 0;
}

/**
 * Get a human-readable version display string.
 *
 * @param versionInfo - Version information object
 * @returns string - Human-readable version string
 */
export function getVersionDisplay(
  versionInfo: VersionInfo | FrontendVersionInfo
): string {
  const version = formatVersion(versionInfo);

  if (isDevelopmentVersion(versionInfo.version)) {
    return `${version} (Development)`;
  }

  return version;
}
