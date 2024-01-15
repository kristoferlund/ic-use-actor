import esbuild from "esbuild";

esbuild.build({
  entryPoints: ["./src/index.tsx"],
  bundle: true,
  outfile: "dist/index.jsx",
  format: "esm",
  minify: true,
  external: [
    "react",
    "react-dom",
    "@dfinity/agent",
    "@dfinity/identity",
    "@dfinity/candid",
  ],
  plugins: [],
});
