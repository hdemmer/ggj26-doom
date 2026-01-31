/** biome-ignore-all lint/style/noNonNullAssertion: <explanation> */
import { Constants } from "@/Constants.ts";
import type { Ctx, Game } from "@/doom.ts";
import type { IVec2 } from "@/IVec2.ts";

export class ThreeDee {
	private readonly frameBuffer: Uint8Array;
	private readonly imageData: ImageData;
	private readonly rayPoints: IVec2[] = [];

	constructor(public readonly game: Game) {
		this.frameBuffer = new Uint8Array(Constants.WIDTH * Constants.HEIGHT * 3);
		this.imageData = new ImageData(Constants.WIDTH, Constants.HEIGHT);
	}

	update() {
		const { game, frameBuffer, rayPoints } = this;
		const player = game.player;
		const level = game.level;

		// Clear frame buffer
		frameBuffer.fill(0);

		const halfFov = Constants.FOV / 2;

		for (let x = 0; x < Constants.WIDTH; x++) {
			// Map x from [0, WIDTH-1] to [-FOV/2, FOV/2]
			const angleOffset = (x / (Constants.WIDTH - 1) - 0.5) * Constants.FOV;

			// Rotate player direction by angleOffset
			const cos = Math.cos(angleOffset);
			const sin = Math.sin(angleOffset);
			const rayDir: IVec2 = {
				x: player.dir.x * cos - player.dir.y * sin,
				y: player.dir.x * sin + player.dir.y * cos,
			};

			// Cast ray
			level.castRay(player.pos, rayDir, rayPoints);

			if (rayPoints.length >= 2) {
				// Distance to first wall hit
				const dx = rayPoints[1]!.x - rayPoints[0]!.x;
				const dy = rayPoints[1]!.y - rayPoints[0]!.y;
				let distance = Math.hypot(dx, dy);

				// Fisheye correction: multiply by cos of angle offset
				distance *= Math.cos(angleOffset);

				// Calculate wall height (inverse proportion to distance)
				const wallHeight = Math.min(
					Constants.HEIGHT,
					(Constants.HEIGHT * 50) / distance,
				);

				const wallTop = Math.floor((Constants.HEIGHT - wallHeight) / 2);
				const wallBottom = Math.floor((Constants.HEIGHT + wallHeight) / 2);

				// Brightness based on distance
				const brightness = Math.max(0, Math.min(255, 255 - distance * 0.5));

				// Fill vertical column
				for (let y = wallTop; y < wallBottom; y++) {
					const idx = (y * Constants.WIDTH + x) * 3;
					frameBuffer[idx] = brightness;
					frameBuffer[idx + 1] = brightness;
					frameBuffer[idx + 2] = brightness;
				}
			}
		}
	}

	draw(ctx: Ctx) {
		const { frameBuffer, imageData } = this;
		const rgba = imageData.data;

		for (let i = 0; i < Constants.WIDTH * Constants.HEIGHT; i++) {
			const srcIdx = i * 3;
			const dstIdx = i * 4;
			rgba[dstIdx] = frameBuffer[srcIdx]!;
			rgba[dstIdx + 1] = frameBuffer[srcIdx + 1]!;
			rgba[dstIdx + 2] = frameBuffer[srcIdx + 2]!;
			rgba[dstIdx + 3] = 255;
		}

		ctx.putImageData(imageData, 0, 0);
	}
}
