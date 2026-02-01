import { readdir, readFile, mkdir } from "fs/promises";
import { join, extname } from "path";

const ASSETS_DIR = "./assets";
const OUTPUT_FILE = "./game.html";
const ENTRY_POINT = "./src/main.ts";

const MIME_TYPES: Record<string, string> = {
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".png": "image/png",
	".mp3": "audio/mpeg",
	".wav": "audio/wav",
	".ogg": "audio/ogg",
};

async function loadAssets(): Promise<Record<string, string>> {
	const assets: Record<string, string> = {};
	const files = await readdir(ASSETS_DIR);

	for (const file of files) {
		const ext = extname(file).toLowerCase();
		const mimeType = MIME_TYPES[ext];
		if (!mimeType) continue;

		const filePath = join(ASSETS_DIR, file);
		const data = await readFile(filePath);
		const base64 = data.toString("base64");
		assets[file] = `data:${mimeType};base64,${base64}`;
		console.log(`Embedded: ${file} (${(data.length / 1024).toFixed(1)} KB)`);
	}

	return assets;
}

async function bundleJS(): Promise<string> {
	const result = await Bun.build({
		entrypoints: [ENTRY_POINT],
		minify: true,
		target: "browser",
		define: {
			"process.env.NODE_ENV": '"production"',
		},
	});

	if (!result.success) {
		console.error("Build failed:");
		for (const log of result.logs) {
			console.error(log);
		}
		process.exit(1);
	}

	return await result.outputs[0].text();
}

async function extractCSS(): Promise<string> {
	// Read CSS directly from the file
	const css = await readFile("./src/index.css", "utf-8");
	return css;
}

async function build() {
	console.log("Building game.html...\n");

	// Load all assets as base64 data URLs
	console.log("Embedding assets:");
	const assets = await loadAssets();
	const assetUrlsJSON = JSON.stringify(assets);

	// Bundle JavaScript
	console.log("\nBundling JavaScript...");
	let js = await bundleJS();

	// Inject asset URLs at the start
	const assetInjection = `var __ASSET_URLS__=${assetUrlsJSON};`;
	js = assetInjection + js;

	// Extract CSS
	const css = await extractCSS();

	// Create the HTML file
	const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Mirror</title>
<style>
${css}
</style>
</head>
<body>
<script>
${js}
</script>
</body>
</html>`;

	await Bun.write(OUTPUT_FILE, html);

	const stats = await Bun.file(OUTPUT_FILE).size;
	console.log(`\nCreated: ${OUTPUT_FILE} (${(stats / 1024 / 1024).toFixed(2)} MB)`);
}

build().catch(console.error);
