/** biome-ignore-all lint/style/noNonNullAssertion: <explanation> */

import { Clut, type Rgb8Color } from "@/Clut.ts";
import { Constants } from "@/Constants.ts";
import type { Ctx, Game } from "@/doom.ts";
import type { IVec2 } from "@/IVec2.ts";
import { Player } from "@/player.ts";
import { propagateRayMut } from "@/propagateRayMut.ts";
import type { Ray } from "@/ray.ts";
import { rayCircleIntersect } from "@/rayCircleIntersect.ts";

export type SpriteType = "player" | "heart";

export interface Sprite {
	pos: IVec2;
	size: number;
	angle: number; // facing angle in radians
	distanceTravelled: number; // accumulated movement distance
	type: SpriteType;
}

/**
 * Returns true every other 10 units of distance travelled for walk animation.
 */
function isSpriteFlipped(sprite: Sprite): boolean {
	return Math.floor(sprite.distanceTravelled / 10) % 2 === 1;
}

export class ThreeDee {
	private readonly frameBuffer: Uint8Array;
	private readonly frameBuffer32: Uint32Array;
	private readonly imageData: ImageData;
	private readonly rayPoints: IVec2[] = [];
	private readonly offscreenCanvas: OffscreenCanvas;
	private readonly offscreenCtx: OffscreenCanvasRenderingContext2D;
	private readonly sprites: Sprite[] = [];

	private floorTextureData: ImageData | null = null;
	private ceilingTextureData: ImageData | null = null;
	private wallTextureData: ImageData | null = null;
	private doorTextureData: ImageData | null = null;
	private playerSpriteData: ImageData | null = null;
	private helmetSpriteData: ImageData | null = null;
	private frameTextureData: ImageData | null = null;
	private heartSpriteData: ImageData | null = null;
	private textureCanvas: OffscreenCanvas | null = null;
	private textureCtx: OffscreenCanvasRenderingContext2D | null = null;
	public whiteMaskPixelCount: number = 0;
	public blackMaskPixelCount: number = 0;

