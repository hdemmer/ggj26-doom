import type { Clut } from "@/Clut.ts";
import type { Simplex } from "@/doom.ts";
import type { IVec2 } from "@/IVec2.ts";

export interface Ray {
	simplex: Simplex;
	pos: IVec2;
	dir: IVec2;
	sideIndex: number; // -1 if not on a side, otherwise the index of the side we entered from
	isTerminated: boolean;
	clut: Clut | null;
	numReflections: number;
}
