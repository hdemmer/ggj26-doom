/** biome-ignore-all lint/style/noNonNullAssertion: <explanation> */

import { Clut } from "@/Clut.ts";
import { Constants } from "@/Constants.ts";
import type { Ctx, Game } from "@/doom.ts";
import type { IVec2 } from "@/IVec2.ts";
import { propagateRayMut } from "@/propagateRayMut.ts";
import type { Ray } from "@/ray.ts";

export class ThreeDee {
	private readonly frameBuffer: Uint8Array;
	private readonly imageData: ImageData;
	private readonly rayPoints: IVec2[] = [];
	private readonly offscreenCanvas: OffscreenCanvas;
	private readonly offscreenCtx: OffscreenCanvasRenderingContext2D;

	private floorTextureData: ImageData | null = null;
	private ceilingTextureData: ImageData | null = null;
	private wallTextureData: ImageData | null = null;
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

	private ensureTexturesExtracted(): void {
		const { game } = this;
		if (!this.floorTextureData) {
			this.floorTextureData = this.extractTextureData(game.floorImage);
		}
		if (!this.ceilingTextureData) {
			this.ceilingTextureData = this.extractTextureData(game.ceilingImage);
		}
		if (!this.wallTextureData) {
			this.wallTextureData = this.extractTextureData(game.wallImage);
		}
	}

	update() {
		const { game, frameBuffer, rayPoints } = this;
		const player = game.player;
		const level = game.level;

		// Clear frame buffer
		frameBuffer.fill(0);

		const playerSimplex = this.game.level.findSimplex(player.pos);
		if (!playerSimplex) {
			return;
		}

		this.ensureTexturesExtracted();

		// TODO: use these
		const floorTex = this.floorTextureData!;
		const ceilingTex = this.ceilingTextureData!;
		const wallTex = this.wallTextureData!;
		const halfHeight = Constants.LOWRES_HEIGHT / 2;

		const clut = Clut.makeIdentity();

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
			clut.identityMut();
			const ray: Ray = {
				simplex: playerSimplex,
				pos: { ...player.pos },
				dir: rayDir,
				sideIndex: -1,
				isTerminated: false,
				terminalU: 0,
				clut,
				numReflections: 0,
			};
			let distanceSum = 0;
			let previousWallHeight = Constants.LOWRES_HEIGHT;
			const previousPos: IVec2 = { x: ray.pos.x, y: ray.pos.y };
			for (let i = 0; i < Constants.MAX_STEPS; i++) {
				propagateRayMut(ray);
				const dx = ray.pos.x - previousPos.x;
				const dy = ray.pos.y - previousPos.y;
				distanceSum += Math.hypot(dx, dy);

				// Calculate wall height (inverse proportion to distance)
				let distance = distanceSum;
				// Fisheye correction: multiply by cos of angle offset
				distance *= Math.cos(angleOffset);
				const wallHeight = Math.floor(
					Math.min(
						Constants.LOWRES_HEIGHT,
						(Constants.LOWRES_HEIGHT * 30) / distance, // the "30" determines how high the walls feel
					),
				);

				const unclampedBrightness =
					255 / (0.01 * distance) / (ray.numReflections + 1);
				const brightness = Math.max(0, Math.min(255, unclampedBrightness));

				// Fill ceiling
				for (let yIdx = wallHeight; yIdx < previousWallHeight; yIdx++) {
					const yCeil = halfHeight - yIdx;

					if (yCeil >= 0 && yCeil < Constants.LOWRES_HEIGHT) {
						// Calculate distance for this ceiling row
						// Inverse of: wallHeight = (LOWRES_HEIGHT * 30) / (distance * cos(angleOffset))
						const rowDist =
							(Constants.LOWRES_HEIGHT * 30) / yIdx / Math.cos(angleOffset);

						// World position along the ray at this distance
						const worldX = (player.pos.x + rayDir.x * rowDist) / 100;
						const worldY = (player.pos.y + rayDir.y * rowDist) / 100;

						// Texture coordinates (tile the texture in world space)
						const texX =
							((Math.floor(worldX * ceilingTex.width) % ceilingTex.width) +
								ceilingTex.width) %
							ceilingTex.width;
						const texY =
							((Math.floor(worldY * ceilingTex.height) % ceilingTex.height) +
								ceilingTex.height) %
							ceilingTex.height;

						const texIdx = (texY * ceilingTex.width + texX) * 4;

						// Apply brightness based on distance
						const rowBrightness = Math.max(
							0,
							Math.min(255, 255 / (0.01 * rowDist)),
						);
						const brightnessFactor = rowBrightness / 255;

						const r = ceilingTex.data[texIdx]! * brightnessFactor;
						const g = ceilingTex.data[texIdx + 1]! * brightnessFactor;
						const b = ceilingTex.data[texIdx + 2]! * brightnessFactor;

						const idx = (yCeil * Constants.LOWRES_WIDTH + x) * 3;
						frameBuffer[idx] = r;
						frameBuffer[idx + 1] = g;
						frameBuffer[idx + 2] = b;
					}
				}

				if (ray.isTerminated) {
					// fill in the wall using texture
					const u = ray.terminalU;
					const texX = Math.floor(u * (wallTex.width - 1)) % wallTex.width;

					for (let yIdx = -1 * wallHeight; yIdx < wallHeight; yIdx++) {
						const yWall = halfHeight - yIdx;

						if (yWall >= 0 && yWall < Constants.LOWRES_HEIGHT) {
							// Calculate V coordinate (0 at top, 1 at bottom)
							const v = (yIdx + wallHeight) / (2 * wallHeight);
							const texY = Math.floor(v * (wallTex.height - 1));
							const texIdx = (texY * wallTex.width + texX) * 4;

							// Sample texture and apply brightness
							const brightnessFactor = brightness / 255;
							const r = wallTex.data[texIdx]! * brightnessFactor;
							const g = wallTex.data[texIdx + 1]! * brightnessFactor;
							const b = wallTex.data[texIdx + 2]! * brightnessFactor;

							const idx = (yWall * Constants.LOWRES_WIDTH + x) * 3;
							frameBuffer[idx] = r;
							frameBuffer[idx + 1] = g;
							frameBuffer[idx + 2] = b;
						}
					}

					break;
				}

				previousPos.x = ray.pos.x;
				previousPos.y = ray.pos.y;
				previousWallHeight = wallHeight;
			}

			/*

            // OLD DRAWING CODE:
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

             */
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
