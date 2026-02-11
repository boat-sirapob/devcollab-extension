import esbuild from "esbuild";

const isWatch = process.argv.includes("--watch");

const options = {
  entryPoints: ["out/src/extension.js"],
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node18",
  outfile: "dist/extension.js",
  sourcemap: true,
  external: ["vscode", "node-pty"],
  define: {
    "process.env.NODE_ENV": JSON.stringify(
      isWatch ? "development" : "production"
    ),
  },
  logLevel: "info",
};

if (isWatch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
} else {
  await esbuild.build(options);
}
