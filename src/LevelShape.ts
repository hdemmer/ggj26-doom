import type { IVec2 } from "@/IVec2.ts";

export interface LevelShape {
	polyline: IVec2[];
	heartPositions: IVec2[];
	playerStartPos: IVec2;
	playerStartAngle: number;
	mirrorIndices: number[]; // Indices of the polyline that are mirrors
	doorIndices: number[]; // Indices of the polyline that are doors
}
