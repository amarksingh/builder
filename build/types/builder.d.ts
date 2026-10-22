export interface BuildOptions {
    rootDir?: string;
    projectConfig?: string;
    prepare?: boolean;
    copyAssetsOnly?: boolean;
}
export declare class Builder {
    /**
     * Executes a command synchronously with inherited stdio.
     *
     * @param command - Command string.
     * @param cwd - Working directory.
     */
    runCommand(command: string, cwd: string): void;
    /**
     * Builds the TypeScript project and synchronizes non-TS assets declared in tsconfig.
     *
     * @param options - Build configuration options.
     */
    build(options?: BuildOptions): void;
}
export declare const builder: Builder;
//# sourceMappingURL=builder.d.ts.map