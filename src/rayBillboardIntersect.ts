import type { IVec2 } from "@/IVec2.ts";
import type { RayCircleHit } from "@/RayCircleHit.ts";
import type { Sprite } from "@/ThreeDee.ts";

/**
 * Intersects a ray with a billboard sprite.
 * Uses the same closest-approach logic as circles but treats
 * the sprite as a flat billboard (no curved entry point).
 */
export function rayBillboardIntersect(
	rayOrigin: IVec2,
	rayDir: IVec2,
	sprite: Sprite,
): RayCircleHit | null {
	// Vector from ray origin to sprite center
	const toSpriteX = sprite.pos.x - rayOrigin.x;
	const toSpriteY = sprite.pos.y - rayOrigin.y;

	// Distance along ray to closest approach point
	const tClosest = toSpriteX * rayDir.x + toSpriteY * rayDir.y;

	if (tClosest <= 0) {
		return null; // Sprite is behind ray origin
	}

	// Signed perpendicular distance from ray to sprite center
	// (perpendicular direction is 90° counterclockwise from rayDir)
	const perpOffset =
		(rayOrigin.x - sprite.pos.x) * -rayDir.y +
		(rayOrigin.y - sprite.pos.y) * rayDir.x;

	// Check if ray passes through billboard width
	if (Math.abs(perpOffset) > sprite.size) {
		return null;
	}

	// Map perpendicular offset to U coordinate [0, 1]
	const u = 0.5 + perpOffset / (2 * sprite.size);

	return { distance: tClosest, u: Math.max(0, Math.min(1, u)) };
}
