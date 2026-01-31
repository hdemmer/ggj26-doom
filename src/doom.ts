/** biome-ignore-all lint/style/noNonNullAssertion: <explanation> */
import { Constants } from "@/Constants.ts";
import type { IVec2 } from "@/IVec2.ts";
import { intersectLineLine } from "@/intersectLineLine.ts";
import { pointInTriangle } from "@/pointInTriangle.ts";
import type { Ray } from "@/ray.ts";

// biome-ignore lint/complexity/noStaticOnlyClass: asdf
export class Vec2 {
	static ZERO = { x: 0, y: 0 };
}

export type Ctx = CanvasRenderingContext2D;

export interface SimplexSide {
	start: IVec2;
	end: IVec2;
	simplex: Simplex | null;
}

export class Simplex {
	public readonly sides: SimplexSide[];

	public readonly center: IVec2; // centroid of the triangle

	constructor(
		public readonly id: number,
		public readonly points: IVec2[], // MUST BE 3 !!!
	) {
		const sides: SimplexSide[] = [];
		// map points to sides
		for (let i = 0; i < points.length; i++) {
			const start = points[i]!;
			const end = points[(i + 1) % points.length]!;
			sides.push({
				start,
				end,
				simplex: null,
			});
		}

		this.sides = sides;

		this.center = {
			x: (points[0]!.x + points[1]!.x + points[2]!.x) / 3,
			y: (points[0]!.y + points[1]!.y + points[2]!.y) / 3,
		};
	}

	containsPoint(p: IVec2): boolean {
		return pointInTriangle(
			p,
			this.points[0]!,
			this.points[1]!,
			this.points[2]!,
		);
	}

	movePointInsideMutate(p: IVec2, d: number) {
		// TODO: move p inside the triangle, keeping it at least d distance from the edges
	}
}

function propagateRay(ray: Ray) {
	const { pos, dir, simplex } = ray;
	const target = {
		x: pos.x + Constants.MAX_DISTANCE * dir.x,
		y: pos.y + Constants.MAX_DISTANCE * dir.y,
	};
	const intersection: IVec2 = { ...Vec2.ZERO };
	if (
		intersectLineLine(
			pos.x,
			pos.y,
			target.x,
			target.y,
			simplex.b.x,
			simplex.b.y,
			simplex.c.x,
			simplex.c.y,
			intersection,
		)
	) {
		// we hit the b-c line (B) of this simplex
		pos;
	}
}

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
		ctx.strokeStyle = "white";
		for (let i = 0; i < this.simplices.length; i++) {
			const simplex = this.simplices[i]!;
			ctx.moveTo(simplex.a.x, simplex.a.y);
			ctx.lineTo(simplex.b.x, simplex.b.y);
			ctx.lineTo(simplex.c.x, simplex.c.y);
			ctx.lineTo(simplex.a.x, simplex.a.y);
			ctx.stroke();
		}
	}

	castRay(origin: IVec2, direction: IVec2, result: CastRayResult) {
		const currentSimplex = this.findSimplex(origin);
		if (!currentSimplex) {
			return result;
		}
		const currentOrigin = { ...origin };
		const currentDirection = { ...direction };
		const target: IVec2 = {
			x: 0,
			y: 0,
		};
		const intersection: IVec2 = {
			x: 0,
			y: 0,
		};
		for (let i = 0; i < Constants.MAX_STEPS; i++) {
			target.x = currentOrigin.x + Constants.MAX_DISTANCE * currentDirection.x;
			target.y = currentOrigin.y + Constants.MAX_DISTANCE * currentDirection.y;

			if (
				intersectLineLine(
					currentOrigin.x,
					currentOrigin.y,
					target.x,
					target.y,
					currentSimplex.b.x,
					currentSimplex.b.y,
					currentSimplex.c.x,
					currentSimplex.c.y,
					intersection,
				)
			) {
			}
		}
	}
}

function initLevel(): Level {
	const root = new Simplex(
		0,
		{ x: 100, y: 100 },
		{ x: 200, y: 100 },
		{ x: 100, y: 200 },
	);

	const simplices: Simplex[] = [root];

	let currentSimplex = root;
	for (let i = 0; i < 5; i++) {
		// grow side B
		const l = 1.1 - Math.random() * 0.2;
		const newPoint: IVec2 = {
			x: currentSimplex.b.x + currentSimplex.c.x - l * currentSimplex.a.x,
			y: currentSimplex.b.y + currentSimplex.c.y - l * currentSimplex.a.y,
		};

		const newS = new Simplex(
			i + 1,
			currentSimplex.b,
			currentSimplex.c,
			newPoint,
		);
		currentSimplex.B = newS;
		newS.A = currentSimplex;

		simplices.push(newS);

		currentSimplex = newS;
	}

	return new Level(simplices, root);
}

export class Player {
	public pos: IVec2 = {
		x: 160,
		y: 170,
	};

	draw(ctx: Ctx) {
		ctx.beginPath();
		ctx.arc(this.pos.x, this.pos.y, 10, 0, 2 * Math.PI);
		ctx.stroke();
	}
}

let didInit = false;

export function doom(ctx: Ctx) {
	let time = 0;

	console.log("init");
	if (didInit) {
		return;
	}
	didInit = true;
	const level = initLevel();
	const player = new Player();

	function handleRaf(t: number) {
		time += t;

		ctx.fillStyle = "black";
		ctx.fillRect(0, 0, Constants.WIDTH, Constants.HEIGHT);

		level.draw(ctx);
		player.draw(ctx);

		requestAnimationFrame(handleRaf);
	}

	requestAnimationFrame(handleRaf);
}
