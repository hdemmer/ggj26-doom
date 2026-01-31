import type { LevelShape } from "@/LevelShape.ts";

const LEVEL1: LevelShape = {
	polyline: [
		{ x: 50, y: 50 },
		{ x: 270, y: 50 },
		{ x: 270, y: 190 },
		{ x: 200, y: 190 },
		{ x: 200, y: 150 },
		{ x: 120, y: 150 },
		{ x: 120, y: 190 },
		{ x: 50, y: 190 },
	],
	heartPositions: [
		{ x: 80, y: 80 },
		{ x: 240, y: 80 },
		{ x: 160, y: 160 },
	],
	playerStartPos: { x: 160, y: 170 },
};

export const LEVELS: LevelShape[] = [LEVEL1];
