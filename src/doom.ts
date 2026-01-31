/** biome-ignore-all lint/style/noNonNullAssertion: asdf */

import { Constants } from "@/Constants.ts";
import { Heart } from "@/Heart.ts";
import type { IVec2 } from "@/IVec2.ts";
import { initLevel, initLevelFromShape } from "@/initLevel.ts";
import { LEVELS } from "@/Levels.ts";
import type { Level } from "@/level.ts";
import { Player } from "@/player.ts";
import { type Sprite, ThreeDee } from "@/ThreeDee.ts";

// biome-ignore lint/complexity/noStaticOnlyClass: asdf
export class Vec2 {
	static ZERO = { x: 0, y: 0 };
}

export type Ctx = CanvasRenderingContext2D;

export interface GameImages {
	floor: HTMLImageElement;
	ceiling: HTMLImageElement;
	wall: HTMLImageElement;
	door: HTMLImageElement;
	playerSprite: HTMLImageElement;
	helmetSprite: HTMLImageElement;
	frame: HTMLImageElement;
	heartSprite: HTMLImageElement;
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
	const [
		floor,
		ceiling,
		wall,
		door,
		playerSprite,
		maskSprite,
		frame,
		heartSprite,
	] = await Promise.all([
		loadImage("/assets/floor.jpg"),
		loadImage("/assets/ceiling.jpg"),
		loadImage("/assets/wall.jpg"),
		loadImage("/assets/door.jpg"),
		loadImage("/assets/player.png"),
		loadImage("/assets/mask.png"),
		loadImage("/assets/frame.png"),
		loadImage("/assets/heart.png"),
	]);
	console.log("All images loaded");
	return {
		floor,
		ceiling,
		wall,
		door,
		playerSprite,
		helmetSprite: maskSprite,
		frame,
		heartSprite,
	};
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
	public readonly doorImage: HTMLImageElement;
	public readonly playerSpriteImage: HTMLImageElement;
	public readonly helmetSpriteImage: HTMLImageElement;
	public readonly frameImage: HTMLImageElement;
	public readonly heartSpriteImage: HTMLImageElement;
	public readonly playerSprite: Sprite;
	public readonly hearts: Heart[] = [];
	public isInMirror: boolean = false;

	constructor(
		private readonly ctx: Ctx,
		images: GameImages,
	) {
		this.level = initLevel();
		// this.level = initLevelFromShape(LEVELS[0]!);
		// this.level = initLevelFromShape(
		// 	[
		// 		{ x: 50, y: 50 },
		// 		{ x: 300, y: 50 },
		// 		{ x: 300, y: 300 },
		// 		{ x: 50, y: 300 },
		// 	],
		// 	[
		// 		{ x: 100, y: 100 },
		// 		{ x: 250, y: 250 },
		// 	],
		// 	{ x: 175, y: 175 },
		// );
		this.player = new Player(this.level.playerStartPos);

		this.floorImage = images.floor;
		this.ceilingImage = images.ceiling;
		this.wallImage = images.wall;
		this.doorImage = images.door;
		this.playerSpriteImage = images.playerSprite;
		this.helmetSpriteImage = images.helmetSprite;
		this.frameImage = images.frame;
		this.heartSpriteImage = images.heartSprite;

		this.threeDee = new ThreeDee(this);

		// Add a playerSprite
		this.playerSprite = this.threeDee.addSprite(
			this.player.pos,
			this.player.size,
		);

		// Spawn hearts at level positions
		for (const pos of this.level.heartPositions) {
			this.hearts.push(new Heart(pos, this.threeDee));
		}

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
		const turnDir = this.isInMirror ? -1 : 1;
		if (this.keys.has("a") || this.keys.has("ArrowLeft")) {
			player.angle -= Constants.TURN_ANGLE_STEP * turnDir;
		}
		if (this.keys.has("d") || this.keys.has("ArrowRight")) {
			player.angle += Constants.TURN_ANGLE_STEP * turnDir;
		}

		const moveSpeed = 2;
		if (this.keys.has("w") || this.keys.has("ArrowUp")) {
			const delta = {
				x: Math.cos(player.angle) * moveSpeed,
				y: Math.sin(player.angle) * moveSpeed,
			};
			const mirrorPassages = player.moveTo(delta, level);
			if (mirrorPassages % 2 === 1) {
				this.isInMirror = !this.isInMirror;
			}
		}
		if (this.keys.has("s") || this.keys.has("ArrowDown")) {
			const delta = {
				x: -Math.cos(player.angle) * moveSpeed,
				y: -Math.sin(player.angle) * moveSpeed,
			};
			const mirrorPassages = player.moveTo(delta, level);
			if (mirrorPassages % 2 === 1) {
				this.isInMirror = !this.isInMirror;
			}
		}

		this.playerSprite.pos.x = player.pos.x;
		this.playerSprite.pos.y = player.pos.y;
		this.playerSprite.size = player.size;
		this.playerSprite.angle = player.angle;
		this.playerSprite.distanceTravelled = player.distanceTravelled;

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

		// this.debugDrawTextures(ctx);
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
		ctx.drawImage(
			this.playerSpriteImage,
			padding + (thumbSize + padding) * 3,
			padding,
			thumbSize,
			thumbSize,
		);
		ctx.drawImage(
			this.helmetSpriteImage,
			padding + (thumbSize + padding) * 4,
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

			level.castRay(ray.pos, ray.dir, this.rayPoints);
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
