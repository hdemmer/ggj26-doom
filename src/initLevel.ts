/** biome-ignore-all lint/style/noNonNullAssertion: asdf */
import { Level, Simplex } from "@/doom.ts";
import type { IVec2 } from "@/IVec2.ts";

function sign(p1: IVec2, p2: IVec2, p3: IVec2): number {
	return (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
}

function pointInTriangle(
	point: IVec2,
	t0: IVec2,
	t1: IVec2,
	t2: IVec2,
): boolean {
	const d1 = sign(point, t0, t1);
	const d2 = sign(point, t1, t2);
	const d3 = sign(point, t2, t0);

	const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
	const hasPos = d1 > 0 || d2 > 0 || d3 > 0;

	return !(hasNeg && hasPos);
}

function pointInSimplex(point: IVec2, simplex: Simplex): boolean {
	return pointInTriangle(
		point,
		simplex.points[0]!,
		simplex.points[1]!,
		simplex.points[2]!,
	);
}

function pointsEqual(a: IVec2, b: IVec2): boolean {
	return Math.abs(a.x - b.x) < 1e-10 && Math.abs(a.y - b.y) < 1e-10;
}

function orientation(p: IVec2, q: IVec2, r: IVec2): number {
	const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
	if (Math.abs(val) < 1e-10) return 0;
	return val > 0 ? 1 : 2;
}

function segmentsProperlyIntersect(
	a1: IVec2,
	a2: IVec2,
	b1: IVec2,
	b2: IVec2,
): boolean {
	// Segments sharing an endpoint don't "properly" intersect
	if (
		pointsEqual(a1, b1) ||
		pointsEqual(a1, b2) ||
		pointsEqual(a2, b1) ||
		pointsEqual(a2, b2)
	) {
		return false;
	}

	const o1 = orientation(a1, a2, b1);
	const o2 = orientation(a1, a2, b2);
	const o3 = orientation(b1, b2, a1);
	const o4 = orientation(b1, b2, a2);

	// Segments cross if orientations differ on each side
	return o1 !== o2 && o3 !== o4;
}

function getSimplexEdges(simplex: Simplex): [IVec2, IVec2][] {
	const p = simplex.points;
	return [
		[p[0]!, p[1]!],
		[p[1]!, p[2]!],
		[p[2]!, p[0]!],
	];
}

export function initLevel(): Level {
	const root = new Simplex(0, [
		{ x: 100, y: 100 },
		{ x: 200, y: 100 },
		{ x: 100, y: 200 },
	]);
	const second = new Simplex(1, [
		{ x: 200, y: 100 },
		{ x: 200, y: 200 },
		{ x: 100, y: 200 },
	]);
	root.connectSimplexOnSide(1, second);
	second.connectSimplexOnSide(2, root);

	const simplices: Simplex[] = [root, second];

	for (let i = 2; i < 5; i++) {
		// Pick a random simplex to grow from
		const currentSimplex =
			simplices[Math.floor(Math.random() * simplices.length)]!;

		const sides = [0, 1, 2];

		let newS: Simplex | null = null;

		for (const sideIndex of sides) {
			const p1Index = sideIndex;
			const p2Index = (sideIndex + 1) % 3;
			const oppositeIndex = (sideIndex + 2) % 3;

			const l = 1.5 - Math.random() * 0.8;
			const newPoint: IVec2 = {
				x:
					currentSimplex.points[p1Index]!.x +
					currentSimplex.points[p2Index]!.x -
					l * currentSimplex.points[oppositeIndex]!.x,
				y:
					currentSimplex.points[p1Index]!.y +
					currentSimplex.points[p2Index]!.y -
					l * currentSimplex.points[oppositeIndex]!.y,
			};

			// Check if newPoint overlaps any existing simplex
			let overlaps = false;
			for (const s of simplices) {
				if (pointInSimplex(newPoint, s)) {
					overlaps = true;
					break;
				}
			}

			// Check if new edges intersect any existing edges
			if (!overlaps) {
				const p1 = currentSimplex.points[p1Index]!;
				const p2 = currentSimplex.points[p2Index]!;
				const newEdges: [IVec2, IVec2][] = [
					[p1, newPoint],
					[p2, newPoint],
				];

				for (const s of simplices) {
					for (const existingEdge of getSimplexEdges(s)) {
						for (const newEdge of newEdges) {
							if (
								segmentsProperlyIntersect(
									newEdge[0],
									newEdge[1],
									existingEdge[0],
									existingEdge[1],
								)
							) {
								overlaps = true;
								break;
							}
						}
						if (overlaps) break;
					}
					if (overlaps) break;
				}
			}

			// Check if any existing vertex is inside the candidate simplex
			if (!overlaps) {
				const p1 = currentSimplex.points[p1Index]!;
				const p2 = currentSimplex.points[p2Index]!;

				for (const s of simplices) {
					for (const vertex of s.points) {
						// Skip vertices that are part of the candidate simplex
						if (
							pointsEqual(vertex, p1) ||
							pointsEqual(vertex, p2) ||
							pointsEqual(vertex, newPoint)
						) {
							continue;
						}
						if (pointInTriangle(vertex, p1, p2, newPoint)) {
							overlaps = true;
							break;
						}
					}
					if (overlaps) break;
				}
			}

			if (!overlaps) {
				newS = new Simplex(i + 1, [
					currentSimplex.points[p1Index]!,
					currentSimplex.points[p2Index]!,
					newPoint,
				]);
				currentSimplex.connectSimplexOnSide(sideIndex, newS);
				newS.connectSimplexOnSide(0, currentSimplex);
				break;
			}
		}

		if (newS) {
			simplices.push(newS);
		}
	}

	// Find all walls (sides without a neighboring simplex)
	const walls: { simplex: Simplex; sideIndex: number }[] = [];
	for (const simplex of simplices) {
		for (let i = 0; i < simplex.sides.length; i++) {
			if (simplex.sides[i]!.simplex === null) {
				walls.push({ simplex, sideIndex: i });
			}
		}
	}

	// Pick two random walls and make them mirrors
	if (walls.length >= 2) {
		const shuffled = walls.sort(() => Math.random() - 0.5);
		// shuffled[0]!.simplex.sides[shuffled[0]!.sideIndex]!.isMirror = true;
		// shuffled[1]!.simplex.sides[shuffled[1]!.sideIndex]!.isMirror = true;
	}

	return new Level(simplices, root);
}
