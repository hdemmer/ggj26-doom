/** biome-ignore-all lint/style/noNonNullAssertion: <explanation> */

import { Clut, type Rgb8Color } from "@/Clut.ts";
import { Constants } from "@/Constants.ts";
import type { Ctx, Game } from "@/doom.ts";
import type { IVec2 } from "@/IVec2.ts";
import { propagateRayMut } from "@/propagateRayMut.ts";
import type { Ray } from "@/ray.ts";

export interface Sprite {
	pos: IVec2;
	size: number;
}

interface RayCircleHit {
	distance: number;
	u: number; // 0-1 across the sprite width
}

export class ThreeDee {
	private readonly frameBuffer: Uint8Array;
	private readonly imageData: ImageData;
	private readonly rayPoints: IVec2[] = [];
	private readonly offscreenCanvas: OffscreenCanvas;
	private readonly offscreenCtx: OffscreenCanvasRenderingContext2D;
	private readonly sprites: Sprite[] = [];

	private floorTextureData: ImageData | null = null;
	private ceilingTextureData: ImageData | null = null;
	private wallTextureData: ImageData | null = null;
	private playerSpriteData: ImageData | null = null;
	private maskSpriteData: ImageData | null = null;
	private textureCanvas: OffscreenCanvas | null = null;
	private textureCtx: OffscreenCanvasRenderingContext2D | null = null;
	public whiteMaskPixelCount: number = 0;

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

