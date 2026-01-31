import type { Ctx } from "@/doom.ts";
import type { IVec2 } from "@/IVec2.ts";

export class Player {
	public pos: IVec2 = {
		x: 160,
		y: 170,
	};

	public dir: IVec2 = {
		x: 1,
		y: 0,
	};

	public size: number = 10;

	draw(ctx: Ctx) {
		ctx.beginPath();
		ctx.arc(this.pos.x, this.pos.y, this.size, 0, 2 * Math.PI);
		ctx.stroke();

		// draw direction
		ctx.beginPath();
		ctx.moveTo(this.pos.x, this.pos.y);
		ctx.lineTo(
			this.pos.x + this.dir.x * 2 * this.size,
			this.pos.y + this.dir.y * 2 * this.size,
		);
		ctx.stroke();
	}
}
