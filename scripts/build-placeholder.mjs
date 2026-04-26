const platform = process.argv[2];

if (!platform) {
  console.error("Usage: node ./scripts/build-placeholder.mjs <platform>");
  process.exit(1);
}

console.error(
  `Local ${platform} build pipeline is reserved for future expansion. Use "pnpm run build:macos" for the active desktop release path.`
);
process.exit(1);
