import type { IVec2 } from "@/IVec2.ts";

export interface LevelShape {
	polyline: IVec2[];
	heartPositions: IVec2[];
	playerStartPos: IVec2;
}
