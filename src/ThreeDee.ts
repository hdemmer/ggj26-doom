/** biome-ignore-all lint/style/noNonNullAssertion: <explanation> */
import { Constants } from "@/Constants.ts";
import type { Ctx, Game } from "@/doom.ts";
import type { IVec2 } from "@/IVec2.ts";

export class ThreeDee {
	private readonly frameBuffer: Uint8Array;
	private readonly imageData: ImageData;
	private readonly rayPoints: IVec2[] = [];
	private readonly offscreenCanvas: OffscreenCanvas;
	private readonly offscreenCtx: OffscreenCanvasRenderingContext2D;

	private floorTextureData: ImageData | null = null;
	private ceilingTextureData: ImageData | null = null;
	private textureCanvas: OffscreenCanvas | null = null;
	private textureCtx: OffscreenCanvasRenderingContext2D | null = null;

	constructor(public readonly game: Game) {
		this.frameBuffer = new Uint8Array(
			Constants.LOWRES_WIDTH * Constants.LOWRES_HEIGHT * 3,
		);
		this.imageData = new ImageData(
			Constants.LOWRES_WIDTH,
			Constants.LOWRES_HEIGHT,
		);
		this.offscreenCanvas = new OffscreenCanvas(
			Constants.LOWRES_WIDTH,
			Constants.LOWRES_HEIGHT,
		);
		this.offscreenCtx = this.offscreenCanvas.getContext("2d")!;
	}

	private extractTextureData(img: HTMLImageElement): ImageData {
		if (!this.textureCanvas || !this.textureCtx) {
			this.textureCanvas = new OffscreenCanvas(img.width, img.height);
			this.textureCtx = this.textureCanvas.getContext("2d")!;
		}
		if (
			this.textureCanvas.width !== img.width ||
			this.textureCanvas.height !== img.height
		) {
			this.textureCanvas.width = img.width;
			this.textureCanvas.height = img.height;
		}
		this.textureCtx.drawImage(img, 0, 0);
		return this.textureCtx.getImageData(0, 0, img.width, img.height);
	}

	private ensureTexturesLoaded(): boolean {
		const { game } = this;
		if (!game.floorImage.complete || !game.ceilingImage.complete) {
			return false;
		}
		if (!this.floorTextureData) {
			this.floorTextureData = this.extractTextureData(game.floorImage);
		}
		if (!this.ceilingTextureData) {
			this.ceilingTextureData = this.extractTextureData(game.ceilingImage);
		}
		return true;
	}

	update() {
		const { game, frameBuffer, rayPoints } = this;
		const player = game.player;
		const level = game.level;

		// Clear frame buffer
		frameBuffer.fill(0);

		// Draw floor and ceiling
		if (this.ensureTexturesLoaded()) {
			const floorTex = this.floorTextureData!;
			const ceilingTex = this.ceilingTextureData!;
			const halfHeight = Constants.LOWRES_HEIGHT / 2;

			for (let y = 0; y < Constants.LOWRES_HEIGHT; y++) {
				if (y === halfHeight) continue;

				const isCeiling = y < halfHeight;
				const texture = isCeiling ? ceilingTex : floorTex;
				const texWidth = texture.width;
				const texHeight = texture.height;
				const texData = texture.data;

				// Calculate row distance using perspective projection
				const rowFromCenter = isCeiling ? halfHeight - y : y - halfHeight;
				const rowDistance = (halfHeight * 32) / rowFromCenter;

				for (let x = 0; x < Constants.LOWRES_WIDTH; x++) {
					const angleOffset =
						(x / (Constants.LOWRES_WIDTH - 1) - 0.5) * Constants.FOV;
					const rayAngle = player.angle + angleOffset;

					// World position for this pixel
					const worldX = player.pos.x + Math.cos(rayAngle) * rowDistance;
					const worldY = player.pos.y + Math.sin(rayAngle) * rowDistance;

					// Texture coordinates with wrapping
					let texX = Math.floor(worldX * 8) % texWidth;
					let texY = Math.floor(worldY * 8) % texHeight;
					if (texX < 0) texX += texWidth;
					if (texY < 0) texY += texHeight;

					// Sample texture
					const texIdx = (texY * texWidth + texX) * 4;
					const idx = (y * Constants.LOWRES_WIDTH + x) * 3;

					// Apply distance-based shading
					const shade = Math.max(0.1, Math.min(1, 1 - rowDistance / 200));
					frameBuffer[idx] = texData[texIdx]! * shade;
					frameBuffer[idx + 1] = texData[texIdx + 1]! * shade;
					frameBuffer[idx + 2] = texData[texIdx + 2]! * shade;
				}
			}
		}

		for (let x = 0; x < Constants.LOWRES_WIDTH; x++) {
			// Map x from [0, WIDTH-1] to [-FOV/2, FOV/2]
			const angleOffset =
				(x / (Constants.LOWRES_WIDTH - 1) - 0.5) * Constants.FOV;

			// Calculate ray direction from player angle + offset
			const rayAngle = player.angle + angleOffset;
			const rayDir: IVec2 = {
				x: Math.cos(rayAngle),
				y: Math.sin(rayAngle),
			};

			// Cast ray
			level.castRay(player.pos, rayDir, rayPoints);

			if (rayPoints.length >= 2) {
				// Distance to first wall hit
				let distanceSum = 0;
				for (let i = 1; i < rayPoints.length; i++) {
					const dx = rayPoints[i]!.x - rayPoints[i - 1]!.x;
					const dy = rayPoints[i]!.y - rayPoints[i - 1]!.y;
					distanceSum += Math.hypot(dx, dy);
				}
				let distance = distanceSum;

				// Fisheye correction: multiply by cos of angle offset
				distance *= Math.cos(angleOffset);

				// Calculate wall height (inverse proportion to distance)
				const wallHeight = Math.min(
					Constants.LOWRES_HEIGHT,
					(Constants.LOWRES_HEIGHT * 50) / distance,
				);

				const wallTop = Math.floor((Constants.LOWRES_HEIGHT - wallHeight) / 2);
				const wallBottom = Math.floor(
					(Constants.LOWRES_HEIGHT + wallHeight) / 2,
				);

				// Brightness based on distance
				const brightness = Math.max(0, Math.min(255, 255 - distance * 2));

				// Fill vertical column
				for (let y = wallTop; y < wallBottom; y++) {
					const idx = (y * Constants.LOWRES_WIDTH + x) * 3;
					frameBuffer[idx] = brightness;
					frameBuffer[idx + 1] = brightness;
					frameBuffer[idx + 2] = brightness;
				}
			}
		}
	}

	draw(ctx: Ctx) {
		const { frameBuffer, imageData, offscreenCanvas, offscreenCtx } = this;
		const rgba = imageData.data;

		for (let i = 0; i < Constants.LOWRES_WIDTH * Constants.LOWRES_HEIGHT; i++) {
			const srcIdx = i * 3;
			const dstIdx = i * 4;
			rgba[dstIdx] = frameBuffer[srcIdx]!;
			rgba[dstIdx + 1] = frameBuffer[srcIdx + 1]!;
			rgba[dstIdx + 2] = frameBuffer[srcIdx + 2]!;
			rgba[dstIdx + 3] = 255;
		}

		offscreenCtx.putImageData(imageData, 0, 0);
		ctx.imageSmoothingEnabled = false;
		ctx.drawImage(offscreenCanvas, 0, 0, Constants.WIDTH, Constants.HEIGHT);
	}
}
