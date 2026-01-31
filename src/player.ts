import type { Ctx } from "@/doom.ts";
import type { IVec2 } from "@/IVec2.ts";
import { Constants } from "@/Constants.ts";

export class Player {
	public pos: IVec2 = {
		x: 160,
		y: 170,
	};

	public angle: number = 0;

	public size: number = 10;

	draw(ctx: Ctx) {
		ctx.beginPath();
		ctx.arc(this.pos.x, this.pos.y, this.size, 0, 2 * Math.PI);
		ctx.stroke();

		// draw direction
		ctx.beginPath();
		ctx.moveTo(this.pos.x, this.pos.y);
		ctx.lineTo(
			this.pos.x + Math.cos(this.angle) * 2 * this.size,
			this.pos.y + Math.sin(this.angle) * 2 * this.size,
		);
		ctx.stroke();

		// draw FOV
		const halfFov = Constants.FOV / 2;
		ctx.beginPath();
		ctx.moveTo(this.pos.x, this.pos.y);
		ctx.lineTo(
			this.pos.x + Math.cos(this.angle - halfFov) * 2 * this.size,
			this.pos.y + Math.sin(this.angle - halfFov) * 2 * this.size,
		);
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(this.pos.x, this.pos.y);
		ctx.lineTo(
			this.pos.x + Math.cos(this.angle + halfFov) * 2 * this.size,
			this.pos.y + Math.sin(this.angle + halfFov) * 2 * this.size,
		);
		ctx.stroke();
	}
}
