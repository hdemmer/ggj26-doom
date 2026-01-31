const HEALTH_CHANGE_RATE = 5 / 1000; // units per second
const HEALTH_MAX = 100;

export class Health {
	current: number = 0; // from -1 * HEALTH_MAX to HEALTH_MAX

	update(deltaTime: number, whitePixels: number, blackPixels: number) {
		let direction = 0;
		direction = whitePixels - blackPixels;
		// clamp direction between -1 and 1
		if (direction > 1) {
			direction = 1;
		}
		if (direction < -1) {
			direction = -1;
		}
		this.current += HEALTH_CHANGE_RATE * deltaTime * direction;
		if (this.current > HEALTH_MAX) {
			this.current = HEALTH_MAX;
		}
		if (this.current < -HEALTH_MAX) {
			this.current = -HEALTH_MAX;
		}
	}

	getMultiplier(): number {
		return (this.current / HEALTH_MAX) * 4;
	}

	reset() {
		this.current = 0;
	}
}
