import type { IVec2 } from "@/IVec2.ts";
import { pointInTriangle } from "@/pointInTriangle.ts";
import type { SimplexSide } from "@/simplexSide.ts";

export class Simplex {
	public readonly sides: SimplexSide[];

	public readonly center: IVec2; // centroid of the triangle

	constructor(
		public readonly id: number,
		public readonly points: IVec2[], // MUST BE 3 !!!
	) {
		// Calculate center first so we can orient normals
		this.center = {
			x: (points[0]!.x + points[1]!.x + points[2]!.x) / 3,
			y: (points[0]!.y + points[1]!.y + points[2]!.y) / 3,
		};

		const sides: SimplexSide[] = [];
		// map points to sides
		for (let i = 0; i < points.length; i++) {
			const start = points[i]!;
			const end = points[(i + 1) % points.length]!;
			const normal = {
				x: end.y - start.y,
				y: start.x - end.x,
			};
			const length = Math.hypot(normal.x, normal.y);
			normal.x /= length;
			normal.y /= length;

			// Ensure normal points towards center (inward)
			const midX = (start.x + end.x) / 2;
			const midY = (start.y + end.y) / 2;
			const toCenterX = this.center.x - midX;
			const toCenterY = this.center.y - midY;
			const dot = normal.x * toCenterX + normal.y * toCenterY;
			if (dot < 0) {
				normal.x = -normal.x;
				normal.y = -normal.y;
			}

			sides.push({
				start,
				end,
				normal,
				simplex: null,
				isMirror: false,
				isDoor: false,
				mirrorClut: null,
			});
		}

		this.sides = sides;
	}

	containsPoint(p: IVec2): boolean {
		return pointInTriangle(
			p,
			this.points[0]!,
			this.points[1]!,
			this.points[2]!,
		);
	}

	connectSimplexOnSide(sideIndex: number, neighbor: Simplex) {
		if (sideIndex < 0 || sideIndex >= this.sides.length) {
			throw new Error("Invalid side index");
		}
		this.sides[sideIndex]!.simplex = neighbor;
	}

	findSideIndexForSimplex(simplex: Simplex): number {
		for (let i = 0; i < this.sides.length; i++) {
			const side = this.sides[i]!;
			if (side.simplex === simplex) {
				return i;
			}
		}
		return -1;
	}
}
