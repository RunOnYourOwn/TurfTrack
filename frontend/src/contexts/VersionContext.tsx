import React, { createContext, useContext, useEffect, useState } from "react";
import { fetcher } from "../lib/fetcher";

export type VersionInfo = {
  version: string;
  environment?: string;
};

const VersionContext = createContext<VersionInfo | null>(null);

export const useVersion = () => useContext(VersionContext);

export const VersionProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);

  useEffect(() => {
    fetcher("/api/v1/version", { method: "GET" })
      .then(setVersionInfo)
      .catch(() => setVersionInfo({ version: "unknown" }));
  }, []);

  return (
    <VersionContext.Provider value={versionInfo}>
      {children}
    </VersionContext.Provider>
  );
};
