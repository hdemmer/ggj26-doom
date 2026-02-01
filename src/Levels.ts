import type { LevelShape } from "@/LevelShape.ts";

const LEVEL0: LevelShape = {
	polyline: [
		{
			x: 10,
			y: 10,
		},
		{
			x: 50,
			y: 10,
		},
		{
			x: 60,
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

const ROOM: LevelShape = {
	polyline: [
		{
			x: 100,
			y: 40,
		},
		{
			x: 140,
			y: 50,
		},
		{
			x: 180,
			y: 50,
		},
		{
			x: 220,
			y: 50,
		},
		{
			x: 250,
			y: 80,
		},
		{
			x: 240,
			y: 100,
		},
		{
			x: 200,
			y: 100,
		},
		{
			x: 160,
			y: 80,
		},
		{
			x: 160,
			y: 120,
		},
		{
			x: 140,
			y: 120,
		},
		{
			x: 140,
			y: 80,
		},
		{
			x: 100,
			y: 90,
		},
		{
			x: 60,
			y: 90,
		},
		{
			x: 20,
			y: 90,
		},
		{
			x: 20,
			y: 50,
		},
		{
			x: 60,
			y: 50,
		},
	],
	heartPositions: [
		{
			x: 180,
			y: 70,
		},
	],
	playerStartPos: {
		x: 40,
		y: 70,
	},
	playerStartAngle: 0,
	mirrorIndices: [3, 5, 10, 15],
	doorIndices: [8],
};

const CORRIDOR: LevelShape = {
	polyline: [
		{
			x: 100,
			y: 50,
		},
		{
			x: 140,
			y: 50,
		},
		{
			x: 180,
			y: 50,
		},
		{
			x: 650,
			y: 50,
		},
		{
			x: 650,
			y: 80,
		},
		{
			x: 180,
			y: 80,
		},
		{
			x: 140,
			y: 80,
		},
		{
			x: 100,
			y: 90,
		},
		{
			x: 60,
			y: 90,
		},
		{
			x: 20,
			y: 90,
		},
		{
			x: 20,
			y: 50,
		},
		{
			x: 60,
			y: 50,
		},
	],
	heartPositions: [],
	playerStartPos: {
		x: 40,
		y: 70,
	},
	playerStartAngle: 0,
	mirrorIndices: [6],
	doorIndices: [3],
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

export const LEVELS: LevelShape[] = [LEVEL0, ROOM, CORRIDOR, LEVEL1, LEVEL2];
