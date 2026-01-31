/** biome-ignore-all lint/style/noNonNullAssertion: asdf */
import { Constants } from "@/Constants.ts";
import type { IVec2 } from "@/IVec2.ts";
import { initLevel } from "@/initLevel.ts";
import { intersectLineLine } from "@/intersectLineLine.ts";
import { Player } from "@/player.ts";
import { pointInTriangle } from "@/pointInTriangle.ts";
import type { Ray } from "@/ray.ts";
import { ThreeDee } from "@/ThreeDee.ts";

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
	isMirror: boolean;
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
				isMirror: false,
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
	const { pos, dir, simplex, sideIndex } = ray;
	const target = {
		x: pos.x + Constants.MAX_DISTANCE * dir.x,
		y: pos.y + Constants.MAX_DISTANCE * dir.y,
	};
	const intersection: IVec2 = { ...Vec2.ZERO };
	// iterate over sides
	for (let i = 0; i < simplex.sides.length; i++) {
		if (i === sideIndex) {
			continue; // skip the side we entered from
		}
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
				console.log("propagating to neighbor simplex", side.simplex.id);
				// has neighbor, propagate ray
				ray.pos.x = intersection.x;
				ray.pos.y = intersection.y;
				ray.simplex = side.simplex;
				// Find the side index in the NEW simplex that connects back to the OLD simplex
				const newSideIndex = side.simplex.findSideIndexForSimplex(simplex);
				ray.sideIndex = newSideIndex;
				console.log("newSideIndex", newSideIndex);

				return;
			} else {
				if (side.isMirror) {
					// no neighbor, reflect ray on side normal
					const normal = side.normal;
					const dot = dir.x * normal.x + dir.y * normal.y;
					dir.x = dir.x - 2 * dot * normal.x;
					dir.y = dir.y - 2 * dot * normal.y;
					// move pos a bit away from the wall to avoid precision issues
					ray.pos.x = intersection.x + normal.x * Constants.EPSILON;
					ray.pos.y = intersection.y + normal.y * Constants.EPSILON;
					ray.sideIndex = i; // now on this side after reflection
					return;
				} else {
					// ray terminates
					console.log("ray terminated at wall");
					ray.pos.x = intersection.x;
					ray.pos.y = intersection.y;
					ray.sideIndex = -1;
					ray.isTerminated = true;
					return;
				}
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
			sideIndex: -1,
			isTerminated: false,
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

export class Game {
	public time: number = 0;
	public readonly level: Level;
	public readonly player: Player;
	private readonly threeDee: ThreeDee;

	private rayPoints: IVec2[] = [];

	constructor(private readonly ctx: Ctx) {
		this.level = initLevel();
		this.player = new Player();

		this.threeDee = new ThreeDee(this);

		this.castRay();
		this.threeDee.update();
	}

	tick(deltaTime: number) {
		const { ctx } = this;
		const { level, player } = this;

		this.time += deltaTime;
		ctx.fillStyle = "black";
		ctx.fillRect(0, 0, Constants.WIDTH, Constants.HEIGHT);

		this.threeDee.draw(ctx);

		level.draw(ctx);
		player.draw(ctx);

		ctx.strokeStyle = "red";
		ctx.beginPath();
		for (const p of this.rayPoints) {
			for (let i = 0; i < this.rayPoints.length; i++) {
				const p = this.rayPoints[i]!;
				if (i === 0) {
					ctx.moveTo(p.x, p.y);
				} else {
					ctx.lineTo(p.x, p.y);
				}
			}
		}
		ctx.stroke();
	}

	castRay() {
		const { level, player } = this;
		this.rayPoints.length = 0;
		const simplex = level.findSimplex(player.pos);
		if (simplex) {
			const ray = {
				pos: { ...player.pos },
				dir: { ...player.dir },
				simplex,
			};

			level.castRay(ray.pos, ray.dir, this.rayPoints);
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
	(window as any).game = game;

	function handleRaf(t: number) {
		game.tick(t);
		requestAnimationFrame(handleRaf);
	}

	requestAnimationFrame(handleRaf);
}
