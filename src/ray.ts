import type { Clut } from "@/Clut.ts";
import type { IVec2 } from "@/IVec2.ts";
import type { Simplex } from "@/simplex.ts";

export interface Ray {
	simplex: Simplex;
	pos: IVec2;
	dir: IVec2;
	sideIndex: number; // -1 if not on a side, otherwise the index of the side we entered from
	isTerminated: boolean;
	terminalU: number;
	wasReflection: boolean;
	reflectionU: number; // u coordinate along the mirror wall when reflecting
	numReflections: number;
	reflectionClut: Clut | null;
}
