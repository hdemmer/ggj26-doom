/** biome-ignore-all lint/style/noNonNullAssertion: asdf */
import { Constants } from "@/Constants.ts";
import type { IVec2 } from "@/IVec2.ts";
import { intersectLineLine } from "@/intersectLineLine.ts";
import { Player } from "@/player.ts";
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
	normal: IVec2;
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
			const normal = {
				x: end.y - start.y,
				y: start.x - end.x,
			};
			const length = Math.hypot(normal.x, normal.y);
			normal.x /= length;
			normal.y /= length;
			sides.push({
				start,
				end,
				normal,
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

function propagateRayMut(ray: Ray): void {
	const { pos, dir, simplex } = ray;
	const target = {
		x: pos.x + Constants.MAX_DISTANCE * dir.x,
		y: pos.y + Constants.MAX_DISTANCE * dir.y,
	};
	const intersection: IVec2 = { ...Vec2.ZERO };
	// iterate over sides
	for (let i = 0; i < simplex.sides.length; i++) {
		const side = simplex.sides[i]!;
		if (
			intersectLineLine(
				pos.x,
				pos.y,
				target.x,
				target.y,
				side.start.x,
				side.start.y,
				side.end.x,
				side.end.y,
				intersection,
			)
		) {
			// hit this side
			if (side.simplex) {
				// has neighbor, propagate ray
				ray.pos.x = intersection.x;
				ray.pos.y = intersection.y;
				ray.simplex = side.simplex;
				const hitSideIndex = simplex.findSideIndexForSimplex(side.simplex);
				if (hitSideIndex !== -1) {
					// move pos a bit into the new simplex to avoid precision issues
					const hitSide = side.simplex.sides[hitSideIndex]!;
					const normal = {
						x: -hitSide.normal.x,
						y: -hitSide.normal.y,
					};
					ray.pos.x += normal.x * Constants.EPSILON;
					ray.pos.y += normal.y * Constants.EPSILON;
				}

				return;
			} else {
				// no neighbor, reflect ray on side normal
				const normal = side.normal;
				const dot = dir.x * normal.x + dir.y * normal.y;
				dir.x = dir.x - 2 * dot * normal.x;
				dir.y = dir.y - 2 * dot * normal.y;
				// move pos a bit away from the wall to avoid precision issues
				ray.pos.x = intersection.x + normal.x * Constants.EPSILON;
				ray.pos.y = intersection.y + normal.y * Constants.EPSILON;
				return;
			}
		}
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
		};
		for (let i = 0; i < Constants.MAX_STEPS; i++) {
			result.push({ ...ray.pos });
			propagateRayMut(ray);
		}
	}
}

function initLevel(): Level {
	const root = new Simplex(0, [
		{ x: 100, y: 100 },
		{ x: 200, y: 100 },
		{ x: 100, y: 200 },
	]);

	const simplices: Simplex[] = [root];

	let currentSimplex = root;
	for (let i = 0; i < 5; i++) {
		// grow side B
		const l = 1.1 - Math.random() * 0.2;
		const newPoint: IVec2 = {
			x:
				currentSimplex.points[1]!.x +
				currentSimplex.points[2]!.x -
				l * currentSimplex.points[0]!.x,
			y:
				currentSimplex.points[1]!.y +
				currentSimplex.points[2]!.y -
				l * currentSimplex.points[0]!.y,
		};

		const newS = new Simplex(i + 1, [
			currentSimplex.points[1]!,
			currentSimplex.points[2]!,
			newPoint,
		]);
		currentSimplex.connectSimplexOnSide(1, newS);
		newS.connectSimplexOnSide(0, currentSimplex);

		simplices.push(newS);

		currentSimplex = newS;
	}

	return new Level(simplices, root);
}

export class Game {
	public time: number = 0;
	private readonly level: Level;
	private readonly player: Player;

	private ray: Ray | null = null;

	constructor(private readonly ctx: Ctx) {
		this.level = initLevel();
		this.player = new Player();
	}

	tick(deltaTime: number) {
		const { ctx } = this;
		const { level, player } = this;

		this.time += deltaTime;
		ctx.fillStyle = "black";
		ctx.fillRect(0, 0, Constants.WIDTH, Constants.HEIGHT);

		level.draw(ctx);
		player.draw(ctx);

		if (!this.ray) {
			const simplex = level.findSimplex(player.pos);
			if (simplex) {
				this.ray = {
					pos: { ...player.pos },
					dir: { ...player.dir },
					simplex,
				};
			}
		}

		if (this.ray) {
			const rayPoints: IVec2[] = [];
			level.castRay(this.ray.pos, this.ray.dir, rayPoints);
			ctx.strokeStyle = "red";
			ctx.beginPath();
			for (let i = 0; i < rayPoints.length; i++) {
				const p = rayPoints[i]!;
				if (i === 0) {
					ctx.moveTo(p.x, p.y);
				} else {
					ctx.lineTo(p.x, p.y);
				}
			}
			ctx.stroke();
		}
	}
}

let didInit = false;

export function doom(ctx: Ctx) {
	console.log("init");
	if (didInit) {
		return;
	}
	didInit = true;
	const game = new Game(ctx);

	function handleRaf(t: number) {
		game.tick(t);
		requestAnimationFrame(handleRaf);
	}

	requestAnimationFrame(handleRaf);
}
