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
		ctx.strokeStyle = "blue";
		for (let i = 0; i < this.simplices.length; i++) {
			const simplex = this.simplices[i]!;
			ctx.moveTo(simplex.points[0]!.x, simplex.points[0]!.y);
			for (let j = 1; j < simplex.points.length; j++) {
				const point = simplex.points[j]!;
				ctx.lineTo(point.x, point.y);
			}
			ctx.closePath();
			ctx.stroke();
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
			terminalU: 0,
			numReflections: 0,
			wasReflection: false,
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
