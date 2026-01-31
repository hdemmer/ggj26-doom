import type { IVec2 } from "@/IVec2.ts";
import type { RayCircleHit } from "@/RayCircleHit.ts";
import type { Sprite } from "@/ThreeDee.ts";

export function rayCircleIntersect(
	rayOrigin: IVec2,
	rayDir: IVec2,
	sprite: Sprite,
): RayCircleHit | null {
	// Vector from ray origin to sprite center
	const ocX = sprite.pos.x - rayOrigin.x;
	const ocY = sprite.pos.y - rayOrigin.y;

	// Project OC onto ray direction to find closest approach
	const tClosest = ocX * rayDir.x + ocY * rayDir.y;

	// If closest point is behind ray origin, no intersection
	if (tClosest < 0) {
		return null;
	}

	// Distance squared from sprite center to closest point on ray
	const closestX = rayOrigin.x + tClosest * rayDir.x;
	const closestY = rayOrigin.y + tClosest * rayDir.y;
	const distSq =
		(closestX - sprite.pos.x) ** 2 + (closestY - sprite.pos.y) ** 2;

	const radiusSq = sprite.size * sprite.size;
	if (distSq > radiusSq) {
		return null;
	}

	// Compute entry distance
	const halfChord = Math.sqrt(radiusSq - distSq);
	const tEntry = tClosest - halfChord;

	if (tEntry < 0) {
		return null;
	}

	// Compute U coordinate: where along the sprite width did we hit?
	// We use the perpendicular offset from sprite center
	const hitX = rayOrigin.x + tEntry * rayDir.x;
	const hitY = rayOrigin.y + tEntry * rayDir.y;

	// Perpendicular direction (90 degrees from ray towards camera right)
	const perpX = -rayDir.y;
	const perpY = rayDir.x;

	// Signed offset from sprite center along perpendicular
	const offsetX = hitX - sprite.pos.x;
	const offsetY = hitY - sprite.pos.y;
	const perpOffset = offsetX * perpX + offsetY * perpY;

	// Map to 0-1 range
	const u = 0.5 + perpOffset / (2 * sprite.size);

	return { distance: tEntry, u: Math.max(0, Math.min(1, u)) };
}
