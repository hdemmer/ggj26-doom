/** biome-ignore-all lint/style/noNonNullAssertion: asdf */
import { Level, Simplex } from "@/doom.ts";
import type { IVec2 } from "@/IVec2.ts";

export function initLevel(): Level {
	const root = new Simplex(0, [
		{ x: 100, y: 100 },
		{ x: 200, y: 100 },
		{ x: 100, y: 200 },
	]);

	const simplices: Simplex[] = [root];

	let currentSimplex = root;
	for (let i = 0; i < 5; i++) {
		// grow side B
		const l = 1.1 - Math.random() * 0.2;
		const newPoint: IVec2 = {
			x:
				currentSimplex.points[1]!.x +
				currentSimplex.points[2]!.x -
				l * currentSimplex.points[0]!.x,
			y:
				currentSimplex.points[1]!.y +
				currentSimplex.points[2]!.y -
				l * currentSimplex.points[0]!.y,
		};

		const newS = new Simplex(i + 1, [
			currentSimplex.points[1]!,
			currentSimplex.points[2]!,
			newPoint,
		]);
		currentSimplex.connectSimplexOnSide(1, newS);
		newS.connectSimplexOnSide(0, currentSimplex);

		simplices.push(newS);

		currentSimplex = newS;
	}

	return new Level(simplices, root);
}