	addSprite(pos: IVec2, size: number): Sprite {
		const sprite: Sprite = { pos: { ...pos }, size };
		this.sprites.push(sprite);
		return sprite;
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

	/**
	 * Check if a ray intersects a sprite circle.
	 * Returns hit info or null if no intersection.
	 */
	private rayCircleIntersect(
		rayOrigin: IVec2,
		rayDir: IVec2,
		sprite: Sprite,
	): RayCircleHit | null {
		// Vector from ray origin to sprite center
		const ocX = sprite.pos.x - rayOrigin.x;
		const ocY = sprite.pos.y - rayOrigin.y;

		// Project OC onto ray direction to find closest approach
		const tClosest = ocX * rayDir.x + ocY * rayDir.y;

		// If closest point is behind ray origin, no intersection
		if (tClosest < 0) {
			return null;
		}

		// Distance squared from sprite center to closest point on ray
		const closestX = rayOrigin.x + tClosest * rayDir.x;
		const closestY = rayOrigin.y + tClosest * rayDir.y;
		const distSq =
			(closestX - sprite.pos.x) ** 2 + (closestY - sprite.pos.y) ** 2;

		const radiusSq = sprite.size * sprite.size;
		if (distSq > radiusSq) {
			return null;
		}

		// Compute entry distance
		const halfChord = Math.sqrt(radiusSq - distSq);
		const tEntry = tClosest - halfChord;

		if (tEntry < 0) {
			return null;
		}

		// Compute U coordinate: where along the sprite width did we hit?
		// We use the perpendicular offset from sprite center
		const hitX = rayOrigin.x + tEntry * rayDir.x;
		const hitY = rayOrigin.y + tEntry * rayDir.y;

		// Perpendicular direction (90 degrees from ray towards camera right)
		const perpX = -rayDir.y;
		const perpY = rayDir.x;

		// Signed offset from sprite center along perpendicular
		const offsetX = hitX - sprite.pos.x;
		const offsetY = hitY - sprite.pos.y;
		const perpOffset = offsetX * perpX + offsetY * perpY;

		// Map to 0-1 range
		const u = 0.5 + perpOffset / (2 * sprite.size);

		return { distance: tEntry, u: Math.max(0, Math.min(1, u)) };
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
		if (!this.playerSpriteData) {
			this.playerSpriteData = this.extractTextureData(game.playerSpriteImage);
		}
		if (!this.maskSpriteData) {
			this.maskSpriteData = this.extractTextureData(game.maskSpriteImage);
		}
	}

	update() {
		const { game, frameBuffer, rayPoints } = this;
		const player = game.player;
		const level = game.level;

		// Count fully white mask sprite pixels rendered this frame
		let whiteMaskPixelCount = 0;

		// Clear frame buffer
		frameBuffer.fill(0);

		const playerSimplex = this.game.level.findSimplex(player.pos);
		if (!playerSimplex) {
			return 0;
		}

		this.ensureTexturesExtracted();

		const floorTex = this.floorTextureData!;
		const ceilingTex = this.ceilingTextureData!;
		const wallTex = this.wallTextureData!;
		const spriteTex = this.playerSpriteData!;
		const maskSpriteTex = this.maskSpriteData!;
		const halfHeight = Constants.LOWRES_HEIGHT / 2;

		// Track which pixels have been drawn (for sprite transparency)
		const columnDrawn = new Uint8Array(Constants.LOWRES_HEIGHT);

		for (let x = 0; x < Constants.LOWRES_WIDTH; x++) {
			// Clear column tracking
			columnDrawn.fill(0);

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
			const ray: Ray = {
				simplex: playerSimplex,
				pos: { ...player.pos },
				dir: rayDir,
				sideIndex: -1,
				isTerminated: false,
				terminalU: 0,
				numReflections: 0,
				wasReflection: false,
			};
			let distanceSum = 0;
			let numReflections = 0;
			let previousWallHeight = Constants.LOWRES_HEIGHT;
			const previousPos: IVec2 = { x: ray.pos.x, y: ray.pos.y };

			// Maintain a color lookup table for this ray
			const clut = Clut.makeIdentity();

			for (let i = 0; i < Constants.MAX_STEPS; i++) {
				propagateRayMut(ray);
				const dx = ray.pos.x - previousPos.x;
				const dy = ray.pos.y - previousPos.y;
				const stepDist = Math.hypot(dx, dy);
				const previousDistanceSum = distanceSum;
				distanceSum += stepDist;

				// Calculate wall height (inverse proportion to distance)
				let distance = distanceSum;
				// Fisheye correction: multiply by cos of angle offset
				distance *= Math.cos(angleOffset);

				// Check sprite intersections for this ray segment (only after reflections)
				// Use previousPos and ray.dir (which may have changed after reflection)
				if (numReflections > 0) {
					for (const sprite of this.sprites) {
						const hit = this.rayCircleIntersect(previousPos, ray.dir, sprite);
						if (hit) {
							// Check if sprite falls within this step (0 to stepDist from previousPos)
							if (hit.distance > 0 && hit.distance <= stepDist) {
								const totalDist = previousDistanceSum + hit.distance;
								const spriteCorrectedDist = totalDist * Math.cos(angleOffset);
								const spriteHeight = Math.floor(
									Math.min(
										Constants.LOWRES_HEIGHT,
										(Constants.LOWRES_HEIGHT * 2 * sprite.size) /
											spriteCorrectedDist,
									),
								);

								const spriteBrightness = Math.max(
									0,
									Math.min(255, 255 / (0.01 * spriteCorrectedDist)),
								);
								const spriteBrightnessFactor = spriteBrightness / 255;

								const texX = Math.floor(hit.u * (spriteTex.width - 1));
								const unclampedSpriteHeight =
									(Constants.LOWRES_HEIGHT * 2 * sprite.size) /
									spriteCorrectedDist;

								for (let yIdx = -spriteHeight; yIdx < spriteHeight; yIdx++) {
									const yScreen = halfHeight - yIdx + Constants.PLAYER_Y_FUDGE;
									if (yScreen >= 0 && yScreen < Constants.LOWRES_HEIGHT) {
										const v =
											(yIdx + unclampedSpriteHeight) /
											(2 * unclampedSpriteHeight);
										const texY =
											spriteTex.height -
											Math.max(
												0,
												Math.min(
													spriteTex.height - 1,
													Math.floor(v * (spriteTex.height - 1)),
												),
											);
										const texIdx = (texY * spriteTex.width + texX) * 4;

										const maskAlpha = maskSpriteTex.data[texIdx + 3]!;
										if (maskAlpha >= 10) {
											const maskR = maskSpriteTex.data[texIdx]!;
											const maskG = maskSpriteTex.data[texIdx + 1]!;
											const maskB = maskSpriteTex.data[texIdx + 2]!;

											// Count fully white mask pixels
											if (maskR === 255 && maskG === 255 && maskB === 255) {
												whiteMaskPixelCount++;
											}

											const color: Rgb8Color = {
												r: maskR * spriteBrightnessFactor,
												g: maskG * spriteBrightnessFactor,
												b: maskB * spriteBrightnessFactor,
											};
											clut.applyMut(color);

											const idx = (yScreen * Constants.LOWRES_WIDTH + x) * 3;
											frameBuffer[idx] = color.r;
											frameBuffer[idx + 1] = color.g;
											frameBuffer[idx + 2] = color.b;
											columnDrawn[yScreen] = 1;
										} else {
											const playerAlpha = spriteTex.data[texIdx + 3]!;
											if (playerAlpha >= 10) {
												const color: Rgb8Color = {
													r: spriteTex.data[texIdx]! * spriteBrightnessFactor,
													g:
														spriteTex.data[texIdx + 1]! *
														spriteBrightnessFactor,
													b:
														spriteTex.data[texIdx + 2]! *
														spriteBrightnessFactor,
												};
												clut.applyMut(color);

												const idx = (yScreen * Constants.LOWRES_WIDTH + x) * 3;
												frameBuffer[idx] = color.r;
												frameBuffer[idx + 1] = color.g;
												frameBuffer[idx + 2] = color.b;
												columnDrawn[yScreen] = 1;
											}
										}
										// If alpha < 10, don't mark as drawn - background will show through
									}
								}
							}
						}
					}
				}

				const wallHeight = Math.floor(
					Math.min(
						Constants.LOWRES_HEIGHT,
						(Constants.LOWRES_HEIGHT * 30) / distance, // the "30" determines how high the walls feel
					),
				);

				const unclampedBrightness =
					255 / (0.01 * distance) / (numReflections + 1);
				const brightness = Math.max(0, Math.min(255, unclampedBrightness));
				const brightnessFactor = brightness / 255;

				// Fill ceiling and floor
				for (let yIdx = wallHeight; yIdx < previousWallHeight; yIdx++) {
					// World position along the ray at this distance
					// Perspective-correct interpolation: screen Y maps inversely to distance
					const lambda =
						((previousWallHeight - yIdx) * wallHeight) /
						(yIdx * (previousWallHeight - wallHeight));
					let worldX = ray.pos.x * lambda + previousPos.x * (1 - lambda);
					let worldY = ray.pos.y * lambda + previousPos.y * (1 - lambda);
					worldX /= 100;
					worldY /= 100;

					// Ceiling
					const yCeil = halfHeight - yIdx;
					if (
						yCeil >= 0 &&
						yCeil < Constants.LOWRES_HEIGHT &&
						!columnDrawn[yCeil]
					) {
						const texX =
							((Math.floor(worldX * ceilingTex.width) % ceilingTex.width) +
								ceilingTex.width) %
							ceilingTex.width;
						const texY =
							((Math.floor(worldY * ceilingTex.height) % ceilingTex.height) +
								ceilingTex.height) %
							ceilingTex.height;

						const texIdx = (texY * ceilingTex.width + texX) * 4;

						const color: Rgb8Color = {
							r: ceilingTex.data[texIdx]! * brightnessFactor,
							g: ceilingTex.data[texIdx + 1]! * brightnessFactor,
							b: ceilingTex.data[texIdx + 2]! * brightnessFactor,
						};
						clut.applyMut(color);

						const idx = (yCeil * Constants.LOWRES_WIDTH + x) * 3;
						frameBuffer[idx] = color.r;
						frameBuffer[idx + 1] = color.g;
						frameBuffer[idx + 2] = color.b;
					}

					// Floor
					const yFloor = halfHeight + yIdx;
					if (
						yFloor >= 0 &&
						yFloor < Constants.LOWRES_HEIGHT &&
						!columnDrawn[yFloor]
					) {
						const texX =
							((Math.floor(worldX * floorTex.width) % floorTex.width) +
								floorTex.width) %
							floorTex.width;
						const texY =
							((Math.floor(worldY * floorTex.height) % floorTex.height) +
								floorTex.height) %
							floorTex.height;

						const texIdx = (texY * floorTex.width + texX) * 4;

						const color: Rgb8Color = {
							r: floorTex.data[texIdx]! * brightnessFactor,
							g: floorTex.data[texIdx + 1]! * brightnessFactor,
							b: floorTex.data[texIdx + 2]! * brightnessFactor,
						};

						clut.applyMut(color);
						const idx = (yFloor * Constants.LOWRES_WIDTH + x) * 3;
						frameBuffer[idx] = color.r;
						frameBuffer[idx + 1] = color.g;
						frameBuffer[idx + 2] = color.b;
					}
				}

				if (ray.isTerminated) {
					// fill in the wall using texture
					const u = ray.terminalU;
					const texX = Math.floor(u * (wallTex.width - 1)) % wallTex.width;

					// Use unclamped wall height for perspective-correct texture mapping
					const unclampedWallHeight = (Constants.LOWRES_HEIGHT * 30) / distance;

					for (let yIdx = -1 * wallHeight; yIdx < wallHeight; yIdx++) {
						const yWall = halfHeight - yIdx;

						if (
							yWall >= 0 &&
							yWall < Constants.LOWRES_HEIGHT &&
							!columnDrawn[yWall]
						) {
							// Calculate V coordinate using unclamped height for perspective correction
							// This ensures correct texture mapping even when close to walls
							const v =
								(yIdx + unclampedWallHeight) / (2 * unclampedWallHeight);
							const texY = Math.max(
								0,
								Math.min(
									wallTex.height - 1,
									Math.floor(v * (wallTex.height - 1)),
								),
							);
							const texIdx = (texY * wallTex.width + texX) * 4;

							// Sample texture and apply brightness
							const brightnessFactor = brightness / 255;
							const color: Rgb8Color = {
								r: wallTex.data[texIdx]! * brightnessFactor,
								g: wallTex.data[texIdx + 1]! * brightnessFactor,
								b: wallTex.data[texIdx + 2]! * brightnessFactor,
							};
							clut.applyMut(color);

							const idx = (yWall * Constants.LOWRES_WIDTH + x) * 3;
							frameBuffer[idx] = color.r;
							frameBuffer[idx + 1] = color.g;
							frameBuffer[idx + 2] = color.b;
						}
					}

					break;
				}

				previousPos.x = ray.pos.x;
				previousPos.y = ray.pos.y;
				previousWallHeight = wallHeight;
				// Apply pre-generated unitary transformation on reflection
				if (ray.numReflections > numReflections) {
					clut.multiplyMut(Constants.REFLECTION_CLUTS[ray.numReflections - 1]!);
				}
				numReflections = ray.numReflections;
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

		this.whiteMaskPixelCount = whiteMaskPixelCount;
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
