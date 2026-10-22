/**
 * Prepares the build directory for publication by cleaning package.json and patching dual exports.
 *
 * @param pkgDir - Package root directory (defaults to process.cwd()).
 * @returns Prepared package.json object.
 */
export declare function preparePackage(pkgDir?: string): Record<string, any>;
/**
 * Patches CJS and ESM dual export compatibility on compiled JavaScript files.
 *
 * @param dir - Directory containing built JS files.
 */
export declare function patchDualExports(dir: string): void;
//# sourceMappingURL=packagePreparer.d.ts.map