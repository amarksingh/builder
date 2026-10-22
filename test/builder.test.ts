import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
    matchesPattern,
    getGitignoreRules,
    isIgnoredByGit,
    resolveMatchingAssets,
    copyAssets
} from '../src/assetCopier';
import { preparePackage, patchDualExports } from '../src/packagePreparer';
import { Builder, builder } from '../src/builder';

describe('@ostro/builder Unit Test Suite', () => {
    let tempDir: string;

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ostro-builder-test-'));
    });

    afterEach(() => {
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    describe('assetCopier: matchesPattern', () => {
        test('handles invalid or empty patterns', () => {
            expect(matchesPattern('any/path', '')).toBe(false);
            expect(matchesPattern('any/path', null as any)).toBe(false);
        });

        test('handles RegExp pattern directly and string regex literal', () => {
            expect(matchesPattern('file.txt', /\.txt$/)).toBe(true);
            expect(matchesPattern('file.txt', '/\\.txt$/')).toBe(true);
            expect(matchesPattern('file.jpg', '/\\.txt$/')).toBe(false);
            expect(matchesPattern('file.txt', '/[invalid(/')).toBe(false);
        });

        test('handles leading dot-slash and slashes', () => {
            expect(matchesPattern('public/app.css', './public/**')).toBe(true);
            expect(matchesPattern('public/app.css', '/public/**')).toBe(true);
        });

        test('matches double star glob with slash and without slash', () => {
            expect(matchesPattern('public/sub/app.css', 'public/**/app.css')).toBe(true);
            expect(matchesPattern('public/app.css', 'public/**')).toBe(true);
        });

        test('matches single star and question mark and special chars', () => {
            expect(matchesPattern('.env.staging', '.env*')).toBe(true);
            expect(matchesPattern('file1.txt', 'file?.txt')).toBe(true);
            expect(matchesPattern('file12.txt', 'file?.txt')).toBe(false);
            expect(matchesPattern('hello+world[1].js', 'hello+world[1].js')).toBe(true);
        });
    });

    describe('assetCopier: getGitignoreRules & isIgnoredByGit', () => {
        test('returns empty array when .gitignore is missing', () => {
            expect(getGitignoreRules(tempDir)).toEqual([]);
        });

        test('parses .gitignore correctly ignoring comments and blanks', () => {
            fs.writeFileSync(path.join(tempDir, '.gitignore'), '# Comment\n\n.env\nnode_modules/\n*.log\n');
            const rules = getGitignoreRules(tempDir);
            expect(rules).toEqual(['.env', 'node_modules/', '*.log']);
        });

        test('tests files against git rules correctly', () => {
            const rules = ['.env', 'logs/', '*.log'];
            expect(isIgnoredByGit('.env', rules)).toBe(true);
            expect(isIgnoredByGit('logs/error.txt', rules)).toBe(true);
            expect(isIgnoredByGit('debug.log', rules)).toBe(true);
            expect(isIgnoredByGit('public/app.js', rules)).toBe(false);
        });
    });

    describe('assetCopier: resolveMatchingAssets & copyAssets', () => {
        test('walk handles non-existent directories gracefully', () => {
            expect(resolveMatchingAssets(path.join(tempDir, 'non_existent'))).toEqual([]);
        });

        test('copies assets honoring includes, excludes, gitignore and defaults', () => {
            // Setup source directory structure
            fs.mkdirSync(path.join(tempDir, 'public', 'css'), { recursive: true });
            fs.mkdirSync(path.join(tempDir, 'node_modules', 'dummy'), { recursive: true });
            fs.writeFileSync(path.join(tempDir, 'node_modules', 'dummy', 'index.js'), 'dummy');
            fs.writeFileSync(path.join(tempDir, 'public', 'css', 'style.css'), 'body {}');
            fs.writeFileSync(path.join(tempDir, 'public', 'robots.txt'), 'User-agent: *');
            fs.writeFileSync(path.join(tempDir, 'public', 'ignore.log'), 'log data');
            fs.writeFileSync(path.join(tempDir, 'public', 'excluded.ts'), 'export const a = 1;');
            fs.writeFileSync(path.join(tempDir, '.env'), 'KEY=val');
            fs.writeFileSync(path.join(tempDir, 'assistant'), '#!/usr/bin/env node');
            fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({
                name: 'test-app',
                main: 'app.ts',
                types: 'app.ts',
                scripts: { 'server:start': 'ts-node app.ts', 'build': 'tsc', 'dev': 'mix' }
            }));
            fs.writeFileSync(path.join(tempDir, '.gitignore'), '*.log\n');

            // Default copy with tsconfig
            fs.writeFileSync(path.join(tempDir, 'tsconfig.json'), JSON.stringify({
                compilerOptions: { outDir: '.dist' },
                assets: {
                    include: ['.env*', 'public/**/*'],
                    exclude: ['**/*.ts', 'node_modules/**']
                }
            }));

            const copied = copyAssets(tempDir);
            expect(copied).toContain('.env');
            expect(copied).toContain('public/robots.txt');
            expect(copied).toContain('public/css/style.css');
            expect(copied).not.toContain('public/ignore.log');
            expect(copied).not.toContain('public/excluded.ts');
            expect(copied).not.toContain('node_modules/dummy/index.js');

            const distDir = path.join(tempDir, '.dist');
            expect(fs.existsSync(path.join(distDir, 'assistant'))).toBe(true);
            expect(fs.existsSync(path.join(distDir, '.env'))).toBe(true);
            expect(fs.existsSync(path.join(distDir, 'public', 'robots.txt'))).toBe(true);
            expect(fs.existsSync(path.join(distDir, 'public', 'css', 'style.css'))).toBe(true);

            const copiedPkg = JSON.parse(fs.readFileSync(path.join(distDir, 'package.json'), 'utf8'));
            expect(copiedPkg.main).toBe('app.js');
            expect(copiedPkg.types).toBeUndefined();
            expect(copiedPkg.scripts['server:start']).toBe('node app.js');
            expect(copiedPkg.scripts.build).toBeUndefined();

            // Calling copyAssets without arguments defaults to process.cwd()
            const origCwd = process.cwd();
            try {
                process.chdir(tempDir);
                expect(copyAssets()).toContain('.env');
                // Also test explicit distDir passed
                expect(copyAssets(tempDir, path.join(tempDir, 'custom-dist'))).toContain('.env');
            } finally {
                process.chdir(origCwd);
            }
        });

        test('copyAssets uses fallback default .dist when tsconfig has no outDir or is invalid', () => {
            fs.writeFileSync(path.join(tempDir, 'tsconfig.json'), 'invalid json');
            fs.writeFileSync(path.join(tempDir, '.env'), 'KEY=val');
            const copied = copyAssets(tempDir);
            expect(copied).toContain('.env');
            expect(fs.existsSync(path.join(tempDir, '.dist', '.env'))).toBe(true);

            // Also test tsconfig without assets and without outDir
            const noOutDirDir = path.join(tempDir, 'no-outdir');
            fs.mkdirSync(noOutDirDir, { recursive: true });
            fs.writeFileSync(path.join(noOutDirDir, 'tsconfig.json'), JSON.stringify({ compilerOptions: {} }));
            fs.writeFileSync(path.join(noOutDirDir, '.env'), 'A=B');
            expect(copyAssets(noOutDirDir)).toContain('.env');
        });
    });

    describe('packagePreparer', () => {
        test('throws error if package.json does not exist', () => {
            expect(() => preparePackage(tempDir)).toThrow('No package.json found');
        });

        test('throws error if build directory does not exist', () => {
            fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({ name: 'test-pkg' }));
            expect(() => preparePackage(tempDir)).toThrow('Build directory does not exist');
        });

        test('handles non-string or unusual bin and exports properties and default pkgDir', () => {
            const weirdDir = path.join(tempDir, 'weird-pkg');
            const weirdBuildDir = path.join(weirdDir, 'build');
            fs.mkdirSync(weirdBuildDir, { recursive: true });
            fs.writeFileSync(path.join(weirdDir, 'package.json'), JSON.stringify({
                name: 'weird-pkg',
                version: '1.0.0',
                bin: {
                    cli: 'build/cli.js',
                    invalid: 123
                },
                main: 12345
            }));
            const pubWeird = preparePackage(weirdDir);
            expect(pubWeird.bin.cli).toBe('cli.js');
            expect(pubWeird.bin.invalid).toBeUndefined();

            // Also test bin: false (boolean)
            const boolBinDir = path.join(tempDir, 'bool-bin');
            fs.mkdirSync(path.join(boolBinDir, 'build'), { recursive: true });
            fs.writeFileSync(path.join(boolBinDir, 'package.json'), JSON.stringify({
                name: 'bool-bin',
                bin: false
            }));
            const pubBool = preparePackage(boolBinDir);
            expect(pubBool.bin).toBe(false);

            // Test preparePackage() defaulting to process.cwd()
            const origCwd = process.cwd();
            try {
                process.chdir(weirdDir);
                const pubDefault = preparePackage();
                expect(pubDefault.bin.cli).toBe('cli.js');
            } finally {
                process.chdir(origCwd);
            }
        });

        test('prepares build directory package.json correctly', () => {
            const buildDir = path.join(tempDir, 'build');
            fs.mkdirSync(buildDir, { recursive: true });

            fs.writeFileSync(path.join(tempDir, 'README.md'), '# Readme');
            fs.writeFileSync(path.join(tempDir, 'LICENSE'), 'MIT');
            fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({
                name: 'test-pkg',
                version: '1.0.0',
                main: 'build/index.js',
                types: 'build/types/index.d.ts',
                bin: {
                    cli: 'build/bin/cli.js',
                    other: 'build/bin/other.js'
                },
                exports: {
                    '.': {
                        types: './build/types/index.d.ts',
                        default: './build/index.js'
                    },
                    './sub': ['build/sub.js'],
                    './number': 123
                },
                scripts: { test: 'jest' },
                devDependencies: { jest: '^29.0.0' },
                files: ['build']
            }));

            // Test string bin format too
            const stringBinDir = path.join(tempDir, 'bin-pkg');
            const stringBuildDir = path.join(stringBinDir, 'build');
            fs.mkdirSync(stringBuildDir, { recursive: true });
            fs.writeFileSync(path.join(stringBinDir, 'package.json'), JSON.stringify({
                name: 'bin-pkg',
                version: '1.0.0',
                bin: 'build/cli.js'
            }));
            const pubStringPkg = preparePackage(stringBinDir);
            expect(pubStringPkg.bin).toBe('cli.js');

            const pubPkg = preparePackage(tempDir);
            expect(pubPkg.devDependencies).toBeUndefined();
            expect(pubPkg.scripts).toBeUndefined();
            expect(pubPkg.files).toBeUndefined();
            expect(pubPkg.main).toBe('index.js');
            expect(pubPkg.types).toBe('types/index.d.ts');
            expect(pubPkg.bin.cli).toBe('bin/cli.js');
            expect(pubPkg.exports['.']).toEqual({ types: './types/index.d.ts', default: './index.js' });
            expect(pubPkg.exports['./sub']).toEqual(['./sub.js']);
            expect(pubPkg.exports['./number']).toBe(123);

            expect(fs.existsSync(path.join(buildDir, 'README.md'))).toBe(true);
            expect(fs.existsSync(path.join(buildDir, 'LICENSE'))).toBe(true);
        });

        test('patchDualExports patches files correctly and handles subdirectories', () => {
            const buildDir = path.join(tempDir, 'build');
            const subDir = path.join(buildDir, 'sub');
            fs.mkdirSync(subDir, { recursive: true });

            fs.writeFileSync(path.join(buildDir, 'index.js'), 'exports.default = 123;');
            fs.writeFileSync(path.join(subDir, 'sub.js'), 'exports.default = 456;');
            fs.writeFileSync(path.join(buildDir, 'index.d.ts'), 'export default 123;');

            patchDualExports(buildDir);

            const indexContent = fs.readFileSync(path.join(buildDir, 'index.js'), 'utf8');
            expect(indexContent).toContain('module.exports = d;');
            const subContent = fs.readFileSync(path.join(subDir, 'sub.js'), 'utf8');
            expect(subContent).toContain('module.exports = d;');

            // Running again should not duplicate
            patchDualExports(buildDir);
            const indexContentSecond = fs.readFileSync(path.join(buildDir, 'index.js'), 'utf8');
            expect(indexContentSecond).toBe(indexContent);

            // Calling on non-existent dir should not throw
            expect(() => patchDualExports(path.join(tempDir, 'non_existent'))).not.toThrow();
        });
    });

    describe('Builder', () => {
        test('runCommand executes command synchronously', () => {
            const b = new Builder();
            expect(() => b.runCommand('node -e "process.exit(0)"', tempDir)).not.toThrow();
        });

        test('build coordinates tsc, assets copying and preparePackage', () => {
            const b = new Builder();
            const runCmdSpy = jest.spyOn(b, 'runCommand').mockImplementation(() => {});

            fs.writeFileSync(path.join(tempDir, 'tsconfig.json'), JSON.stringify({
                compilerOptions: { outDir: 'build' }
            }));
            fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({
                name: 'test-build',
                version: '1.0.0'
            }));
            fs.mkdirSync(path.join(tempDir, 'build'), { recursive: true });

            b.build({ rootDir: tempDir, prepare: true });

            expect(runCmdSpy).toHaveBeenCalledWith('npx tsc -p tsconfig.json', tempDir);
            expect(fs.existsSync(path.join(tempDir, 'build', 'package.json'))).toBe(true);
        });

        test('build coordinates with default options (process.cwd and tsconfig.build.json detection)', () => {
            const b = new Builder();
            const runCmdSpy = jest.spyOn(b, 'runCommand').mockImplementation(() => {});

            // Create tsconfig.build.json in tempDir
            fs.writeFileSync(path.join(tempDir, 'tsconfig.build.json'), JSON.stringify({
                compilerOptions: { outDir: 'build' }
            }));
            fs.mkdirSync(path.join(tempDir, 'build'), { recursive: true });

            b.build({ rootDir: tempDir });
            expect(runCmdSpy).toHaveBeenCalledWith('npx tsc -p tsconfig.build.json', tempDir);

            // Default without options calls process.cwd
            const origCwd = process.cwd();
            try {
                process.chdir(tempDir);
                b.build();
                expect(runCmdSpy).toHaveBeenCalledWith('npx tsc -p tsconfig.build.json', tempDir);
            } finally {
                process.chdir(origCwd);
            }
        });

        test('build respects copyAssetsOnly flag and custom project config', () => {
            const b = new Builder();
            const runCmdSpy = jest.spyOn(b, 'runCommand').mockImplementation(() => {});

            fs.writeFileSync(path.join(tempDir, 'tsconfig.custom.json'), JSON.stringify({
                compilerOptions: { outDir: 'build' }
            }));

            b.build({ rootDir: tempDir, copyAssetsOnly: true, projectConfig: 'tsconfig.custom.json' });

            expect(runCmdSpy).not.toHaveBeenCalled();
        });

        test('exported singleton builder instance is defined', () => {
            expect(builder).toBeInstanceOf(Builder);
        });
    });
});
