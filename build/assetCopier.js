"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchesPattern = matchesPattern;
exports.getGitignoreRules = getGitignoreRules;
exports.isIgnoredByGit = isIgnoredByGit;
exports.resolveMatchingAssets = resolveMatchingAssets;
exports.copyAssets = copyAssets;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
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
 * Parses gitignore rules from .gitignore file into an array of clean pattern strings.
 *
 * @param rootDir - Root directory where .gitignore lives.
 * @returns Array of gitignore rules.
 */
function getGitignoreRules(rootDir) {
    const gitignorePath = path.join(rootDir, '.gitignore');
    if (!fs.existsSync(gitignorePath))
        return [];
    return fs.readFileSync(gitignorePath, 'utf8')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => Boolean(l) && !l.startsWith('#'));
}
/**
 * Checks if a relative file path is ignored by gitignore rules.
 *
 * @param relPath - Relative file path to test.
 * @param rules - Array of gitignore rules.
 * @returns boolean
 */
function isIgnoredByGit(relPath, rules) {
    const norm = relPath.replace(/^\//, '');
    for (const r of rules) {
        const clean = r.replace(/^\//, '').replace(/\/$/, '');
        if (norm === clean || norm.startsWith(clean + '/'))
            return true;
        if (clean.startsWith('*') && norm.endsWith(clean.slice(1)))
            return true;
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
function resolveMatchingAssets(rootDir, assetConfig = {}, gitRules = []) {
    const includePatterns = assetConfig.include || ['.env*', 'public/**/*', 'resources/views/**/*'];
    const excludePatterns = assetConfig.exclude || ['**/*.ts', 'node_modules/**', '.dist/**', 'build/**', 'test/**'];
    const matchedFiles = new Set();
    function walk(dir) {
        if (!fs.existsSync(dir))
            return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const relPath = path.relative(rootDir, fullPath).replace(/\\/g, '/');
            if (entry.isDirectory()) {
                if (!['node_modules', '.dist', 'build', '.git'].includes(entry.name)) {
                    walk(fullPath);
                }
            }
            if (entry.isFile()) {
                if (!isIgnoredByGit(relPath, gitRules)) {
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
function copyAssets(rootDir = process.cwd(), distDir) {
    const tsconfigPath = path.join(rootDir, 'tsconfig.json');
    let assetConfig = {};
    let resolvedDistDir = distDir || '';
    if (fs.existsSync(tsconfigPath)) {
        try {
            const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
            if (tsconfig.assets) {
                assetConfig = tsconfig.assets;
            }
            if (!resolvedDistDir && tsconfig.compilerOptions && tsconfig.compilerOptions.outDir) {
                resolvedDistDir = path.resolve(rootDir, tsconfig.compilerOptions.outDir);
            }
        }
        catch (_) { }
    }
    if (!resolvedDistDir) {
        resolvedDistDir = path.join(rootDir, '.dist');
    }
    if (!fs.existsSync(resolvedDistDir)) {
        fs.mkdirSync(resolvedDistDir, { recursive: true });
    }
    const gitRules = getGitignoreRules(rootDir);
    // Copy assistant executable if present
    const assistantSrc = path.join(rootDir, 'assistant');
    if (fs.existsSync(assistantSrc)) {
        const assistantDist = path.join(resolvedDistDir, 'assistant');
        fs.copyFileSync(assistantSrc, assistantDist);
        try {
            fs.chmodSync(assistantDist, 0o755);
        }
        catch (_) { }
    }
    // Copy package.json with entrypoint adapted to app.js if root has app.ts
    const pkgSrc = path.join(rootDir, 'package.json');
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
        }
        catch (_) { }
    }
    const filesToCopy = resolveMatchingAssets(rootDir, assetConfig, gitRules);
    for (const relFile of filesToCopy) {
        const srcFile = path.join(rootDir, relFile);
        const destFile = path.join(resolvedDistDir, relFile);
        const destFolder = path.dirname(destFile);
        if (!fs.existsSync(destFolder)) {
            fs.mkdirSync(destFolder, { recursive: true });
        }
        fs.copyFileSync(srcFile, destFile);
    }
    return filesToCopy;
}
//# sourceMappingURL=assetCopier.js.map