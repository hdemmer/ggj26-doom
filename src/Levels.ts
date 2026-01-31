import type { LevelShape } from "@/LevelShape.ts";

const LEVEL1: LevelShape = {
	polyline: [
		{
			x: 360,
			y: 220,
		},
		{
			x: 420,
			y: 220,
		},
		{
			x: 420,
			y: 300,
		},
		{
			x: 457,
			y: 300,
		},
		{
			x: 460,
			y: 340,
		},
		{
			x: 360,
			y: 340,
		},
		{
			x: 360,
			y: 300,
		},
		{
			x: 400,
			y: 300,
		},
		{
			x: 400,
			y: 260,
		},
		{
			x: 360,
			y: 260,
		},
	],
	heartPositions: [],
	playerStartPos: {
		x: 400,
		y: 320,
	},
	playerStartAngle: 0,
	mirrorIndices: [3, 5],
	doorIndices: [9],
};

export const LEVELS: LevelShape[] = [LEVEL1];
