import fs from 'fs';
import path from 'path';

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
    exclude?: string[];
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
export function matchesPattern(relPath: string, pattern: string | RegExp): boolean {
    if (!pattern) return false;
    if (pattern instanceof RegExp) return pattern.test(relPath);
    let p: string = pattern.trim();
    if (p.startsWith('/') && p.endsWith('/') && p.length > 2) {
        try {
            return new RegExp(p.slice(1, -1)).test(relPath);
        } catch (_) { }
    }
    if (p.startsWith('./')) p = p.slice(2);
    p = p.replace(/^\//, '');

    let regexStr: string = '^';
    let i: number = 0;
    while (i < p.length) {
        const c: string = p[i];
        if (c === '*' && p[i + 1] === '*') {
            if (p[i + 2] === '/') {
                regexStr += '(?:.*/)?';
                i += 3;
            } else {
                regexStr += '.*';
                i += 2;
            }
        } else if (c === '*') {
            regexStr += '[^/]*';
            i += 1;
        } else if (c === '?') {
            regexStr += '[^/]';
            i += 1;
        } else if (['.', '+', '^', '$', '{', '}', '(', ')', '|', '[', ']', '\\'].includes(c)) {
            regexStr += '\\' + c;
            i += 1;
        } else {
            regexStr += c;
            i += 1;
        }
    }
    regexStr += '$';
    return new RegExp(regexStr).test(relPath);
}

/**
 * Recursively scans directory and collects matching non-TS asset files.
 *
 * @param rootDir - Root directory to scan.
 * @param assetConfig - Asset configuration from tsconfig ({ include, exclude }).
 * @param ignoredDirs - Directories to ignore when traversing.
 * @returns Array of relative file paths to copy.
 */
export function resolveMatchingAssets(
    rootDir: string,
    assetConfig: AssetConfig = {},
    ignoredDirs: string[] = []
): string[] {
    const includePatterns: string[] = assetConfig.include || [];
    const excludePatterns: string[] = assetConfig.exclude || [];

    if (includePatterns.length === 0) {
        return [];
    }

    const matchedFiles: Set<string> = new Set<string>();

    function walk(dir: string): void {
        if (!fs.existsSync(dir)) return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath: string = path.join(dir, entry.name);
            const relPath: string = path.relative(rootDir, fullPath).replace(/\\/g, '/');

            if (entry.isDirectory()) {
                const isIgnored = ignoredDirs.some((d: string) => {
                    const cleanD = d.replace(/^\.\//, '').replace(/\/$/, '');
                    return entry.name === cleanD || relPath === cleanD || matchesPattern(relPath, d);
                });
                if (!isIgnored) {
                    walk(fullPath);
                }
            } else {
                const isExcluded: boolean = excludePatterns.some((pat: string) => matchesPattern(relPath, pat));
                if (!isExcluded) {
                    const isIncluded: boolean = includePatterns.some((pat: string) => matchesPattern(relPath, pat));
                    if (isIncluded) {
                        matchedFiles.add(relPath);
                    }
                }
            }
        }
    }

    walk(rootDir);
    return Array.from(matchedFiles);
}

/**
 * Copies asset files into destination directory preserving folder hierarchy.
 *
 * @param rootDir - Root directory path.
 * @param distDir - Target output directory path.
 * @returns Array of relative paths that were copied.
 */
export function copyAssets(
    rootDir: string = process.cwd(),
    distDir?: string,
    configPath: string = 'tsconfig.json'
): string[] {
    const tsconfigJsonPath: string = path.resolve(rootDir, configPath);
    let assetConfig: AssetConfig = {};
    let resolvedDistDir: string = distDir || '';
    let ignoredDirs: string[] = [];

    if (fs.existsSync(tsconfigJsonPath)) {
        try {
            const tsconfig: TsConfig = JSON.parse(fs.readFileSync(tsconfigJsonPath, 'utf8'));
            if (tsconfig.assets) {
                assetConfig = tsconfig.assets;
            }
            if (!resolvedDistDir && tsconfig.compilerOptions && tsconfig.compilerOptions.outDir) {
                resolvedDistDir = path.resolve(rootDir, tsconfig.compilerOptions.outDir);
            }
            if (Array.isArray(tsconfig.exclude)) {
                ignoredDirs = [...tsconfig.exclude];
            }
        } catch (_) { }
    }

    if (!resolvedDistDir) {
        throw new Error('Output directory (outDir) is not defined in tsconfig.json or options');
    }

    const distBaseName: string = path.basename(resolvedDistDir);
    if (!ignoredDirs.includes(distBaseName)) {
        ignoredDirs.push(distBaseName);
    }

    if (!fs.existsSync(resolvedDistDir)) {
        fs.mkdirSync(resolvedDistDir, { recursive: true });
    }

    const filesToCopy: string[] = resolveMatchingAssets(rootDir, assetConfig, ignoredDirs);
    for (const relFile of filesToCopy) {
        const srcFile: string = path.join(rootDir, relFile);
        const destFile: string = path.join(resolvedDistDir, relFile);
        const destFolder: string = path.dirname(destFile);
        if (!fs.existsSync(destFolder)) {
            fs.mkdirSync(destFolder, { recursive: true });
        }
        let content: string | null = null;
        try {
            content = fs.readFileSync(srcFile, 'utf8');
        } catch (_) { }

        const tsNodeBlockRegex: RegExp = /\n?\/\/\s*Ensure ts-node is registered for TypeScript execution\s*\ntry\s*\{\s*const tsNode = require\(['"]ts-node['"]\);\s*if \(!tsNode\[Symbol\.for\(['"]ts-node\.register\.instance['"]\)\]\) \{\s*tsNode\.register\(\{\s*transpileOnly:\s*true\s*\}\);\s*\}\s*\}\s*catch \(_\) \{\s*\}\s*\n?/g;
        if (content !== null && tsNodeBlockRegex.test(content)) {
            fs.writeFileSync(destFile, content.replace(tsNodeBlockRegex, '\n'));
        } else {
            fs.copyFileSync(srcFile, destFile);
        }
    }

    return filesToCopy;
}
