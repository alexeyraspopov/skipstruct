import { pipeline } from "node:stream/promises";
import { src, dest } from "gulp";
import { rollup } from "rollup";

export async function build() {
  let bundle = await rollup({ input: "skipstruct.js" });
  await Promise.all([
    bundle.write({ dir: "build", format: "esm" }),
    pipeline(src("LICENSE"), dest("build")),
    pipeline(src("package.json"), map(generatePackageJSON), dest("build")),
  ]);
}

function generatePackageJSON(contents) {
  let pkg = JSON.parse(contents.toString());
  let newPkg = {
    name: pkg.name,
    version: pkg.version,
    description: pkg.description,
    license: pkg.license,
    author: pkg.author,
    homepage: pkg.homepage,
    repository: pkg.repository,
    keywords: pkg.keywords,
    type: "module",
    main: "./skipstruct.js",
    module: "./skipstruct.js",
    exports: {
      ".": "./skipstruct.js",
    },
    files: ["*.js", "*.d.ts"],
    sideEffects: false,
  };
  return JSON.stringify(newPkg, null, 2);
}

function map(fn) {
  return async function* process(source) {
    for await (let file of source) {
      let clone = file.clone({ contents: false });
      let contents = await fn(file.contents.toString());
      yield Object.assign(clone, { contents: Buffer.from(contents) });
    }
  };
}
