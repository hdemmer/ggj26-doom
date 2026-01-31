/** biome-ignore-all lint/style/noNonNullAssertion: <explanation> */

import { Clut, type Rgb8Color } from "@/Clut.ts";
import { Constants } from "@/Constants.ts";
import type { Ctx, Game } from "@/doom.ts";
import type { IVec2 } from "@/IVec2.ts";
import { Player } from "@/player.ts";
import { propagateRayMut } from "@/propagateRayMut.ts";
import type { Ray } from "@/ray.ts";

export interface Sprite {
	pos: IVec2;
	size: number;
	angle: number; // facing angle in radians
	distanceTravelled: number; // accumulated movement distance
}

/**
 * Returns true every other 10 units of distance travelled for walk animation.
 */
function isSpriteFlipped(sprite: Sprite): boolean {
	return Math.floor(sprite.distanceTravelled / 10) % 2 === 1;
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
	private helmetSpriteData: ImageData | null = null;
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

	addSprite(pos: IVec2, size: number, angle: number = 0): Sprite {
		const sprite: Sprite = {
			pos: { ...pos },
			size,
			angle,
			distanceTravelled: 0,
		};
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
		if (!this.helmetSpriteData) {
			this.helmetSpriteData = this.extractTextureData(game.helmetSpriteImage);
		}
	}

	update() {
		const { game, frameBuffer, rayPoints } = this;
		const player = game.player;
		const level = game.level;

		// Count fully white helmet sprite pixels rendered this frame
		let whiteHelmetPixelCount = 0;

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
		const helmetSpriteTex = this.helmetSpriteData!;
		const halfHeight = Constants.LOWRES_HEIGHT / 2;

		// Z-buffer for this column (stores distance at each pixel for depth sorting)
		const columnDepth = new Float32Array(Constants.LOWRES_HEIGHT);

		for (let x = 0; x < Constants.LOWRES_WIDTH; x++) {
			// Clear column depth buffer (Infinity means nothing drawn yet)
			columnDepth.fill(Infinity);

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
				reflectionClut: null,
			};
			let distanceSum = 0;
			let numReflections = 0;
			let previousWallHeight = Constants.LOWRES_HEIGHT;
			const previousPos: IVec2 = { x: ray.pos.x, y: ray.pos.y };
			// Save direction before propagation for sprite checks
			const segmentDir: IVec2 = { x: rayDir.x, y: rayDir.y };

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

				// Check sprite intersections for this ray segment
				// Use previousPos and segmentDir (the direction BEFORE any reflection)
				for (const sprite of this.sprites) {
					const hit = this.rayCircleIntersect(previousPos, segmentDir, sprite);
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

							// Flip player texture horizontally for walk animation (mask stays unflipped)
							const playerU = isSpriteFlipped(sprite) ? 1 - hit.u : hit.u;
							const playerTexX = Math.floor(playerU * (spriteTex.width - 1));
							const maskTexX = Math.floor(hit.u * (helmetSpriteTex.width - 1));
							const unclampedSpriteHeight =
								(Constants.LOWRES_HEIGHT * 2 * sprite.size) /
								spriteCorrectedDist;

							// Check if sprite is facing the camera
							const spriteFacingDir: IVec2 = {
								x: Math.cos(sprite.angle),
								y: Math.sin(sprite.angle),
							};
							const facingCamera = Player.isFacingTowards(
								spriteFacingDir,
								ray.dir,
							);

							for (let yIdx = -spriteHeight; yIdx < spriteHeight; yIdx++) {
								const yScreen = halfHeight - yIdx + Constants.PLAYER_Y_FUDGE;
								if (
									yScreen >= 0 &&
									yScreen < Constants.LOWRES_HEIGHT &&
									spriteCorrectedDist < columnDepth[yScreen]!
								) {
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
									const playerTexIdx =
										(texY * spriteTex.width + playerTexX) * 4;
									const maskTexIdx =
										(texY * helmetSpriteTex.width + maskTexX) * 4;

									const playerAlpha = spriteTex.data[playerTexIdx + 3]!;

									const maskAlpha = helmetSpriteTex.data[maskTexIdx + 3]!;
									// facingCamera = true means sprite facing towards ray.dir → helmet on top
									// facingCamera = false means sprite facing away from ray.dir → player on top
									const helmetOnTop = facingCamera;

									if (helmetOnTop) {
										// Draw player first (bottom layer)
										if (playerAlpha >= 10) {
											const color: Rgb8Color = {
												r: spriteTex.data[playerTexIdx]! * spriteBrightnessFactor,
												g: spriteTex.data[playerTexIdx + 1]! * spriteBrightnessFactor,
												b: spriteTex.data[playerTexIdx + 2]! * spriteBrightnessFactor,
											};
											clut.applyMut(color);

											const idx = (yScreen * Constants.LOWRES_WIDTH + x) * 3;
											frameBuffer[idx] = color.r;
											frameBuffer[idx + 1] = color.g;
											frameBuffer[idx + 2] = color.b;
											columnDepth[yScreen] = spriteCorrectedDist;
										}
										// Draw helmet on top
										if (maskAlpha >= 10) {
											const maskR = helmetSpriteTex.data[maskTexIdx]!;
											const maskG = helmetSpriteTex.data[maskTexIdx + 1]!;
											const maskB = helmetSpriteTex.data[maskTexIdx + 2]!;

											if (maskR === 255 && maskG === 255 && maskB === 255) {
												whiteHelmetPixelCount++;
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
											columnDepth[yScreen] = spriteCorrectedDist;
										}
									} else {
										// Draw helmet first (bottom layer)
										if (maskAlpha >= 10) {
											const maskR = helmetSpriteTex.data[maskTexIdx]!;
											const maskG = helmetSpriteTex.data[maskTexIdx + 1]!;
											const maskB = helmetSpriteTex.data[maskTexIdx + 2]!;

											if (maskR === 255 && maskG === 255 && maskB === 255) {
												whiteHelmetPixelCount++;
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
											columnDepth[yScreen] = spriteCorrectedDist;
										}
										// Draw player on top
										if (playerAlpha >= 10) {
											const color: Rgb8Color = {
												r: spriteTex.data[playerTexIdx]! * spriteBrightnessFactor,
												g: spriteTex.data[playerTexIdx + 1]! * spriteBrightnessFactor,
												b: spriteTex.data[playerTexIdx + 2]! * spriteBrightnessFactor,
											};
											clut.applyMut(color);

											const idx = (yScreen * Constants.LOWRES_WIDTH + x) * 3;
											frameBuffer[idx] = color.r;
											frameBuffer[idx + 1] = color.g;
											frameBuffer[idx + 2] = color.b;
											columnDepth[yScreen] = spriteCorrectedDist;
										}
									}
								}
								// If neither alpha >= 10, don't mark as drawn - background will show through
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

					// Compute depth at this floor/ceiling pixel
					const pixelDist =
						(distanceSum * lambda + previousDistanceSum * (1 - lambda)) *
						Math.cos(angleOffset);

					// Calculate brightness per-pixel based on actual pixel distance
					const pixelBrightness = Math.max(
						0,
						Math.min(255, 255 / (0.01 * pixelDist) / (numReflections + 1)),
					);
					const pixelBrightnessFactor = pixelBrightness / 255;

					// Ceiling
					const yCeil = halfHeight - yIdx;
					if (
						yCeil >= 0 &&
						yCeil < Constants.LOWRES_HEIGHT &&
						pixelDist < columnDepth[yCeil]!
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
							r: ceilingTex.data[texIdx]! * pixelBrightnessFactor,
							g: ceilingTex.data[texIdx + 1]! * pixelBrightnessFactor,
							b: ceilingTex.data[texIdx + 2]! * pixelBrightnessFactor,
						};
						clut.applyMut(color);

						const idx = (yCeil * Constants.LOWRES_WIDTH + x) * 3;
						frameBuffer[idx] = color.r;
						frameBuffer[idx + 1] = color.g;
						frameBuffer[idx + 2] = color.b;
						columnDepth[yCeil] = pixelDist;
					}

					// Floor
					const yFloor = halfHeight + yIdx;
					if (
						yFloor >= 0 &&
						yFloor < Constants.LOWRES_HEIGHT &&
						pixelDist < columnDepth[yFloor]!
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
							r: floorTex.data[texIdx]! * pixelBrightnessFactor,
							g: floorTex.data[texIdx + 1]! * pixelBrightnessFactor,
							b: floorTex.data[texIdx + 2]! * pixelBrightnessFactor,
						};

						clut.applyMut(color);
						const idx = (yFloor * Constants.LOWRES_WIDTH + x) * 3;
						frameBuffer[idx] = color.r;
						frameBuffer[idx + 1] = color.g;
						frameBuffer[idx + 2] = color.b;
						columnDepth[yFloor] = pixelDist;
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
							distance < columnDepth[yWall]!
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
							columnDepth[yWall] = distance;
						}
					}

					break;
				}

				previousPos.x = ray.pos.x;
				previousPos.y = ray.pos.y;
				// Update segment direction for next iteration (may have changed due to reflection)
				segmentDir.x = ray.dir.x;
				segmentDir.y = ray.dir.y;
				previousWallHeight = wallHeight;
				// Apply mirror's clut on reflection
				if (ray.numReflections > numReflections && ray.reflectionClut) {
					clut.multiplyMut(ray.reflectionClut);
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

		this.whiteMaskPixelCount = whiteHelmetPixelCount;
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
