/** biome-ignore-all lint/style/noNonNullAssertion: asdf */
import { Clut } from "@/Clut.ts";
import type { IVec2 } from "@/IVec2.ts";
import type { LevelShape } from "@/LevelShape.ts";
import { Level } from "@/level.ts";
import { Simplex } from "@/simplex.ts";

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

function isEar(
	polygon: IVec2[],
	prev: number,
	curr: number,
	next: number,
): boolean {
	const a = polygon[prev]!;
	const b = polygon[curr]!;
	const c = polygon[next]!;

	// Check if the triangle is convex (counter-clockwise)
	const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
	if (cross <= 0) {
		return false;
	}

	// Check if any other vertex is inside this triangle
	for (let i = 0; i < polygon.length; i++) {
		if (i === prev || i === curr || i === next) continue;
		if (pointInTriangle(polygon[i]!, a, b, c)) {
			return false;
		}
	}

	return true;
}

function edgesMatch(a1: IVec2, a2: IVec2, b1: IVec2, b2: IVec2): boolean {
	return (
		(pointsEqual(a1, b1) && pointsEqual(a2, b2)) ||
		(pointsEqual(a1, b2) && pointsEqual(a2, b1))
	);
}

function findSharedEdge(
	s1: Simplex,
	s2: Simplex,
): { s1Side: number; s2Side: number } | null {
	for (let i = 0; i < 3; i++) {
		const e1Start = s1.points[i]!;
		const e1End = s1.points[(i + 1) % 3]!;
		for (let j = 0; j < 3; j++) {
			const e2Start = s2.points[j]!;
			const e2End = s2.points[(j + 1) % 3]!;
			if (edgesMatch(e1Start, e1End, e2Start, e2End)) {
				return { s1Side: i, s2Side: j };
			}
		}
	}
	return null;
}

export function initLevelFromShape(levelShape: LevelShape): Level {
	const { polyline, heartPositions, playerStartPos } = levelShape;
	if (polyline.length < 3) {
		throw new Error("Polyline must have at least 3 points");
	}

	// Copy the polygon to avoid mutating the input
	const polygon = [...polyline];

	// Ensure counter-clockwise winding
	let area = 0;
	for (let i = 0; i < polygon.length; i++) {
		const j = (i + 1) % polygon.length;
		area += polygon[i]!.x * polygon[j]!.y;
		area -= polygon[j]!.x * polygon[i]!.y;
	}
	if (area > 0) {
		polygon.reverse();
	}

	// Ear clipping triangulation
	const triangles: [IVec2, IVec2, IVec2][] = [];
	const indices = polygon.map((_, i) => i);

	while (indices.length > 3) {
		let earFound = false;
		for (let i = 0; i < indices.length; i++) {
			const prev = (i - 1 + indices.length) % indices.length;
			const next = (i + 1) % indices.length;

			const prevIdx = indices[prev]!;
			const currIdx = indices[i]!;
			const nextIdx = indices[next]!;

			// Build a temporary polygon from current indices for ear testing
			const tempPoly = indices.map((idx) => polygon[idx]!);

			if (isEar(tempPoly, prev, i, next)) {
				triangles.push([
					polygon[prevIdx]!,
					polygon[currIdx]!,
					polygon[nextIdx]!,
				]);
				indices.splice(i, 1);
				earFound = true;
				break;
			}
		}
		if (!earFound) {
			// Fallback: just take the first three vertices
			const [i0, i1, i2] = [indices[0]!, indices[1]!, indices[2]!];
			triangles.push([polygon[i0]!, polygon[i1]!, polygon[i2]!]);
			indices.splice(1, 1);
		}
	}

	// Add the last triangle
	if (indices.length === 3) {
		triangles.push([
			polygon[indices[0]!]!,
			polygon[indices[1]!]!,
			polygon[indices[2]!]!,
		]);
	}

	// Create simplices from triangles
	const simplices: Simplex[] = triangles.map(
		(tri, i) => new Simplex(i, [tri[0], tri[1], tri[2]]),
	);

	// Connect adjacent simplices
	for (let i = 0; i < simplices.length; i++) {
		for (let j = i + 1; j < simplices.length; j++) {
			const shared = findSharedEdge(simplices[i]!, simplices[j]!);
			if (shared) {
				simplices[i]!.connectSimplexOnSide(shared.s1Side, simplices[j]!);
				simplices[j]!.connectSimplexOnSide(shared.s2Side, simplices[i]!);
			}
		}
	}

	return new Level(simplices, simplices[0]!, heartPositions, playerStartPos);
}

export function initLevel(): Level {
	const root = new Simplex(0, [
		{ x: 100, y: 100 },
		{ x: 200, y: 100 },
		{ x: 100, y: 200 },
	]);
	const second = new Simplex(1, [
		{ x: 200, y: 100 },
		{ x: 210, y: 200 },
		{ x: 100, y: 200 },
	]);
	root.connectSimplexOnSide(1, second);
	second.connectSimplexOnSide(2, root);

	const simplices: Simplex[] = [root, second];

	root.sides[2]!.isMirror = true;
	root.sides[2]!.mirrorClut = Clut.makeDarken();
	second.sides[0]!.isMirror = true;
	second.sides[0]!.mirrorClut = Clut.makeDarken();

	// return new Level(simplices, root);

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

			const l = 1.2 - Math.random() * 0.3;
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
		shuffled[0]!.simplex.sides[shuffled[0]!.sideIndex]!.isMirror = true;
		shuffled[0]!.simplex.sides[shuffled[0]!.sideIndex]!.mirrorClut =
			Clut.makeRandomUnitary();
		shuffled[1]!.simplex.sides[shuffled[1]!.sideIndex]!.isMirror = true;
		shuffled[1]!.simplex.sides[shuffled[1]!.sideIndex]!.mirrorClut =
			Clut.makeRandomUnitary();
	}

	return new Level(simplices, root);
}
