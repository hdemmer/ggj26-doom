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
	trueEnding: HTMLImageElement;
}

// Asset URL mapping - can be overridden for embedded builds
let assetUrls: Record<string, string> = {};

export function setAssetUrls(urls: Record<string, string>) {
	assetUrls = urls;
}

function getAssetUrl(name: string): string {
	return assetUrls[name] || `/assets/${name}`;
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
		trueEnding,
	] = await Promise.all([
		loadImage(getAssetUrl("floor.jpg")),
		loadImage(getAssetUrl("ceiling.jpg")),
		loadImage(getAssetUrl("wall.jpg")),
		loadImage(getAssetUrl("door.png")),
		loadImage(getAssetUrl("player.png")),
		loadImage(getAssetUrl("mask.png")),
		loadImage(getAssetUrl("frame.png")),
		loadImage(getAssetUrl("heart.png")),
		loadImage(getAssetUrl("instructions.png")),
		loadImage(getAssetUrl("end.png")),
		loadImage(getAssetUrl("true_ending.png")),
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
		trueEnding,
	};
}

export class Game {
	public time: number = 0;
	public levelIndex: number = 0;
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
	public readonly trueEndingImage: HTMLImageElement;
	public readonly playerSprite: Sprite;
	public readonly health: Health = new Health();
	public readonly hearts: Heart[] = [];
	public isInMirror: boolean = false;
	private hasMovedInLevel: boolean = false;
	private initialHeartCount: number = 0;
	private maxHeartsCollected: Map<number, number> = new Map();
	public readonly totalHeartsPerLevel: number[] = LEVELS.map(
		(level) => level.heartPositions.length,
	);
	private lastDistanceTravelled: number = 0;
	private transitionTimeRemaining: number = 0;
	private transitionColor: string = "grey";

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
		this.trueEndingImage = images.trueEnding;

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
		return (
			this.levelIndex === LEVELS.length - 1 && !this.hasCollectedAllHearts()
		);
	}

	getShowTrueEnding() {
		return (
			this.levelIndex === LEVELS.length - 1 && this.hasCollectedAllHearts()
		);
	}

	private hasCollectedAllHearts(): boolean {
		for (let i = 0; i < this.totalHeartsPerLevel.length; i++) {
			const total = this.totalHeartsPerLevel[i]!;
			if (total === 0) continue;
			const collected = this.maxHeartsCollected.get(i) ?? 0;
			if (collected < total) return false;
		}
		return true;
	}

	tick(deltaTime: number) {
		const { ctx } = this;
		const { level, player } = this;

		// Handle level transition
		if (this.transitionTimeRemaining > 0) {
			this.transitionTimeRemaining -= deltaTime;
			ctx.fillStyle = this.transitionColor;
			ctx.fillRect(0, 0, Constants.WIDTH, Constants.HEIGHT);
			if (this.transitionColor === "black" || this.transitionColor === "white") {
				if (this.transitionColor === "white") {
					ctx.filter = "invert(1)";
				}
				ctx.drawImage(
					this.helmetSpriteImage,
					0,
					0,
					Constants.WIDTH,
					Constants.HEIGHT,
				);
				ctx.filter = "none";
			}
			return;
		}

		this.time += deltaTime;

		// Lock controls on true ending
		if (this.getShowTrueEnding()) {
			this.castRay();
			this.threeDee.update(this.health.getMultiplier());
			ctx.fillStyle = "black";
			ctx.fillRect(0, 0, Constants.WIDTH, Constants.HEIGHT);
			this.threeDee.draw(ctx);
			return;
		}

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
				this.transitionColor = "grey";
				this.loadLevel();
			}
			if (this.keys.has("l")) {
				// skip level
				this.transitionColor = "grey";
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
				this.transitionColor = "grey";
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
				this.transitionColor = "grey";
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
				this.transitionColor = this.health.current > 0 ? "white" : "black";
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
				this.health.addInDirection(-1 * Constants.HEART_VALUE, this.isInMirror);
				this.threeDee.removeSprite(heart.sprite);
				this.hearts.splice(i, 1);
				if (this.health.isAtLimit()) {
					this.transitionColor = this.health.current > 0 ? "white" : "black";
					this.loadLevel();
				}
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
		// Track hearts collected before resetting
		this.recordHeartsCollected();
		console.log("loadLevel");
		this.transitionTimeRemaining =
			this.transitionColor === "black"
				? Constants.LONG_TRANSITION_DURATION
				: Constants.TRANSITION_DURATION;
		const levelShape = LEVELS[this.levelIndex]!;
		this.level = initLevelFromShape(levelShape);
		this.player.pos = { ...this.level.playerStartPos };
		this.player.angle = this.level.playerStartAngle;
		this.isInMirror = false;
		this.hasMovedInLevel = false;
		this.lastDistanceTravelled = this.player.distanceTravelled;
		for (const heart of this.hearts) {
			this.threeDee.removeSprite(heart.sprite);
		}
		this.hearts.length = 0;
		for (const pos of this.level.heartPositions) {
			this.hearts.push(new Heart(pos, this.threeDee));
		}
		this.initialHeartCount = this.hearts.length;
		this.health.reset();
	}

	private recordHeartsCollected() {
		if (this.initialHeartCount === 0) return;
		const heartsCollected = this.initialHeartCount - this.hearts.length;
		const currentMax = this.maxHeartsCollected.get(this.levelIndex) ?? 0;
		if (heartsCollected > currentMax) {
			this.maxHeartsCollected.set(this.levelIndex, heartsCollected);
			console.log(
				`Level ${this.levelIndex}: New max hearts collected: ${heartsCollected}`,
			);
		}
	}

	getMaxHeartsPerLevel(): Map<number, number> {
		return new Map(this.maxHeartsCollected);
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

	// Play background music
	const music = new Audio(getAssetUrl("dronebeat.mp3"));
	music.loop = true;
	music.play().catch((e) => {
		// Autoplay may be blocked, start on first user interaction
		const startMusic = () => {
			music.play();
			window.removeEventListener("keydown", startMusic);
		};
		window.addEventListener("keydown", startMusic);
	});

	let lastTime = performance.now();
	function handleRaf(t: number) {
		const deltaTime = t - lastTime;
		lastTime = t;
		game.tick(deltaTime);
		requestAnimationFrame(handleRaf);
	}

	requestAnimationFrame(handleRaf);
}
