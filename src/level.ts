import { Constants } from "@/Constants.ts";
import type { Ctx } from "@/doom.ts";
import type { IVec2 } from "@/IVec2.ts";
import { propagateRayMut } from "@/propagateRayMut.ts";
import type { Ray } from "@/ray.ts";
import type { Simplex } from "@/simplex.ts";

export class Level {
	constructor(
		public readonly simplices: Simplex[] = [],
		public readonly root: Simplex,
		public readonly heartPositions: IVec2[] = [],
		public readonly playerStartPos: IVec2 = { x: 160, y: 170 },
		public readonly playerStartAngle: number = 0,
	) {}

	findSimplex(p: IVec2): Simplex | null {
		for (let i = 0; i < this.simplices.length; i++) {
			const simplex = this.simplices[i]!;
			if (simplex.containsPoint(p)) {
				return simplex;
			}
		}
		return null;
	}

	draw(ctx: Ctx) {
		const normalLength = 10;

		for (let i = 0; i < this.simplices.length; i++) {
			const simplex = this.simplices[i]!;
			const hue = (i * 137) % 360; // Golden angle for color distribution
			ctx.strokeStyle = `hsl(${hue}, 70%, 50%)`;

			// Draw simplex outline with 5px offset towards center
			const offset = 5;
			const offsetPoints: IVec2[] = [];
			for (const point of simplex.points) {
				const dx = simplex.center.x - point.x;
				const dy = simplex.center.y - point.y;
				const len = Math.hypot(dx, dy);
				offsetPoints.push({
					x: point.x + (dx / len) * offset,
					y: point.y + (dy / len) * offset,
				});
			}
			ctx.beginPath();
			ctx.moveTo(offsetPoints[0]!.x, offsetPoints[0]!.y);
			for (let j = 1; j < offsetPoints.length; j++) {
				ctx.lineTo(offsetPoints[j]!.x, offsetPoints[j]!.y);
			}
			ctx.closePath();
			ctx.stroke();

			// Draw normals for each side
			for (const side of simplex.sides) {
				const midX = (side.start.x + side.end.x) / 2;
				const midY = (side.start.y + side.end.y) / 2;
				ctx.beginPath();
				ctx.moveTo(midX, midY);
				ctx.lineTo(
					midX + side.normal.x * normalLength,
					midY + side.normal.y * normalLength,
				);
				ctx.stroke();
			}
		}
	}

	castRay(origin: IVec2, direction: IVec2, result: IVec2[]) {
		result.length = 0;
		const currentSimplex = this.findSimplex(origin);
		if (!currentSimplex) {
			return;
		}
		const ray: Ray = {
			simplex: currentSimplex,
			pos: { ...origin },
			dir: { ...direction },
			sideIndex: -1,
			isTerminated: false,
			numReflections: 0,
			wasReflection: false,
			reflectionSideIsDoor: false,
			reflectionU: 0,
			reflectionClut: null,
		};
		for (let i = 0; i < Constants.MAX_STEPS; i++) {
			result.push({ ...ray.pos });
			if (ray.isTerminated) {
				break;
			}
			propagateRayMut(ray);
		}
	}
}
