import type { Simplex } from "@/doom.ts";
import type { IVec2 } from "@/IVec2.ts";

export interface Ray {
	simplex: Simplex;
	pos: IVec2;
	dir: IVec2;
	// TODO: store which simplex side this is on to avoid precision errors ...
}
