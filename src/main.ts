import "./index.css";
import { Constants } from "@/Constants.ts";
import { doom, setAssetUrls } from "./doom.ts";

declare const __ASSET_URLS__: Record<string, string> | undefined;

function resizeCanvas(canvas: HTMLCanvasElement) {
	const aspectRatio = Constants.WIDTH / Constants.HEIGHT;
	const windowWidth = window.innerWidth;
	const windowHeight = window.innerHeight;
	const windowAspect = windowWidth / windowHeight;

	let displayWidth: number;
	let displayHeight: number;

	if (windowAspect > aspectRatio) {
		displayHeight = windowHeight;
		displayWidth = windowHeight * aspectRatio;
	} else {
		displayWidth = windowWidth;
		displayHeight = windowWidth / aspectRatio;
	}

	canvas.style.width = `${displayWidth}px`;
	canvas.style.height = `${displayHeight}px`;
}

function main() {
	// Set asset URLs if embedded (for single-file build)
	if (typeof __ASSET_URLS__ !== "undefined") {
		setAssetUrls(__ASSET_URLS__);
	}

	const container = document.createElement("div");
	container.className = "app";
	document.body.appendChild(container);

	const canvas = document.createElement("canvas");
	canvas.width = Constants.WIDTH;
	canvas.height = Constants.HEIGHT;
	container.appendChild(canvas);

	const ctx = canvas.getContext("2d");
	if (ctx) {
		doom(ctx);
	}

	resizeCanvas(canvas);
	window.addEventListener("resize", () => resizeCanvas(canvas));
}

main();