	constructor(public readonly game: Game) {
		const pixelCount = Constants.LOWRES_WIDTH * Constants.LOWRES_HEIGHT;
		const buffer = new ArrayBuffer(pixelCount * 4);
		this.frameBuffer = new Uint8Array(buffer);
		this.frameBuffer32 = new Uint32Array(buffer);
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

	addSprite(
		pos: IVec2,
		size: number,
		angle: number = 0,
		type: SpriteType = "player",
	): Sprite {
		const sprite: Sprite = {
			pos: { ...pos },
			size,
			angle,
			distanceTravelled: 0,
			type,
		};
		this.sprites.push(sprite);
		return sprite;
	}

	private renderSpritesForColumn(
		x: number,
		previousPos: IVec2,
		segmentDir: IVec2,
		stepDist: number,
		previousDistanceSum: number,
		angleOffset: number,
		halfHeight: number,
		clut: Clut,
		numReflections: number,
		columnDepth: Float32Array,
		frameBuffer: Uint8Array,
		playerSpriteTex: ImageData,
		helmetSpriteTex: ImageData,
		heartSpriteTex: ImageData,
	): { whitePixels: number; blackPixels: number } {
		let whitePixels = 0;
		let blackPixels = 0;

		for (const sprite of this.sprites) {
			const hit = rayCircleIntersect(previousPos, segmentDir, sprite);
			if (!hit) continue;

			// Check if sprite falls within this step (0 to stepDist from previousPos)
			if (hit.distance <= 0 || hit.distance > stepDist) continue;

			const totalDist = previousDistanceSum + hit.distance;
			const spriteCorrectedDist = totalDist * Math.cos(angleOffset);
			const spriteHeight = Math.floor(
				Math.min(
					Constants.LOWRES_HEIGHT,
					(Constants.LOWRES_HEIGHT * 2 * sprite.size) / spriteCorrectedDist,
				),
			);

			const spriteBrightness = Math.max(
				0,
				Math.min(255, 255 / (0.01 * spriteCorrectedDist)),
			);
			const spriteBrightnessFactor = spriteBrightness / 255;

			const unclampedSpriteHeight =
				(Constants.LOWRES_HEIGHT * 2 * sprite.size) / spriteCorrectedDist;

			if (sprite.type === "heart") {
				this.renderHeartSprite(
					x,
					spriteHeight,
					unclampedSpriteHeight,
					spriteCorrectedDist,
					spriteBrightnessFactor,
					hit.u,
					halfHeight,
					clut,
					columnDepth,
					frameBuffer,
					heartSpriteTex,
				);
			} else {
				const result = this.renderPlayerSprite(
					x,
					sprite,
					spriteHeight,
					unclampedSpriteHeight,
					spriteCorrectedDist,
					spriteBrightnessFactor,
					hit.u,
					segmentDir,
					halfHeight,
					clut,
					numReflections,
					columnDepth,
					frameBuffer,
					playerSpriteTex,
					helmetSpriteTex,
				);
				whitePixels += result.whitePixels;
				blackPixels += result.blackPixels;
			}
		}

		return { whitePixels, blackPixels };
	}

	private renderHeartSprite(
		x: number,
		spriteHeight: number,
		unclampedSpriteHeight: number,
		spriteCorrectedDist: number,
		spriteBrightnessFactor: number,
		u: number,
		halfHeight: number,
		clut: Clut,
		columnDepth: Float32Array,
		frameBuffer: Uint8Array,
		heartSpriteTex: ImageData,
	): void {
		const heartTexX = Math.floor(u * (heartSpriteTex.width - 1));

		for (let yIdx = -spriteHeight; yIdx < spriteHeight; yIdx++) {
			const yScreen = halfHeight - yIdx + Constants.PLAYER_Y_FUDGE;
			if (
				yScreen < 0 ||
				yScreen >= Constants.LOWRES_HEIGHT ||
				spriteCorrectedDist >= columnDepth[yScreen]!
			) {
				continue;
			}

			const v = (yIdx + unclampedSpriteHeight) / (2 * unclampedSpriteHeight);
			const texY =
				heartSpriteTex.height -
				1 -
				Math.max(
					0,
					Math.min(
						heartSpriteTex.height - 1,
						Math.floor(v * (heartSpriteTex.height - 1)),
					),
				);
			const heartTexIdx = (texY * heartSpriteTex.width + heartTexX) * 4;

			const heartAlpha = heartSpriteTex.data[heartTexIdx + 3]!;

			if (heartAlpha >= 10) {
				const color: Rgb8Color = {
					r: heartSpriteTex.data[heartTexIdx]! * spriteBrightnessFactor,
					g: heartSpriteTex.data[heartTexIdx + 1]! * spriteBrightnessFactor,
					b: heartSpriteTex.data[heartTexIdx + 2]! * spriteBrightnessFactor,
				};
				clut.applyMut(color);

				const idx = (yScreen * Constants.LOWRES_WIDTH + x) * 4;
				frameBuffer[idx] = color.r;
				frameBuffer[idx + 1] = color.g;
				frameBuffer[idx + 2] = color.b;
				columnDepth[yScreen] = spriteCorrectedDist;
			}
		}
	}

	private renderPlayerSprite(
		x: number,
		sprite: Sprite,
		spriteHeight: number,
		unclampedSpriteHeight: number,
		spriteCorrectedDist: number,
		spriteBrightnessFactor: number,
		u: number,
		segmentDir: IVec2,
		halfHeight: number,
		clut: Clut,
		numReflections: number,
		columnDepth: Float32Array,
		frameBuffer: Uint8Array,
		playerSpriteTex: ImageData,
		helmetSpriteTex: ImageData,
	): { whitePixels: number; blackPixels: number } {
		let whitePixels = 0;
		let blackPixels = 0;

		// Flip player texture horizontally for walk animation (mask stays unflipped)
		const playerU = isSpriteFlipped(sprite) ? 1 - u : u;
		const playerTexX = Math.floor(playerU * (playerSpriteTex.width - 1));
		const maskTexX = Math.floor(u * (helmetSpriteTex.width - 1));

		// Check if sprite is facing the camera
		const spriteFacingDir: IVec2 = {
			x: Math.cos(sprite.angle),
			y: Math.sin(sprite.angle),
		};
		const facingCamera = Player.isFacingTowards(spriteFacingDir, segmentDir);

		for (let yIdx = -spriteHeight; yIdx < spriteHeight; yIdx++) {
			const yScreen = halfHeight - yIdx + Constants.PLAYER_Y_FUDGE;
			if (
				yScreen < 0 ||
				yScreen >= Constants.LOWRES_HEIGHT ||
				spriteCorrectedDist >= columnDepth[yScreen]!
			) {
				continue;
			}

			const v = (yIdx + unclampedSpriteHeight) / (2 * unclampedSpriteHeight);
			const texY =
				playerSpriteTex.height -
				1 -
				Math.max(
					0,
					Math.min(
						playerSpriteTex.height - 1,
						Math.floor(v * (playerSpriteTex.height - 1)),
					),
				);
			const playerTexIdx = (texY * playerSpriteTex.width + playerTexX) * 4;
			const maskTexIdx = (texY * helmetSpriteTex.width + maskTexX) * 4;

			const playerAlpha = playerSpriteTex.data[playerTexIdx + 3]!;
			const maskAlpha = helmetSpriteTex.data[maskTexIdx + 3]!;

			// facingCamera = true means sprite facing towards ray.dir → helmet on top
			// facingCamera = false means sprite facing away from ray.dir → player on top
			const helmetOnTop = facingCamera;

			const result = this.renderPlayerPixel(
				x,
				yScreen,
				spriteCorrectedDist,
				spriteBrightnessFactor,
				playerAlpha,
				maskAlpha,
				playerTexIdx,
				maskTexIdx,
				helmetOnTop,
				numReflections,
				clut,
				columnDepth,
				frameBuffer,
				playerSpriteTex,
				helmetSpriteTex,
			);
			whitePixels += result.whitePixels;
			blackPixels += result.blackPixels;
		}

		return { whitePixels, blackPixels };
	}

	private renderPlayerPixel(
		x: number,
		yScreen: number,
		spriteCorrectedDist: number,
		spriteBrightnessFactor: number,
		playerAlpha: number,
		maskAlpha: number,
		playerTexIdx: number,
		maskTexIdx: number,
		helmetOnTop: boolean,
		numReflections: number,
		clut: Clut,
		columnDepth: Float32Array,
		frameBuffer: Uint8Array,
		playerSpriteTex: ImageData,
		helmetSpriteTex: ImageData,
	): { whitePixels: number; blackPixels: number } {
		let whitePixels = 0;
		let blackPixels = 0;
		const { game } = this;
		const idx = (yScreen * Constants.LOWRES_WIDTH + x) * 4;

		const drawPlayer = () => {
			if (playerAlpha >= 10) {
				const color: Rgb8Color = {
					r: playerSpriteTex.data[playerTexIdx]! * spriteBrightnessFactor,
					g: playerSpriteTex.data[playerTexIdx + 1]! * spriteBrightnessFactor,
					b: playerSpriteTex.data[playerTexIdx + 2]! * spriteBrightnessFactor,
				};
				clut.applyMut(color);
				frameBuffer[idx] = color.r;
				frameBuffer[idx + 1] = color.g;
				frameBuffer[idx + 2] = color.b;
				columnDepth[yScreen] = spriteCorrectedDist;
			}
		};

		const drawHelmet = () => {
			if (maskAlpha >= 10) {
				let maskR = helmetSpriteTex.data[maskTexIdx]!;
				let maskG = helmetSpriteTex.data[maskTexIdx + 1]!;
				let maskB = helmetSpriteTex.data[maskTexIdx + 2]!;

				// Invert helmet colors when even number of reflections (including isInMirror)
				if ((numReflections + (game.isInMirror ? 1 : 0)) % 2 === 0) {
					maskR = 255 - maskR;
					maskG = 255 - maskG;
					maskB = 255 - maskB;
				}

				if (maskR === 255 && maskG === 255 && maskB === 255) {
					whitePixels++;
				} else if (maskR === 0 && maskG === 0 && maskB === 0) {
					blackPixels++;
				}

				const color: Rgb8Color = {
					r: maskR * spriteBrightnessFactor,
					g: maskG * spriteBrightnessFactor,
					b: maskB * spriteBrightnessFactor,
				};
				clut.applyMut(color);
				frameBuffer[idx] = color.r;
				frameBuffer[idx + 1] = color.g;
				frameBuffer[idx + 2] = color.b;
				columnDepth[yScreen] = spriteCorrectedDist;
			}
		};

		if (helmetOnTop) {
			drawPlayer();
			drawHelmet();
		} else {
			drawHelmet();
			drawPlayer();
		}

		return { whitePixels, blackPixels };
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
		// Clear canvas before drawing to prevent previous texture bleeding through transparent areas
		this.textureCtx.clearRect(0, 0, img.width, img.height);
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
		if (!this.doorTextureData) {
			this.doorTextureData = this.extractTextureData(game.doorImage);
		}
		if (!this.playerSpriteData) {
			this.playerSpriteData = this.extractTextureData(game.playerSpriteImage);
		}
		if (!this.helmetSpriteData) {
			this.helmetSpriteData = this.extractTextureData(game.helmetSpriteImage);
		}
		if (!this.frameTextureData) {
			this.frameTextureData = this.extractTextureData(game.frameImage);
		}
		if (!this.heartSpriteData) {
			this.heartSpriteData = this.extractTextureData(game.heartSpriteImage);
		}
	}

	update(vignetteMultiply: number = 0) {
		const { game, frameBuffer, rayPoints } = this;
		const player = game.player;
		const level = game.level;

		// Count fully white and black helmet sprite pixels rendered this frame
		let whiteHelmetPixelCount = 0;
		let blackHelmetPixelCount = 0;

		// Clear frame buffer (0xFF000000 = opaque black in little-endian ABGR)
		this.frameBuffer32.fill(0xff000000);

		const playerSimplex = this.game.level.findSimplex(player.pos);
		if (!playerSimplex) {
			return 0;
		}

		this.ensureTexturesExtracted();

		const floorTex = this.floorTextureData!;
		const ceilingTex = this.ceilingTextureData!;
		const wallTex = this.wallTextureData!;
		const playerSpriteTex = this.playerSpriteData!;
		const helmetSpriteTex = this.helmetSpriteData!;
		const frameTex = this.frameTextureData!;
		const heartSpriteTex = this.heartSpriteData!;
		const halfHeight = Constants.LOWRES_HEIGHT / 2;

		// Pre-compute texture dimensions and masks (assumes power-of-2 textures)
		const floorTexW = floorTex.width;
		const floorTexH = floorTex.height;
		const floorTexWMask = floorTexW - 1;
		const floorTexHMask = floorTexH - 1;
		const ceilTexW = ceilingTex.width;
		const ceilTexH = ceilingTex.height;
		const ceilTexWMask = ceilTexW - 1;
		const ceilTexHMask = ceilTexH - 1;

		// Z-buffer for this column (stores distance at each pixel for depth sorting)
		const columnDepth = new Float32Array(Constants.LOWRES_HEIGHT);

		for (let x = 0; x < Constants.LOWRES_WIDTH; x++) {
			// Clear column depth buffer (Infinity means nothing drawn yet)
			columnDepth.fill(Infinity);

			// Map x from [0, WIDTH-1] to [-FOV/2, FOV/2]
			// Flip the angle sweep when in mirror mode
			const mirrorSign = game.isInMirror ? -1 : 1;
			const angleOffset =
				(x / (Constants.LOWRES_WIDTH - 1) - 0.5) * Constants.FOV * mirrorSign;

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
				reflectionSideIsDoor: false,
				numReflections: 0,
				wasReflection: false,
				reflectionU: 0,
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
				const spriteResult = this.renderSpritesForColumn(
					x,
					previousPos,
					segmentDir,
					stepDist,
					previousDistanceSum,
					angleOffset,
					halfHeight,
					clut,
					numReflections,
					columnDepth,
					frameBuffer,
					playerSpriteTex,
					helmetSpriteTex,
					heartSpriteTex,
				);
				whiteHelmetPixelCount += spriteResult.whitePixels;
				blackHelmetPixelCount += spriteResult.blackPixels;

				const wallHeight = Math.floor(
					Math.min(
						Constants.LOWRES_HEIGHT,
						(Constants.LOWRES_HEIGHT * 30) / distance, // the "30" determines how high the walls feel
					),
				);

				const unclampedBrightness = 255 / (0.01 * distance);
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
						Math.min(255, 255 / (0.01 * pixelDist)),
					);
					const pixelBrightnessFactor = pixelBrightness / 255;

					// Ceiling
					const yCeil = halfHeight - yIdx;
					if (
						yCeil >= 0 &&
						yCeil < Constants.LOWRES_HEIGHT &&
						pixelDist < columnDepth[yCeil]!
					) {
						const texX = (worldX * ceilTexW) & ceilTexWMask;
						const texY = (worldY * ceilTexH) & ceilTexHMask;

						const texIdx = (texY * ceilTexW + texX) * 4;

						const color: Rgb8Color = {
							r: ceilingTex.data[texIdx]! * pixelBrightnessFactor,
							g: ceilingTex.data[texIdx + 1]! * pixelBrightnessFactor,
							b: ceilingTex.data[texIdx + 2]! * pixelBrightnessFactor,
						};
						clut.applyMut(color);

						const idx = (yCeil * Constants.LOWRES_WIDTH + x) * 4;
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
						const texX = (worldX * floorTexW) & floorTexWMask;
						const texY = (worldY * floorTexH) & floorTexHMask;

						const texIdx = (texY * floorTexW + texX) * 4;

						const color: Rgb8Color = {
							r: floorTex.data[texIdx]! * pixelBrightnessFactor,
							g: floorTex.data[texIdx + 1]! * pixelBrightnessFactor,
							b: floorTex.data[texIdx + 2]! * pixelBrightnessFactor,
						};

						// Apply blob shadow from sprites
						const floorWorldX = worldX * 100;
						const floorWorldY = worldY * 100;
						for (const sprite of this.sprites) {
							const sdx = floorWorldX - sprite.pos.x;
							const sdy = floorWorldY - sprite.pos.y;
							const spriteDist = Math.hypot(sdx, sdy);
							const shadowRadius = sprite.size * 0.8;
							if (spriteDist < shadowRadius) {
								const shadowFactor = spriteDist / shadowRadius;
								const shadowMultiplier = 0.4 + 0.6 * shadowFactor;
								color.r *= shadowMultiplier;
								color.g *= shadowMultiplier;
								color.b *= shadowMultiplier;
							}
						}

						clut.applyMut(color);
						const idx = (yFloor * Constants.LOWRES_WIDTH + x) * 4;
						frameBuffer[idx] = color.r;
						frameBuffer[idx + 1] = color.g;
						frameBuffer[idx + 2] = color.b;
						columnDepth[yFloor] = pixelDist;
					}
				}

				// Render frame on mirrored walls
				if (ray.wasReflection) {
					const u = ray.reflectionU;
					const texX = Math.floor(u * (frameTex.width - 1)) % frameTex.width;

					// Use unclamped wall height for perspective-correct texture mapping
					const unclampedWallHeight = (Constants.LOWRES_HEIGHT * 30) / distance;

					// Pre-compute constants for frame texture loop
					const invDoubleUnclampedWallHeight = 0.5 / unclampedWallHeight;
					const frameTexHM1 = frameTex.height - 1;
					const frameTexRowStride = frameTex.width * 4;
					const texXOffset = texX * 4;

					// Incremental v calculation: start value and delta
					let v =
						(-wallHeight + unclampedWallHeight) * invDoubleUnclampedWallHeight;
					const vDelta = invDoubleUnclampedWallHeight;

					const frameTexToUse = ray.reflectionSideIsDoor
						? this.doorTextureData!
						: frameTex;

					for (let yIdx = -wallHeight; yIdx < wallHeight; yIdx++) {
						const yWall = halfHeight - yIdx;

						if (
							yWall >= 0 &&
							yWall < Constants.LOWRES_HEIGHT &&
							distance < columnDepth[yWall]!
						) {
							// texY with bitwise floor and inline clamping
							let texY = (v * frameTexHM1) | 0;
							if (texY < 0) texY = 0;
							else if (texY > frameTexHM1) texY = frameTexHM1;

							const texIdx = texY * frameTexRowStride + texXOffset;
							const frameAlpha = frameTexToUse.data[texIdx + 3]!;

							// Only draw where frame has opacity
							if (frameAlpha >= 10) {
								const color: Rgb8Color = {
									r: frameTexToUse.data[texIdx]! * brightnessFactor,
									g: frameTexToUse.data[texIdx + 1]! * brightnessFactor,
									b: frameTexToUse.data[texIdx + 2]! * brightnessFactor,
								};
								clut.applyMut(color);

								const idx = (yWall * Constants.LOWRES_WIDTH + x) * 4;
								frameBuffer[idx] = color.r;
								frameBuffer[idx + 1] = color.g;
								frameBuffer[idx + 2] = color.b;
								columnDepth[yWall] = distance;
							}
						}
						v += vDelta;
					}
				}

				if (ray.isTerminated) {
					// fill in the wall using texture
					const u = ray.reflectionU;
					const activeTex = wallTex;
					const texX = Math.floor(u * (activeTex.width - 1)) % activeTex.width;

					// Use unclamped wall height for perspective-correct texture mapping
					const unclampedWallHeight = (Constants.LOWRES_HEIGHT * 30) / distance;

					// Pre-compute constants for wall texture loop
					const invDoubleUnclampedWallHeight = 0.5 / unclampedWallHeight;
					const activeTexHM1 = activeTex.height - 1;
					const activeTexRowStride = activeTex.width * 4;
					const texXOffset = texX * 4;

					// Incremental v calculation: start value and delta
					let v =
						(-wallHeight + unclampedWallHeight) * invDoubleUnclampedWallHeight;
					const vDelta = invDoubleUnclampedWallHeight;

					for (let yIdx = -wallHeight; yIdx < wallHeight; yIdx++) {
						const yWall = halfHeight - yIdx;

						if (
							yWall >= 0 &&
							yWall < Constants.LOWRES_HEIGHT &&
							distance < columnDepth[yWall]!
						) {
							// texY with bitwise floor and inline clamping
							let texY = (v * activeTexHM1) | 0;
							if (texY < 0) texY = 0;
							else if (texY > activeTexHM1) texY = activeTexHM1;

							const texIdx = texY * activeTexRowStride + texXOffset;

							const color: Rgb8Color = {
								r: activeTex.data[texIdx]! * brightnessFactor,
								g: activeTex.data[texIdx + 1]! * brightnessFactor,
								b: activeTex.data[texIdx + 2]! * brightnessFactor,
							};
							clut.applyMut(color);

							const idx = (yWall * Constants.LOWRES_WIDTH + x) * 4;
							frameBuffer[idx] = color.r;
							frameBuffer[idx + 1] = color.g;
							frameBuffer[idx + 2] = color.b;
							columnDepth[yWall] = distance;
						}
						v += vDelta;
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
		}

		// Apply vignette effect
		if (vignetteMultiply !== 0) {
			const centerX = Constants.LOWRES_WIDTH / 2;
			const centerY = Constants.LOWRES_HEIGHT / 2;
			const maxDist = Math.hypot(centerX, centerY);

			for (let y = 0; y < Constants.LOWRES_HEIGHT; y++) {
				for (let x = 0; x < Constants.LOWRES_WIDTH; x++) {
					const dx = x - centerX;
					const dy = y - centerY;
					const dist = Math.hypot(dx, dy) / maxDist;

					// Quadratic falloff for more natural vignette
					const vignette = dist * dist;

					const idx = (y * Constants.LOWRES_WIDTH + x) * 4;

					if (vignetteMultiply < 0) {
						// Darken towards black at edges
						const factor = 1 - vignette * Math.abs(vignetteMultiply);
						frameBuffer[idx] = frameBuffer[idx]! * factor;
						frameBuffer[idx + 1] = frameBuffer[idx + 1]! * factor;
						frameBuffer[idx + 2] = frameBuffer[idx + 2]! * factor;
					} else {
						// Lighten towards white at edges
						const factor = vignette * vignetteMultiply;
						frameBuffer[idx] =
							frameBuffer[idx]! + (255 - frameBuffer[idx]!) * factor;
						frameBuffer[idx + 1] =
							frameBuffer[idx + 1]! + (255 - frameBuffer[idx + 1]!) * factor;
						frameBuffer[idx + 2] =
							frameBuffer[idx + 2]! + (255 - frameBuffer[idx + 2]!) * factor;
					}
				}
			}
		}

		this.whiteMaskPixelCount = whiteHelmetPixelCount;
		this.blackMaskPixelCount = blackHelmetPixelCount;
	}

	draw(ctx: Ctx) {
		const { frameBuffer, imageData, offscreenCanvas, offscreenCtx } = this;

		imageData.data.set(frameBuffer);

		offscreenCtx.putImageData(imageData, 0, 0);
		ctx.imageSmoothingEnabled = false;
		ctx.drawImage(offscreenCanvas, 0, 0, Constants.WIDTH, Constants.HEIGHT);
	}
}
