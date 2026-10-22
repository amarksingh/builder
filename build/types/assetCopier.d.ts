export interface AssetConfig {
    include?: string[];
    exclude?: string[];
}
export interface TsConfig {
    compilerOptions?: {
        outDir?: string;
        rootDir?: string;
        [key: string]: any;
    };
    assets?: AssetConfig;
    [key: string]: any;
}
/**
 * Checks whether a relative path matches a glob or regex pattern string.
 *
 * @param relPath - Relative file path (e.g. 'public/css/app.css').
 * @param pattern - Glob string (e.g. '.env*', 'public/**\/*') or regex literal ('/\\.png$/').
 * @returns boolean
 */
export declare function matchesPattern(relPath: string, pattern: string | RegExp): boolean;
/**
 * Parses gitignore rules from .gitignore file into an array of clean pattern strings.
 *
 * @param rootDir - Root directory where .gitignore lives.
 * @returns Array of gitignore rules.
 */
export declare function getGitignoreRules(rootDir: string): string[];
/**
 * Checks if a relative file path is ignored by gitignore rules.
 *
 * @param relPath - Relative file path to test.
 * @param rules - Array of gitignore rules.
 * @returns boolean
 */
export declare function isIgnoredByGit(relPath: string, rules: string[]): boolean;
/**
 * Recursively scans directory and collects matching non-TS asset files.
 *
 * @param rootDir - Root directory to scan.
 * @param assetConfig - Asset configuration from tsconfig ({ include, exclude }).
 * @param gitRules - Gitignore rules.
 * @returns Array of relative file paths to copy.
 */
export declare function resolveMatchingAssets(rootDir: string, assetConfig?: AssetConfig, gitRules?: string[]): string[];
/**
 * Copies non-TS asset files into destination directory preserving folder hierarchy.
 *
 * @param rootDir - Root directory path.
 * @param distDir - Target output directory path.
 * @returns Array of relative paths that were copied.
 */
export declare function copyAssets(rootDir?: string, distDir?: string): string[];
//# sourceMappingURL=assetCopier.d.ts.map