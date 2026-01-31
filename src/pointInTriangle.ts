//http://www.blackpawn.com/texts/pointinpoly/
import type { IVec2 } from "@/IVec2.ts";

export function pointInTriangle(point: IVec2, t0: IVec2, t1: IVec2, t2: IVec2) {
	//compute vectors & dot products
	const cx = point.x,
		cy = point.y,
		v0x = t2.x - t0.x,
		v0y = t2.y - t0.y,
		v1x = t1.x - t0.x,
		v1y = t1.y - t0.y,
		v2x = cx - t0.x,
		v2y = cy - t0.y,
		dot00 = v0x * v0x + v0y * v0y,
		dot01 = v0x * v1x + v0y * v1y,
		dot02 = v0x * v2x + v0y * v2y,
		dot11 = v1x * v1x + v1y * v1y,
		dot12 = v1x * v2x + v1y * v2y;

	// Compute barycentric coordinates
	const b = dot00 * dot11 - dot01 * dot01,
		inv = b === 0 ? 0 : 1 / b,
		u = (dot11 * dot02 - dot01 * dot12) * inv,
		v = (dot00 * dot12 - dot01 * dot02) * inv;
	return u >= 0 && v >= 0 && u + v < 1;
}
