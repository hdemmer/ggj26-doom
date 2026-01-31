import "./index.css";
import { useEffect, useRef } from "react";
import { Constants } from "@/Constants.ts";
import { doom } from "./doom.ts";

export function App() {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (canvas) {
			const ctx = canvas.getContext("2d");
			if (ctx) {
				doom(ctx);
			}
		}
	}, []);

	return (
		<div className="app">
			<canvas
				ref={canvasRef}
				width={Constants.WIDTH}
				height={Constants.HEIGHT}
			/>
		</div>
	);
}

export default App;
