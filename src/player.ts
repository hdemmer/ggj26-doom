/** biome-ignore-all lint/style/noNonNullAssertion: <explanation> */
import { Constants } from "@/Constants.ts";
import type { Ctx } from "@/doom.ts";
import type { IVec2 } from "@/IVec2.ts";
import { intersectLineLine } from "@/intersectLineLine.ts";
import type { Level } from "@/level.ts";
import type { SimplexSide } from "@/simplexSide.ts";

export class Player {
	public pos: IVec2;

	public angle: number = 0;

	public size: number = 10;

	public distanceTravelled: number = 0;

	constructor(startPos: IVec2 = { x: 160, y: 170 }) {
		this.pos = { ...startPos };
	}

	/**
	 * Move the player by delta, tracing through simplices like a ray.
	 * Handles passing through portals, bouncing off mirrors, and stopping at walls.
	 * The player position will never be outside the level.
	 * @returns Object with mirrorPassages count and whether a door was hit.
	 */
	moveTo(
		delta: IVec2,
		level: Level,
	): { mirrorPassages: number; hitDoor: boolean } {
		let simplex = level.findSimplex(this.pos);
		if (!simplex) {
			return { mirrorPassages: 0, hitDoor: false };
		}

		const deltaLength = Math.hypot(delta.x, delta.y);
		if (deltaLength === 0) {
			return { mirrorPassages: 0, hitDoor: false };
		}

		let mirrorPassages = 0;
		let hitDoor = false;

		let currentX = this.pos.x;
		let currentY = this.pos.y;
		let dirX = delta.x / deltaLength;
		let dirY = delta.y / deltaLength;
		let remainingDist = deltaLength;
		let sideIndex = -1;

		const intersection: IVec2 = { x: 0, y: 0 };
		const maxIterations = 10;

		for (let iter = 0; iter < maxIterations && remainingDist > 0.001; iter++) {
			const targetX = currentX + dirX * remainingDist;
			const targetY = currentY + dirY * remainingDist;

			let hitDist = remainingDist;
			let hitSideIndex = -1;

			// Find closest intersection with simplex sides
			for (let i = 0; i < simplex!.sides.length; i++) {
				if (i === sideIndex) continue;

				const side = simplex!.sides[i]!;
				if (
					intersectLineLine(
						currentX,
						currentY,
						targetX,
						targetY,
						side.start.x,
						side.start.y,
						side.end.x,
						side.end.y,
						intersection,
					)
				) {
					const dist = Math.hypot(
						intersection.x - currentX,
						intersection.y - currentY,
					);
					if (dist < hitDist) {
						hitDist = dist;
						hitSideIndex = i;
					}
				}
			}

			if (hitSideIndex >= 0) {
				const side: SimplexSide = simplex!.sides[hitSideIndex]!;

				if (side.simplex) {
					// Pass through to neighbor simplex
					currentX += dirX * hitDist;
					currentY += dirY * hitDist;
					remainingDist -= hitDist;
					sideIndex = side.simplex.findSideIndexForSimplex(simplex);
					simplex = side.simplex;
				} else if (side.isMirror) {
					// Reflect off mirror
					currentX += dirX * hitDist;
					currentY += dirY * hitDist;
					remainingDist -= hitDist;

					// Reflect movement direction
					const dot = dirX * side.normal.x + dirY * side.normal.y;
					dirX = dirX - 2 * dot * side.normal.x;
					dirY = dirY - 2 * dot * side.normal.y;

					// Reflect player angle
					this.reflectAngle(side.normal);

					mirrorPassages++;
					side.isMirror = false;
					sideIndex = hitSideIndex;
					if (side.isDoor) {
						hitDoor = true;
					}
				} else {
					// Hit wall - stop at wall minus player size
					const stopDist = Math.max(0, hitDist - this.size);
					currentX += dirX * stopDist;
					currentY += dirY * stopDist;
					remainingDist = 0;
				}
			} else {
				// No hit, move full remaining distance
				currentX = targetX;
				currentY = targetY;
				remainingDist = 0;
			}
		}

		// Update position and distance travelled
		const dx = currentX - this.pos.x;
		const dy = currentY - this.pos.y;
		this.distanceTravelled += Math.hypot(dx, dy);
		this.pos.x = currentX;
		this.pos.y = currentY;

		return { mirrorPassages, hitDoor };
	}

	private reflectAngle(normal: IVec2): void {
		const dirX = Math.cos(this.angle);
		const dirY = Math.sin(this.angle);
		const dot = dirX * normal.x + dirY * normal.y;
		const newDirX = dirX - 2 * dot * normal.x;
		const newDirY = dirY - 2 * dot * normal.y;
		this.angle = Math.atan2(newDirY, newDirX);
	}

	/**
	 * Returns true every other 10 units of distance travelled for walk animation.
	 */
	isFlipped(): boolean {
		return Math.floor(this.distanceTravelled / 10) % 2 === 1;
	}

	/**
	 * Check if a facing direction is towards a view direction.
	 * @param facingDir The direction something is facing
	 * @param viewDir The view direction (e.g., ray direction from camera)
	 * @returns true if facing towards the view direction, false if facing away
	 */
	static isFacingTowards(facingDir: IVec2, viewDir: IVec2): boolean {
		// Dot product: negative means facing towards (opposite directions)
		return facingDir.x * viewDir.x + facingDir.y * viewDir.y < 0;
	}

	draw(ctx: Ctx) {
		ctx.beginPath();
		ctx.arc(this.pos.x, this.pos.y, this.size, 0, 2 * Math.PI);
		ctx.stroke();

		// draw direction
		ctx.beginPath();
		ctx.moveTo(this.pos.x, this.pos.y);
		ctx.lineTo(
			this.pos.x + Math.cos(this.angle) * 2 * this.size,
			this.pos.y + Math.sin(this.angle) * 2 * this.size,
		);
		ctx.stroke();

		// draw FOV
		const halfFov = Constants.FOV / 2;
		ctx.beginPath();
		ctx.moveTo(this.pos.x, this.pos.y);
		ctx.lineTo(
			this.pos.x + Math.cos(this.angle - halfFov) * 2 * this.size,
			this.pos.y + Math.sin(this.angle - halfFov) * 2 * this.size,
		);
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(this.pos.x, this.pos.y);
		ctx.lineTo(
			this.pos.x + Math.cos(this.angle + halfFov) * 2 * this.size,
			this.pos.y + Math.sin(this.angle + halfFov) * 2 * this.size,
		);
		ctx.stroke();
	}
}
