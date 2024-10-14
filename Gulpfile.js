import { pipeline } from "node:stream/promises";
import { readFileSync } from "node:fs";
import { basename, relative } from "node:path";
import { src, dest } from "gulp";
import { format } from "prettier";
import { rollup } from "rollup";
import ts from "typescript";
import Vinyl from "vinyl";

export async function build() {
  let bundle = await rollup({ input: "skipstruct.js" });
  await bundle.write({ dir: "build", format: "esm" });
  await Promise.all([
    pipeline(src(["build/*.js"]), declarations, dest("build")),
    pipeline(src("LICENSE"), dest("build")),
    pipeline(src("package.json"), map(generatePackageJSON), dest("build")),
  ]);
}

async function* declarations(source) {
  let config = { allowJs: true, declaration: true, emitDeclarationOnly: true, skipLibCheck: true };
  let host = ts.createCompilerHost(config);
  let roots = new Map();
  let output = new Set();
  host.writeFile = (fileName, contents) => {
    output.add(new Vinyl({ path: basename(fileName), contents: Buffer.from(contents) }));
  };
  host.readFile = (fileName) => {
    return roots.get(fileName)?.contents.toString() ?? readFileSync(fileName, "utf8");
  };
  for await (let file of source) {
    roots.set(relative(process.cwd(), file.path), file);
  }
  ts.createProgram(Array.from(roots.keys()), config, host).emit();
  for (let file of output) {
    let contents = file.contents.toString();
    let formatted = await format(contents, { parser: "typescript" });
    file.contents = Buffer.from(formatted);
    yield file;
  }
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
    types: "./skipstruct.d.ts",
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
