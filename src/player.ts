import { Constants } from "@/Constants.ts";
import type { Ctx } from "@/doom.ts";
import type { IVec2 } from "@/IVec2.ts";
import type { Level } from "@/level.ts";

/**
 * Calculate the shortest distance from a point to a line segment.
 */
function distanceToSegment(point: IVec2, start: IVec2, end: IVec2): number {
	const dx = end.x - start.x;
	const dy = end.y - start.y;
	const lengthSq = dx * dx + dy * dy;

	if (lengthSq === 0) {
		// Segment is a point
		return Math.hypot(point.x - start.x, point.y - start.y);
	}

	// Project point onto the line, clamped to segment
	const t = Math.max(
		0,
		Math.min(
			1,
			((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq,
		),
	);

	const projX = start.x + t * dx;
	const projY = start.y + t * dy;

	return Math.hypot(point.x - projX, point.y - projY);
}

export class Player {
	public pos: IVec2 = {
		x: 160,
		y: 170,
	};

	public angle: number = 0;

	public size: number = 10;

	public distanceTravelled: number = 0;

	/**
	 * Move the player to a new position and accumulate distance travelled.
	 */
	moveTo(newPos: IVec2): void {
		const dx = newPos.x - this.pos.x;
		const dy = newPos.y - this.pos.y;
		this.distanceTravelled += Math.hypot(dx, dy);
		this.pos.x = newPos.x;
		this.pos.y = newPos.y;
	}

	/**
	 * Returns true every other 10 units of distance travelled for walk animation.
	 */
	isFlipped(): boolean {
		return Math.floor(this.distanceTravelled / 10) % 2 === 1;
	}

	/**
	 * Check if the player can move to the target position without getting
	 * too close to walls.
	 */
	canMoveTo(target: IVec2, level: Level): boolean {
		// First check if target is inside a valid simplex
		const simplex = level.findSimplex(target);
		if (!simplex) {
			return false;
		}

		// Check distance to all walls in all simplices
		for (const s of level.simplices) {
			for (const side of s.sides) {
				// A wall is a side without a connected simplex
				if (side.simplex === null) {
					const dist = distanceToSegment(target, side.start, side.end);
					if (dist < this.size) {
						return false;
					}
				}
			}
		}

		return true;
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
