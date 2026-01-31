import { Clut } from "@/Clut.ts";

const REFLECTION_CLUT = new Clut(
	Float32Array.from([0.8, 0.0, 0.0, 0.0, 0.8, 0.0, 0.0, 0.0, 0.8]),
);

export const Constants = {
	WIDTH: 640,
	HEIGHT: 480,
	LOWRES_WIDTH: 160,
	LOWRES_HEIGHT: 120,
	EPSILON: 0.01,
	MAX_DISTANCE: 10000,
	MAX_STEPS: 10,
	FOV: Math.PI / 3,
	TURN_ANGLE_STEP: Math.PI / 60,
	REFLECTION_CLUT,
};
