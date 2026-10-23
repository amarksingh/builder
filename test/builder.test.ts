import fs from 'fs';
import path from 'path';
import os from 'os';
import {
    matchesPattern,
    resolveMatchingAssets,
    copyAssets
} from '../src/assetCopier';
import { preparePackage, patchDualExports, relocateSourceMaps } from '../src/packagePreparer';
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

    describe('assetCopier: resolveMatchingAssets & copyAssets', () => {
        test('walk handles non-existent directories gracefully', () => {
            expect(resolveMatchingAssets(path.join(tempDir, 'non_existent'), { include: ['**/*'] })).toEqual([]);
        });

        test('returns empty array when include is not configured', () => {
            expect(resolveMatchingAssets(tempDir)).toEqual([]);
            expect(resolveMatchingAssets(tempDir, {})).toEqual([]);
        });

        test('copies assets honoring includes, excludes, ignoredDirs from tsconfig', () => {
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
                main: 'app.ts'
            }));

            // Configuration with explicit assets include
            fs.writeFileSync(path.join(tempDir, 'tsconfig.json'), JSON.stringify({
                compilerOptions: { outDir: '.dist' },
                exclude: ['node_modules', '.dist', 'build', 'public/ignore.log'],
                assets: {
                    include: ['package.json', 'assistant', '.env*', 'public/**/*'],
                    exclude: ['**/*.ts']
                }
            }));

            const copied = copyAssets(tempDir);
            expect(copied).toContain('package.json');
            expect(copied).toContain('assistant');
            expect(copied).toContain('.env');
            expect(copied).toContain('public/robots.txt');
            expect(copied).toContain('public/css/style.css');
            expect(copied).not.toContain('public/excluded.ts');
            expect(copied).not.toContain('node_modules/dummy/index.js');

            const distDir = path.join(tempDir, '.dist');
            expect(fs.existsSync(path.join(distDir, 'package.json'))).toBe(true);
            expect(fs.existsSync(path.join(distDir, 'assistant'))).toBe(true);
            expect(fs.existsSync(path.join(distDir, '.env'))).toBe(true);
            expect(fs.existsSync(path.join(distDir, 'public', 'robots.txt'))).toBe(true);
            expect(fs.existsSync(path.join(distDir, 'public', 'css', 'style.css'))).toBe(true);

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

        test('copyAssets throws error when outDir is not defined in tsconfig or options', () => {
            fs.writeFileSync(path.join(tempDir, 'tsconfig.json'), 'invalid json');
            expect(() => copyAssets(tempDir)).toThrow('Output directory (outDir) is not defined in tsconfig.json or options');

            // Also test tsconfig without outDir
            const noOutDirDir = path.join(tempDir, 'no-outdir');
            fs.mkdirSync(noOutDirDir, { recursive: true });
            fs.writeFileSync(path.join(noOutDirDir, 'tsconfig.json'), JSON.stringify({ compilerOptions: {} }));
            expect(() => copyAssets(noOutDirDir)).toThrow('Output directory (outDir) is not defined in tsconfig.json or options');

            // Test valid tsconfig with outDir but without assets include
            const validOutDir = path.join(tempDir, 'valid-outdir');
            fs.mkdirSync(validOutDir, { recursive: true });
            fs.writeFileSync(path.join(validOutDir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { outDir: '.dist' } }));
            expect(copyAssets(validOutDir)).toEqual([]);

            // Test copyAssets when tsconfig is missing but explicit distDir is provided
            const missingTsconfigDir = path.join(tempDir, 'missing-tsconfig');
            fs.mkdirSync(missingTsconfigDir, { recursive: true });
            expect(copyAssets(missingTsconfigDir, path.join(missingTsconfigDir, 'custom-dist'))).toEqual([]);
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
                expect(pubDefault.name).toBe('weird-pkg');
            } finally {
                process.chdir(origCwd);
            }
        });

        test('prepares build directory package.json correctly', () => {
            const pkgData = {
                name: '@ostro/sample',
                version: '1.0.0',
                main: './build/index.js',
                types: './build/index.d.ts',
                bin: 'build/cli.js',
                scripts: { test: 'jest', build: 'tsc' },
                devDependencies: { typescript: '^5.0.0' },
                files: ['build'],
                exports: {
                    '.': {
                        types: './build/index.d.ts',
                        default: './build/index.js'
                    },
                    './feature': './build/feature.js',
                    './array': ['./build/one.js', './build/two.js']
                }
            };

            const buildDir = path.join(tempDir, 'build');
            fs.mkdirSync(buildDir, { recursive: true });
            fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(pkgData));
            fs.writeFileSync(path.join(tempDir, 'README.md'), '# Sample');
            fs.writeFileSync(path.join(tempDir, 'LICENSE.md'), 'MIT');
            fs.writeFileSync(path.join(tempDir, 'LICENSE'), 'MIT');

            // Also test string bin in a separate subfolder
            const stringBinDir = path.join(tempDir, 'string-bin');
            fs.mkdirSync(path.join(stringBinDir, 'build'), { recursive: true });
            fs.writeFileSync(path.join(stringBinDir, 'package.json'), JSON.stringify({
                name: 'str-bin',
                bin: 'build/bin.js'
            }));
            const pubStringPkg = preparePackage(stringBinDir);
            expect(pubStringPkg.bin).toBe('bin.js');

            const pubPkg = preparePackage(tempDir);

            expect(pubPkg.devDependencies).toBeUndefined();
            expect(pubPkg.scripts).toBeUndefined();
            expect(pubPkg.files).toBeUndefined();
            expect(pubPkg.main).toBe('index.js');
            expect(pubPkg.types).toBe('index.d.ts');
            expect(pubPkg.bin).toBe('cli.js');
            expect(pubPkg.exports['.']).toEqual({
                types: './index.d.ts',
                default: './index.js'
            });
            expect(pubPkg.exports['./feature']).toBe('./feature.js');
            expect(pubPkg.exports['./array']).toEqual(['./one.js', './two.js']);

            expect(fs.existsSync(path.join(buildDir, 'README.md'))).toBe(true);
            expect(fs.existsSync(path.join(buildDir, 'LICENSE.md'))).toBe(true);
            expect(fs.existsSync(path.join(buildDir, 'LICENSE'))).toBe(true);
        });

        test('patchDualExports patches files correctly and handles subdirectories', () => {
            const buildDir = path.join(tempDir, 'build');
            const subDir = path.join(buildDir, 'sub');
            fs.mkdirSync(subDir, { recursive: true });

            // File requiring patch
            const jsFile = path.join(subDir, 'example.js');
            fs.writeFileSync(jsFile, 'exports.default = 123;\n');

            // File already patched
            const alreadyPatched = path.join(subDir, 'patched.js');
            fs.writeFileSync(alreadyPatched, 'exports.default = 123;\nmodule.exports = d;\n');

            // .d.ts file (should not be patched)
            const dtsFile = path.join(subDir, 'types.d.ts');
            fs.writeFileSync(dtsFile, 'export default interface Test {}\n');

            patchDualExports(buildDir);

            const content = fs.readFileSync(jsFile, 'utf8');
            expect(content).toContain('module.exports = d;');
            expect(content).toContain('module.exports.default = d;');

            // Verify non-existent dir handles gracefully
            expect(() => patchDualExports(path.join(tempDir, 'non_existent'))).not.toThrow();
        });

        test('relocateSourceMaps moves .js.map files to maps/ directory and updates references', () => {
            const buildDir = path.join(tempDir, 'build');
            const subDir = path.join(buildDir, 'controllers');
            fs.mkdirSync(subDir, { recursive: true });

            const jsFile = path.join(subDir, 'userController.js');
            const mapFile = path.join(subDir, 'userController.js.map');

            const sourceMapContent = {
                version: 3,
                file: 'userController.js',
                sources: ['../../src/controllers/userController.ts'],
                mappings: 'AAAA;'
            };

            fs.writeFileSync(jsFile, 'function test() {}\n//# sourceMappingURL=userController.js.map\n');
            fs.writeFileSync(mapFile, JSON.stringify(sourceMapContent));

            relocateSourceMaps(buildDir);

            // Map should have moved
            expect(fs.existsSync(mapFile)).toBe(false);
            const expectedMapPath = path.join(buildDir, 'maps', 'controllers', 'userController.js.map');
            expect(fs.existsSync(expectedMapPath)).toBe(true);

            // JS file should point to new relative map path
            const updatedJs = fs.readFileSync(jsFile, 'utf8');
            expect(updatedJs).toContain('sourceMappingURL=../maps/controllers/userController.js.map');

            // Test JS file without existing sourceMappingURL comment
            const jsNoComment = path.join(subDir, 'noComment.js');
            const mapNoComment = path.join(subDir, 'noComment.js.map');
            fs.writeFileSync(jsNoComment, 'const x = 1;\n');
            fs.writeFileSync(mapNoComment, JSON.stringify({ version: 3, sources: [] }));

            relocateSourceMaps(buildDir);
            const updatedNoCommentJs = fs.readFileSync(jsNoComment, 'utf8');
            expect(updatedNoCommentJs).toContain('//# sourceMappingURL=../maps/controllers/noComment.js.map');

            // Test map without sources property and without matching JS file
            const orphanMap = path.join(subDir, 'orphan.js.map');
            fs.writeFileSync(orphanMap, JSON.stringify({ version: 3 }));
            relocateSourceMaps(buildDir);
            expect(fs.existsSync(path.join(buildDir, 'maps', 'controllers', 'orphan.js.map'))).toBe(true);

            // Non-existent directory handling
            expect(() => relocateSourceMaps(path.join(tempDir, 'non_existent'))).not.toThrow();
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
            fs.mkdirSync(path.join(tempDir, 'build'), { recursive: true });
            fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({
                name: 'test-build',
                version: '1.0.0'
            }));

            b.build({ rootDir: tempDir, prepare: true });

            expect(runCmdSpy).toHaveBeenCalledWith('npx tsc -p tsconfig.json', tempDir);
            expect(fs.existsSync(path.join(tempDir, 'build', 'package.json'))).toBe(true);
        });

        test('build coordinates with default options (process.cwd and tsconfig.json)', () => {
            const b = new Builder();
            const runCmdSpy = jest.spyOn(b, 'runCommand').mockImplementation(() => {});

            fs.writeFileSync(path.join(tempDir, 'tsconfig.json'), JSON.stringify({
                compilerOptions: { outDir: 'build' }
            }));
            fs.mkdirSync(path.join(tempDir, 'build'), { recursive: true });

            b.build({ rootDir: tempDir });
            expect(runCmdSpy).toHaveBeenCalledWith('npx tsc -p tsconfig.json', tempDir);

            // Default without options calls process.cwd
            const origCwd = process.cwd();
            try {
                process.chdir(tempDir);
                b.build();
                expect(runCmdSpy).toHaveBeenCalledWith('npx tsc -p tsconfig.json', tempDir);
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
