// Extend the NodeRequire type with the context method
declare interface NodeRequire {
  context: (
    directory: string,
    useSubdirectories: boolean,
    regExp: RegExp,
  ) => __WebpackModuleApi.RequireContext;
}
