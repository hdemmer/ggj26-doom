/** biome-ignore-all lint/style/noNonNullAssertion: asdf */

import { Constants } from "@/Constants.ts";
import { Health } from "@/Health.ts";
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
	instructions: HTMLImageElement;
	end: HTMLImageElement;
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
		instructions,
		end,
	] = await Promise.all([
		loadImage("/assets/floor.jpg"),
		loadImage("/assets/ceiling.jpg"),
		loadImage("/assets/wall.jpg"),
		loadImage("/assets/door.png"),
		loadImage("/assets/player.png"),
		loadImage("/assets/mask.png"),
		loadImage("/assets/frame.png"),
		loadImage("/assets/heart.png"),
		loadImage("/assets/instructions.png"),
		loadImage("/assets/end.png"),
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
		instructions,
		end,
	};
}

export class Game {
	public time: number = 0;
	public levelIndex: number = 1;
	public level: Level;
	public readonly player: Player;
	private readonly threeDee: ThreeDee;
	private drawDebug: boolean = false;

	private rayPoints: IVec2[] = [];

	private keys: Set<string> = new Set();
	private lastKeyTime: number = 0;

	public readonly floorImage: HTMLImageElement;
	public readonly ceilingImage: HTMLImageElement;
	public readonly wallImage: HTMLImageElement;
	public readonly doorImage: HTMLImageElement;
	public readonly playerSpriteImage: HTMLImageElement;
	public readonly helmetSpriteImage: HTMLImageElement;
	public readonly frameImage: HTMLImageElement;
	public readonly heartSpriteImage: HTMLImageElement;
	public readonly instructionsImage: HTMLImageElement;
	public readonly endImage: HTMLImageElement;
	public readonly playerSprite: Sprite;
	public readonly health: Health = new Health();
	public readonly hearts: Heart[] = [];
	public isInMirror: boolean = false;
	private hasMovedInLevel: boolean = false;
	private lastDistanceTravelled: number = 0;

	constructor(
		private readonly ctx: Ctx,
		images: GameImages,
	) {
		// this.level = initLevel();
		this.level = initLevelFromShape(LEVELS[0]!);
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
		this.instructionsImage = images.instructions;
		this.endImage = images.end;

		this.threeDee = new ThreeDee(this);

		// Add a playerSprite
		this.playerSprite = this.threeDee.addSprite(
			this.player.pos,
			this.player.size,
		);

		this.loadLevel();

		this.castRay();
		this.threeDee.update();

		window.addEventListener("keydown", (e) => {
			this.keys.add(e.key);
		});
		window.addEventListener("keyup", (e) => {
			this.keys.delete(e.key);
		});
	}

	getShowInstructions() {
		return this.levelIndex === 0;
	}

	getShowEnd() {
		return this.levelIndex === LEVELS.length - 1;
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
		const time = performance.now();
		if (time - this.lastKeyTime > 100) {
			this.lastKeyTime = time;

			if (this.keys.has("r")) {
				// reset level
				this.loadLevel();
			}
			if (this.keys.has("l")) {
				// skip level
				this.levelIndex++;
				if (this.levelIndex >= LEVELS.length) {
					this.levelIndex = 0;
				}
				this.loadLevel();
			}
			if (this.keys.has("m")) {
				this.drawDebug = !this.drawDebug;
			}
		}

		const moveSpeed = 2;
		if (this.keys.has("w") || this.keys.has("ArrowUp")) {
			this.hasMovedInLevel = true;
			const delta = {
				x: Math.cos(player.angle) * moveSpeed,
				y: Math.sin(player.angle) * moveSpeed,
			};
			const { mirrorPassages, hitDoor } = player.moveTo(delta, level);
			if (mirrorPassages % 2 === 1) {
				this.isInMirror = !this.isInMirror;
			}
			if (hitDoor) {
				console.log("Hit door, next level");
				this.levelIndex++;
				if (this.levelIndex >= LEVELS.length) {
					// restart from first level
					this.levelIndex = 0;
				}
				this.loadLevel();
			}
		}
		if (this.keys.has("s") || this.keys.has("ArrowDown")) {
			this.hasMovedInLevel = true;
			const delta = {
				x: -Math.cos(player.angle) * moveSpeed,
				y: -Math.sin(player.angle) * moveSpeed,
			};
			const { mirrorPassages, hitDoor } = player.moveTo(delta, level);
			if (mirrorPassages % 2 === 1) {
				this.isInMirror = !this.isInMirror;
			}
			if (hitDoor) {
				this.loadLevel();
			}
		}

		if (this.hasMovedInLevel) {
			// don't update health on first and last levels, or before player has moved
			const distanceDelta =
				player.distanceTravelled - this.lastDistanceTravelled;
			this.lastDistanceTravelled = player.distanceTravelled;
			this.health.update(
				distanceDelta * level.healthMultiplier,
				this.isInMirror,
			);
			if (this.health.isAtLimit()) {
				this.loadLevel();
			}
		}

		// Check heart collection
		for (let i = this.hearts.length - 1; i >= 0; i--) {
			const heart = this.hearts[i]!;
			const dx = player.pos.x - heart.pos.x;
			const dy = player.pos.y - heart.pos.y;
			const distance = Math.sqrt(dx * dx + dy * dy);
			if (distance < player.size) {
				this.health.addInDirection(-100, this.isInMirror);
				this.threeDee.removeSprite(heart.sprite);
				this.hearts.splice(i, 1);
			}
		}

		this.playerSprite.pos.x = player.pos.x;
		this.playerSprite.pos.y = player.pos.y;
		this.playerSprite.size = player.size;
		this.playerSprite.angle = player.angle;
		this.playerSprite.distanceTravelled = player.distanceTravelled;

		this.castRay();
		this.threeDee.update(this.health.getMultiplier());

		ctx.fillStyle = "black";
		ctx.fillRect(0, 0, Constants.WIDTH, Constants.HEIGHT);

		this.threeDee.draw(ctx);

		if (this.drawDebug) {
			this.debugDrawLevel(ctx);
		}
		// this.debugDrawTextures(ctx);
	}

	private loadLevel() {
		console.log("loadLevel");
		const levelShape = LEVELS[this.levelIndex]!;
		this.level = initLevelFromShape(levelShape);
		this.player.pos = { ...this.level.playerStartPos };
		this.player.angle = this.level.playerStartAngle;
		this.isInMirror = false;
		this.hasMovedInLevel = false;
		this.lastDistanceTravelled = this.player.distanceTravelled;
		this.hearts.length = 0;
		for (const pos of this.level.heartPositions) {
			this.hearts.push(new Heart(pos, this.threeDee));
		}
		this.health.reset();
	}

	private debugDrawLevel(ctx: Ctx) {
		this.level.draw(ctx);
		this.player.draw(ctx);

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

	let lastTime = performance.now();
	function handleRaf(t: number) {
		const deltaTime = t - lastTime;
		lastTime = t;
		game.tick(deltaTime);
		requestAnimationFrame(handleRaf);
	}

	requestAnimationFrame(handleRaf);
}
