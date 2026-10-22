import * as fs from 'fs';
import * as path from 'path';

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
 * Parses gitignore rules from .gitignore file into an array of clean pattern strings.
 *
 * @param rootDir - Root directory where .gitignore lives.
 * @returns Array of gitignore rules.
 */
export function getGitignoreRules(rootDir: string): string[] {
    const gitignorePath: string = path.join(rootDir, '.gitignore');
    if (!fs.existsSync(gitignorePath)) return [];
    return fs.readFileSync(gitignorePath, 'utf8')
        .split('\n')
        .map((l: string) => l.trim())
        .filter((l: string) => Boolean(l) && !l.startsWith('#'));
}

/**
 * Checks if a relative file path is ignored by gitignore rules.
 *
 * @param relPath - Relative file path to test.
 * @param rules - Array of gitignore rules.
 * @returns boolean
 */
export function isIgnoredByGit(relPath: string, rules: string[]): boolean {
    const norm: string = relPath.replace(/^\//, '');
    for (const r of rules) {
        const clean: string = r.replace(/^\//, '').replace(/\/$/, '');
        if (norm === clean || norm.startsWith(clean + '/')) return true;
        if (clean.startsWith('*') && norm.endsWith(clean.slice(1))) return true;
    }
    return false;
}

/**
 * Recursively scans directory and collects matching non-TS asset files.
 *
 * @param rootDir - Root directory to scan.
 * @param assetConfig - Asset configuration from tsconfig ({ include, exclude }).
 * @param gitRules - Gitignore rules.
 * @returns Array of relative file paths to copy.
 */
export function resolveMatchingAssets(
    rootDir: string,
    assetConfig: AssetConfig = {},
    gitRules: string[] = []
): string[] {
    const includePatterns: string[] = assetConfig.include || ['.env*', 'public/**/*', 'resources/views/**/*'];
    const excludePatterns: string[] = assetConfig.exclude || ['**/*.ts', 'node_modules/**', '.dist/**', 'build/**', 'test/**'];

    const matchedFiles: Set<string> = new Set<string>();

    function walk(dir: string): void {
        if (!fs.existsSync(dir)) return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath: string = path.join(dir, entry.name);
            const relPath: string = path.relative(rootDir, fullPath).replace(/\\/g, '/');

            if (entry.isDirectory()) {
                if (!['node_modules', '.dist', 'build', '.git'].includes(entry.name)) {
                    walk(fullPath);
                }
            }
            if (entry.isFile()) {
                if (!isIgnoredByGit(relPath, gitRules)) {
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
    }

    walk(rootDir);
    return Array.from(matchedFiles);
}

/**
 * Copies non-TS asset files into destination directory preserving folder hierarchy.
 *
 * @param rootDir - Root directory path.
 * @param distDir - Target output directory path.
 * @returns Array of relative paths that were copied.
 */
export function copyAssets(
    rootDir: string = process.cwd(),
    distDir?: string
): string[] {
    const tsconfigPath: string = path.join(rootDir, 'tsconfig.json');
    let assetConfig: AssetConfig = {};
    let resolvedDistDir: string = distDir || '';

    if (fs.existsSync(tsconfigPath)) {
        try {
            const tsconfig: TsConfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
            if (tsconfig.assets) {
                assetConfig = tsconfig.assets;
            }
            if (!resolvedDistDir && tsconfig.compilerOptions && tsconfig.compilerOptions.outDir) {
                resolvedDistDir = path.resolve(rootDir, tsconfig.compilerOptions.outDir);
            }
        } catch (_) { }
    }

    if (!resolvedDistDir) {
        resolvedDistDir = path.join(rootDir, '.dist');
    }

    if (!fs.existsSync(resolvedDistDir)) {
        fs.mkdirSync(resolvedDistDir, { recursive: true });
    }

    const gitRules: string[] = getGitignoreRules(rootDir);

    // Copy assistant executable if present
    const assistantSrc: string = path.join(rootDir, 'assistant');
    if (fs.existsSync(assistantSrc)) {
        const assistantDist: string = path.join(resolvedDistDir, 'assistant');
        fs.copyFileSync(assistantSrc, assistantDist);
        try {
            fs.chmodSync(assistantDist, 0o755);
        } catch (_) { }
    }

    // Copy package.json with entrypoint adapted to app.js if root has app.ts
    const pkgSrc: string = path.join(rootDir, 'package.json');
    if (fs.existsSync(pkgSrc) && !isIgnoredByGit('package.json', gitRules)) {
        try {
            const pkg = JSON.parse(fs.readFileSync(pkgSrc, 'utf8'));
            pkg.main = 'app.js';
            delete pkg.types;
            if (pkg.scripts) {
                pkg.scripts['server:start'] = 'node app.js';
                delete pkg.scripts.build;
                delete pkg.scripts['build:clean'];
                delete pkg.scripts.dev;
                delete pkg.scripts.watch;
            }
            fs.writeFileSync(path.join(resolvedDistDir, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
        } catch (_) { }
    }

    const filesToCopy: string[] = resolveMatchingAssets(rootDir, assetConfig, gitRules);
    for (const relFile of filesToCopy) {
        const srcFile: string = path.join(rootDir, relFile);
        const destFile: string = path.join(resolvedDistDir, relFile);
        const destFolder: string = path.dirname(destFile);
        if (!fs.existsSync(destFolder)) {
            fs.mkdirSync(destFolder, { recursive: true });
        }
        fs.copyFileSync(srcFile, destFile);
    }

    return filesToCopy;
}
