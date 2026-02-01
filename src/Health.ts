const HEALTH_CHANGE_RATE = 0.1; // units per distance unit
const HEALTH_MAX = 100;

export class Health {
	current: number = 0; // from -1 * HEALTH_MAX to HEALTH_MAX

	update(distanceDelta: number, isInMirror: boolean) {
		const direction = isInMirror ? -1 : 1;

		this.current += HEALTH_CHANGE_RATE * distanceDelta * direction;
		if (this.current > HEALTH_MAX) {
			this.current = HEALTH_MAX;
		}
		if (this.current < -HEALTH_MAX) {
			this.current = -HEALTH_MAX;
		}
	}

	getMultiplier(): number {
		return (this.current / HEALTH_MAX) * 2;
	}

	reset() {
		this.current = 0;
	}

	isAtLimit(): boolean {
		return this.current >= HEALTH_MAX || this.current <= -HEALTH_MAX;
	}

	addInDirection(amount: number, isInMirror: boolean) {
		const direction = isInMirror ? -1 : 1;
		this.current += amount * direction;
		if (this.current > HEALTH_MAX) {
			this.current = HEALTH_MAX;
		}
		if (this.current < -HEALTH_MAX) {
			this.current = -HEALTH_MAX;
		}
	}
}
