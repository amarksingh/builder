"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchesPattern = matchesPattern;
exports.resolveMatchingAssets = resolveMatchingAssets;
exports.copyAssets = copyAssets;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
/**
 * Checks whether a relative path matches a glob or regex pattern string.
 *
 * @param relPath - Relative file path (e.g. 'public/css/app.css').
 * @param pattern - Glob string (e.g. '.env*', 'public/**\/*') or regex literal ('/\\.png$/').
 * @returns boolean
 */
function matchesPattern(relPath, pattern) {
    if (!pattern)
        return false;
    if (pattern instanceof RegExp)
        return pattern.test(relPath);
    let p = pattern.trim();
    if (p.startsWith('/') && p.endsWith('/') && p.length > 2) {
        try {
            return new RegExp(p.slice(1, -1)).test(relPath);
        }
        catch (_) { }
    }
    if (p.startsWith('./'))
        p = p.slice(2);
    p = p.replace(/^\//, '');
    let regexStr = '^';
    let i = 0;
    while (i < p.length) {
        const c = p[i];
        if (c === '*' && p[i + 1] === '*') {
            if (p[i + 2] === '/') {
                regexStr += '(?:.*/)?';
                i += 3;
            }
            else {
                regexStr += '.*';
                i += 2;
            }
        }
        else if (c === '*') {
            regexStr += '[^/]*';
            i += 1;
        }
        else if (c === '?') {
            regexStr += '[^/]';
            i += 1;
        }
        else if (['.', '+', '^', '$', '{', '}', '(', ')', '|', '[', ']', '\\'].includes(c)) {
            regexStr += '\\' + c;
            i += 1;
        }
        else {
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
function resolveMatchingAssets(rootDir, assetConfig = {}, ignoredDirs = []) {
    const includePatterns = assetConfig.include || [];
    const excludePatterns = assetConfig.exclude || [];
    if (includePatterns.length === 0) {
        return [];
    }
    const matchedFiles = new Set();
    function walk(dir) {
        if (!fs_1.default.existsSync(dir))
            return;
        const entries = fs_1.default.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path_1.default.join(dir, entry.name);
            const relPath = path_1.default.relative(rootDir, fullPath).replace(/\\/g, '/');
            if (entry.isDirectory()) {
                const isIgnored = ignoredDirs.some((d) => {
                    const cleanD = d.replace(/^\.\//, '').replace(/\/$/, '');
                    return entry.name === cleanD || relPath === cleanD || matchesPattern(relPath, d);
                });
                if (!isIgnored) {
                    walk(fullPath);
                }
            }
            else {
                const isExcluded = excludePatterns.some((pat) => matchesPattern(relPath, pat));
                if (!isExcluded) {
                    const isIncluded = includePatterns.some((pat) => matchesPattern(relPath, pat));
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
function copyAssets(rootDir = process.cwd(), distDir, configPath = 'tsconfig.json') {
    const tsconfigJsonPath = path_1.default.resolve(rootDir, configPath);
    let assetConfig = {};
    let resolvedDistDir = distDir || '';
    let ignoredDirs = [];
    if (fs_1.default.existsSync(tsconfigJsonPath)) {
        try {
            const tsconfig = JSON.parse(fs_1.default.readFileSync(tsconfigJsonPath, 'utf8'));
            if (tsconfig.assets) {
                assetConfig = tsconfig.assets;
            }
            if (!resolvedDistDir && tsconfig.compilerOptions && tsconfig.compilerOptions.outDir) {
                resolvedDistDir = path_1.default.resolve(rootDir, tsconfig.compilerOptions.outDir);
            }
            if (Array.isArray(tsconfig.exclude)) {
                ignoredDirs = [...tsconfig.exclude];
            }
        }
        catch (_) { }
    }
    if (!resolvedDistDir) {
        throw new Error('Output directory (outDir) is not defined in tsconfig.json or options');
    }
    const distBaseName = path_1.default.basename(resolvedDistDir);
    if (!ignoredDirs.includes(distBaseName)) {
        ignoredDirs.push(distBaseName);
    }
    if (!fs_1.default.existsSync(resolvedDistDir)) {
        fs_1.default.mkdirSync(resolvedDistDir, { recursive: true });
    }
    const filesToCopy = resolveMatchingAssets(rootDir, assetConfig, ignoredDirs);
    for (const relFile of filesToCopy) {
        const srcFile = path_1.default.join(rootDir, relFile);
        const destFile = path_1.default.join(resolvedDistDir, relFile);
        const destFolder = path_1.default.dirname(destFile);
        if (!fs_1.default.existsSync(destFolder)) {
            fs_1.default.mkdirSync(destFolder, { recursive: true });
        }
        fs_1.default.copyFileSync(srcFile, destFile);
    }
    return filesToCopy;
}
//# sourceMappingURL=.maps/assetCopier.js.map