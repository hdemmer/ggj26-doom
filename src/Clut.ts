/** biome-ignore-all lint/style/noNonNullAssertion: asdf */
export type Rgb8Color = { r: number; g: number; b: number };

export class Clut {
	constructor(public data: Float32Array<ArrayBuffer>) {}

	static makeIdentity(): Clut {
		return new Clut(Float32Array.from([1, 0, 0, 0, 1, 0, 0, 0, 1]));
	}

	applyMut(color: Rgb8Color) {
		const d = this.data;
		const { r, g, b } = color;
		color.r = d[0]! * r + d[1]! * g + d[2]! * b;
		color.g = d[3]! * r + d[4]! * g + d[5]! * b;
		color.b = d[6]! * r + d[7]! * g + d[8]! * b;
	}

	multiplyMut(other: Clut) {
		const thisData = this.data;
		const otherData = other.data;
		const a = thisData[0]!;
		const b = thisData[1]!;
		const c = thisData[2]!;
		const d = thisData[3]!;
		const e = thisData[4]!;
		const f = thisData[5]!;
		const g = thisData[6]!;
		const h = thisData[7]!;
		const i = thisData[8]!;

		thisData[0] = a * otherData[0]! + b * otherData[3]! + c * otherData[6]!;
		thisData[1] = a * otherData[1]! + b * otherData[4]! + c * otherData[7]!;
		thisData[2] = a * otherData[2]! + b * otherData[5]! + c * otherData[8]!;

		thisData[3] = d * otherData[0]! + e * otherData[3]! + f * otherData[6]!;
		thisData[4] = d * otherData[1]! + e * otherData[4]! + f * otherData[7]!;
		thisData[5] = d * otherData[2]! + e * otherData[5]! + f * otherData[8]!;

		thisData[6] = g * otherData[0]! + h * otherData[3]! + i * otherData[6]!;
		thisData[7] = g * otherData[1]! + h * otherData[4]! + i * otherData[7]!;
		thisData[8] = g * otherData[2]! + h * otherData[5]! + i * otherData[8]!;
	}

	identityMut() {
		const d = this.data;
		d[0] = 1;
		d[1] = 0;
		d[2] = 0;
		d[3] = 0;
		d[4] = 1;
		d[5] = 0;
		d[6] = 0;
		d[7] = 0;
		d[8] = 1;
	}
}
