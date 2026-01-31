import { Constants } from "@/Constants.ts";
import { Vec2 } from "@/doom.ts";
import type { IVec2 } from "@/IVec2.ts";
import { intersectLineLine } from "@/intersectLineLine.ts";
import type { Ray } from "@/ray.ts";

export function propagateRayMut(ray: Ray): void {
	const { pos, dir, simplex, sideIndex } = ray;
	const target = {
		x: pos.x + Constants.MAX_DISTANCE * dir.x,
		y: pos.y + Constants.MAX_DISTANCE * dir.y,
	};
	const intersection: IVec2 = { ...Vec2.ZERO };
	// iterate over sides
	for (let i = 0; i < simplex.sides.length; i++) {
		if (i === sideIndex) {
			continue; // skip the side we entered from
		}
		const side = simplex.sides[i]!;
		if (
			intersectLineLine(
				pos.x,
				pos.y,
				target.x,
				target.y,
				side.start.x,
				side.start.y,
				side.end.x,
				side.end.y,
				intersection,
			)
		) {
			// hit this side
			if (side.simplex) {
				// console.log("propagating to neighbor simplex", side.simplex.id);
				// has neighbor, propagate ray
				ray.pos.x = intersection.x;
				ray.pos.y = intersection.y;
				ray.simplex = side.simplex;
				// Find the side index in the NEW simplex that connects back to the OLD simplex
				const newSideIndex = side.simplex.findSideIndexForSimplex(simplex);
				ray.sideIndex = newSideIndex;
				// console.log("newSideIndex", newSideIndex);

				return;
			} else {
				if (side.isMirror) {
					// no neighbor, reflect ray on side normal
					const normal = side.normal;
					const dot = dir.x * normal.x + dir.y * normal.y;
					dir.x = dir.x - 2 * dot * normal.x;
					dir.y = dir.y - 2 * dot * normal.y;
					// move pos a bit away from the wall to avoid precision issues
					ray.pos.x = intersection.x + normal.x * Constants.EPSILON;
					ray.pos.y = intersection.y + normal.y * Constants.EPSILON;
					ray.sideIndex = i; // now on this side after reflection

					ray.numReflections++;
					if (ray.clut) {
						// apply reflection clut: Constants.REFLECTION_CLUT
						ray.clut.multiplyMut(Constants.REFLECTION_CLUT);
					}

					return;
				} else {
					// ray terminates
					// console.log("ray terminated at wall");
					ray.pos.x = intersection.x;
					ray.pos.y = intersection.y;
					ray.sideIndex = -1;
					ray.isTerminated = true;

					// terminalU is the length along the wall where the ray hit, from 0 to 1
					ray.terminalU =
						Math.hypot(
							intersection.x - side.start.x,
							intersection.y - side.start.y,
						) /
						Math.hypot(side.end.x - side.start.x, side.end.y - side.start.y);
					return;
				}
			}
		}
	}
}
