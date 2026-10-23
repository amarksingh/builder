/**
 * Prepares the build directory for publication by cleaning package.json and patching dual exports.
 *
 * @param pkgDir - Package root directory (defaults to process.cwd()).
 * @returns Prepared package.json object.
 */
export declare function preparePackage(pkgDir?: string): Record<string, any>;
/**
 * Relocates emitted .js.map source map files into a dedicated maps/ directory within buildDir.
 * Updates sourceMappingURL in corresponding .js files and preserves source paths in source maps.
 *
 * @param buildDir - The build output directory.
 */
export declare function relocateSourceMaps(buildDir: string): void;
/**
 * Patches CJS and ESM dual export compatibility on compiled JavaScript files.
 *
 * @param dir - Directory containing built JS files.
 */
export declare function patchDualExports(dir: string): void;
//# sourceMappingURL=packagePreparer.d.ts.map