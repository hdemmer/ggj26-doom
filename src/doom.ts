/** biome-ignore-all lint/style/noNonNullAssertion: asdf */

import type { Clut } from "@/Clut.ts";
import { Constants } from "@/Constants.ts";
import type { IVec2 } from "@/IVec2.ts";
import { initLevel } from "@/initLevel.ts";
import { Player } from "@/player.ts";
import { pointInTriangle } from "@/pointInTriangle.ts";
import { propagateRayMut } from "@/propagateRayMut.ts";
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

	castRay(origin: IVec2, direction: IVec2, clut: Clut | null, result: IVec2[]) {
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
			clut,
			numReflections: 0,
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

export interface GameImages {
	floor: HTMLImageElement;
	ceiling: HTMLImageElement;
	wall: HTMLImageElement;
}

function loadImage(src: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = reject;
		img.src = src;
	});
}

export async function loadGameImages(): Promise<GameImages> {
	const [floor, ceiling, wall] = await Promise.all([
		loadImage("/assets/floor.jpg"),
		loadImage("/assets/ceiling.jpg"),
		loadImage("/assets/wall.jpg"),
	]);
	console.log("All images loaded");
	return { floor, ceiling, wall };
}

export class Game {
	public time: number = 0;
	public readonly level: Level;
	public readonly player: Player;
	private readonly threeDee: ThreeDee;

	private rayPoints: IVec2[] = [];

	private keys: Set<string> = new Set();

	public readonly floorImage: HTMLImageElement;
	public readonly ceilingImage: HTMLImageElement;
	public readonly wallImage: HTMLImageElement;

	constructor(
		private readonly ctx: Ctx,
		images: GameImages,
	) {
		this.level = initLevel();
		this.player = new Player();

		this.floorImage = images.floor;
		this.ceilingImage = images.ceiling;
		this.wallImage = images.wall;

		this.threeDee = new ThreeDee(this);

		this.castRay();
		this.threeDee.update();

		window.addEventListener("keydown", (e) => {
			this.keys.add(e.key);
		});
		window.addEventListener("keyup", (e) => {
			this.keys.delete(e.key);
		});
	}

	tick(deltaTime: number) {
		const { ctx } = this;
		const { level, player } = this;

		this.time += deltaTime;

		// Handle input
		if (this.keys.has("a") || this.keys.has("ArrowLeft")) {
			player.angle -= Constants.TURN_ANGLE_STEP;
		}
		if (this.keys.has("d") || this.keys.has("ArrowRight")) {
			player.angle += Constants.TURN_ANGLE_STEP;
		}

		const moveSpeed = 2;
		if (this.keys.has("w") || this.keys.has("ArrowUp")) {
			const targetX = player.pos.x + Math.cos(player.angle) * moveSpeed;
			const targetY = player.pos.y + Math.sin(player.angle) * moveSpeed;
			if (level.findSimplex({ x: targetX, y: targetY })) {
				player.pos.x = targetX;
				player.pos.y = targetY;
			}
		}
		if (this.keys.has("s") || this.keys.has("ArrowDown")) {
			const targetX = player.pos.x - Math.cos(player.angle) * moveSpeed;
			const targetY = player.pos.y - Math.sin(player.angle) * moveSpeed;
			if (level.findSimplex({ x: targetX, y: targetY })) {
				player.pos.x = targetX;
				player.pos.y = targetY;
			}
		}

		this.castRay();
		this.threeDee.update();

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

	private debugDrawTextures(ctx: Ctx) {
		const thumbSize = 64;
		const padding = 10;
		ctx.drawImage(this.floorImage, padding, padding, thumbSize, thumbSize);
		ctx.drawImage(
			this.ceilingImage,
			padding + thumbSize + padding,
			padding,
			thumbSize,
			thumbSize,
		);
		ctx.drawImage(
			this.wallImage,
			padding + (thumbSize + padding) * 2,
			padding,
			thumbSize,
			thumbSize,
		);

		ctx.fillStyle = "white";
		ctx.font = "10px monospace";
		ctx.fillText("floor", padding, padding + thumbSize + 12);
		ctx.fillText(
			"ceiling",
			padding + thumbSize + padding,
			padding + thumbSize + 12,
		);
		ctx.fillText(
			"wall",
			padding + (thumbSize + padding) * 2,
			padding + thumbSize + 12,
		);
	}

	castRay() {
		const { level, player } = this;
		this.rayPoints.length = 0;
		const simplex = level.findSimplex(player.pos);
		if (simplex) {
			const dir = {
				x: Math.cos(player.angle),
				y: Math.sin(player.angle),
			};
			const ray = {
				pos: { ...player.pos },
				dir,
				simplex,
			};

			level.castRay(ray.pos, ray.dir, null, this.rayPoints);
		}
	}
}

let didInit = false;

export async function doom(ctx: Ctx) {
	console.log("init");
	if (didInit) {
		return;
	}
	didInit = true;

	const images = await loadGameImages();
	const game = new Game(ctx, images);
	(window as any).game = game;

	function handleRaf(t: number) {
		game.tick(t);
		requestAnimationFrame(handleRaf);
	}

	requestAnimationFrame(handleRaf);
}
