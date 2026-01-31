import { Clut } from "@/Clut.ts";

const REFLECTION_CLUT = new Clut(
	Float32Array.from([0.8, 0.0, 0.0, 0.0, 0.8, 0.0, 0.0, 0.0, 0.8]),
);

const MAX_STEPS = 10;

// Pre-generate gentle hue shift cluts for each reflection step
const REFLECTION_CLUTS: Clut[] = [];
for (let i = 0; i < MAX_STEPS; i++) {
	// Small random hue shifts between -15 and +15 degrees
	const angle = (Math.random() - 0.5) * (Math.PI / 6);
	REFLECTION_CLUTS.push(Clut.makeHueShift(angle));
}

export const Constants = {
	WIDTH: 640,
	HEIGHT: 480,
	LOWRES_WIDTH: 320,
	LOWRES_HEIGHT: 240,
	EPSILON: 0.01,
	MAX_DISTANCE: 10000,
	MAX_STEPS,
	FOV: Math.PI / 3,
	TURN_ANGLE_STEP: Math.PI / 60,
	REFLECTION_CLUT,
	REFLECTION_CLUTS,
	PLAYER_Y_FUDGE: 20,
};
