import type { Clut } from "@/Clut.ts";
import type { IVec2 } from "@/IVec2.ts";

import type { Simplex } from "@/simplex.ts";

export interface SimplexSide {
	start: IVec2;
	end: IVec2;
	normal: IVec2;
	simplex: Simplex | null;
	isMirror: boolean;
	isDoor: boolean;
	mirrorClut: Clut | null;
}
