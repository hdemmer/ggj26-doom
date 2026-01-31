import type { IVec2 } from "@/IVec2.ts";

/**
 * Check if a line segment intersects a circle.
 * Returns the closest intersection point if found, null otherwise.
 */
export function intersectLineCircle(
	p1: IVec2,
	p2: IVec2,
	center: IVec2,
	radius: number,
	result: IVec2,
): boolean {
	const dx = p2.x - p1.x;
	const dy = p2.y - p1.y;
	const fx = p1.x - center.x;
	const fy = p1.y - center.y;

	const a = dx * dx + dy * dy;
	const b = 2 * (fx * dx + fy * dy);
	const c = fx * fx + fy * fy - radius * radius;

	const discriminant = b * b - 4 * a * c;
	if (discriminant < 0) {
		return false;
	}

	const sqrtDisc = Math.sqrt(discriminant);
	const t1 = (-b - sqrtDisc) / (2 * a);
	const t2 = (-b + sqrtDisc) / (2 * a);

	// Use the smallest positive t in [0, 1]
	let t = -1;
	if (t1 >= 0 && t1 <= 1) {
		t = t1;
	} else if (t2 >= 0 && t2 <= 1) {
		t = t2;
	}

	if (t < 0) {
		return false;
	}

	result.x = p1.x + t * dx;
	result.y = p1.y + t * dy;
	return true;
}
