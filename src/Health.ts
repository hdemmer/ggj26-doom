const HEALTH_CHANGE_RATE = 5 / 10000; // units per second
const HEALTH_MAX = 100;

export class Health {
	current: number = 0; // from -1 * HEALTH_MAX to HEALTH_MAX

	update(deltaTime: number, isInMirror: boolean) {
		if (!isInMirror) {
			this.current += HEALTH_CHANGE_RATE * deltaTime;
			if (this.current > HEALTH_MAX) {
				this.current = HEALTH_MAX;
			}
		} else {
			this.current -= HEALTH_CHANGE_RATE * deltaTime;
			if (this.current < -HEALTH_MAX) {
				this.current = -HEALTH_MAX;
			}
		}
	}

	getMultiplier(): number {
		return this.current / HEALTH_MAX;
	}
}
