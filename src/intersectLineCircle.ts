import type { IVec2 } from "@/IVec2.ts";

const tmp: IVec2 = {
	x: 0,
	y: 0,
};

export function intersectPointCircle(point: IVec2, circle: IVec2, r: number) {
	if (r === 0) return false;
	const dx = circle.x - point.x;
	const dy = circle.x - point.y;
	return dx * dx + dy * dy <= r * r;
}

export function lineCircleCollide(
	a: IVec2,
	b: IVec2,
	circle: IVec2,
	radius: number,
	nearest: IVec2,
) {
	//check to see if start or end points lie within circle
	if (intersectPointCircle(a, circle, radius)) {
		if (nearest) {
			nearest.x = a.x;
			nearest.y = a.y;
		}
		return true;
	}
	if (intersectPointCircle(b, circle, radius)) {
		if (nearest) {
			nearest.x = b.x;
			nearest.y = b.y;
		}
		return true;
	}

	const x1 = a.x,
		y1 = a.y,
		x2 = b.x,
		y2 = b.y,
		cx = circle.x,
		cy = circle.y;

	//vector d
	const dx = x2 - x1;
	const dy = y2 - y1;

	//vector lc
	const lcx = cx - x1;
	const lcy = cy - y1;

	//project lc onto d, resulting in vector p
	const dLen2 = dx * dx + dy * dy; //len2 of d
	let px = dx;
	let py = dy;
	if (dLen2 > 0) {
		const dp = (lcx * dx + lcy * dy) / dLen2;
		px *= dp;
		py *= dp;
	}

	if (!nearest) nearest = tmp;
	nearest.x = x1 + px;
	nearest.y = y1 + py;

	//len2 of p
	const pLen2 = px * px + py * py;

	//check collision
	return (
		intersectPointCircle(nearest, circle, radius) &&
		pLen2 <= dLen2 &&
		px * dx + py * dy >= 0
	);
}
