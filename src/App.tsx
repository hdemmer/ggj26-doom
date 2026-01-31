import "./index.css";
import { useEffect, useRef, useCallback } from "react";
import { Constants } from "@/Constants.ts";
import { doom } from "./doom.ts";

export function App() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	const resizeCanvas = useCallback(() => {
		const canvas = canvasRef.current;
		const container = containerRef.current;
		if (!canvas || !container) return;

		const aspectRatio = Constants.WIDTH / Constants.HEIGHT;
		const windowWidth = window.innerWidth;
		const windowHeight = window.innerHeight;
		const windowAspect = windowWidth / windowHeight;

		let displayWidth: number;
		let displayHeight: number;

		if (windowAspect > aspectRatio) {
			// Window is wider than canvas aspect ratio - fit to height
			displayHeight = windowHeight;
			displayWidth = windowHeight * aspectRatio;
		} else {
			// Window is taller than canvas aspect ratio - fit to width
			displayWidth = windowWidth;
			displayHeight = windowWidth / aspectRatio;
		}

		canvas.style.width = `${displayWidth}px`;
		canvas.style.height = `${displayHeight}px`;
	}, []);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (canvas) {
			const ctx = canvas.getContext("2d");
			if (ctx) {
				doom(ctx);
			}
		}

		resizeCanvas();
		window.addEventListener("resize", resizeCanvas);
		return () => window.removeEventListener("resize", resizeCanvas);
	}, [resizeCanvas]);

	return (
		<div className="app" ref={containerRef}>
			<canvas
				ref={canvasRef}
				width={Constants.WIDTH}
				height={Constants.HEIGHT}
			/>
		</div>
	);
}

export default App;
