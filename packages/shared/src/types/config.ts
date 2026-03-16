/** Firemap CLI configuration */
export interface FiremapConfig {
  /** Glob patterns for model file discovery */
  models: string[];
  /** Output directory for generated files */
  outDir: string;
  /** Batch write chunk size for generated Cloud Functions */
  chunkSize: number;
  /** License key for Pro features */
  licenseKey?: string;
}

/** Default configuration values */
export const DEFAULT_CONFIG: FiremapConfig = {
  models: ["src/models/**/*.ts"],
  outDir: "./generated",
  chunkSize: 400,
};
