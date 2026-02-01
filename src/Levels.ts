import type { LevelShape } from "@/LevelShape.ts";

const LEVEL0: LevelShape = {
	polyline: [
		{
			x: 10,
			y: 10,
		},
		{
			x: 70,
			y: 10,
		},
		{
			x: 73,
			y: 50,
		},
		{
			x: 210,
			y: 90,
		},
		{
			x: 150,
			y: 90,
		},
		{
			x: 120,
			y: 90,
		},
		{
			x: 50,
			y: 90,
		},
		{
			x: 10,
			y: 50,
		},
	],
	heartPositions: [],
	playerStartPos: {
		x: 25.1,
		y: 26.1,
	},
	playerStartAngle: 0,
	mirrorIndices: [1, 7],
	doorIndices: [4],
};

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
			x: 359,
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

const LEVEL2: LevelShape = {
	polyline: [
		{
			x: 10,
			y: 10,
		},
		{
			x: 30,
			y: 10,
		},
		{
			x: 30,
			y: 20,
		},
		{
			x: 50,
			y: 40,
		},
		{
			x: 60,
			y: 40,
		},
		{
			x: 60,
			y: 60,
		},
		{
			x: 60,
			y: 70,
		},
		{
			x: 40,
			y: 70,
		},
		{
			x: 40,
			y: 50,
		},
		{
			x: 20,
			y: 30,
		},
		{
			x: 10,
			y: 20,
		},
	],
	heartPositions: [],
	playerStartPos: {
		x: 15,
		y: 15,
	},
	playerStartAngle: 0,
	mirrorIndices: [2, 4, 8],
	doorIndices: [6],
};

export const LEVELS: LevelShape[] = [LEVEL0, LEVEL1, LEVEL2];
