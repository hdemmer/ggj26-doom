import type { IVec2 } from "@/IVec2.ts";
import type { Sprite, ThreeDee } from "@/ThreeDee.ts";

export class Heart {
	public readonly sprite: Sprite;

	constructor(
		public readonly pos: IVec2,
		threeDee: ThreeDee,
	) {
		this.sprite = threeDee.addSprite(pos, 8, 0, "heart");
	}
}
