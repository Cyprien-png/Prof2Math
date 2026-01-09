<script setup lang="ts">
import { ref, onMounted } from "vue";

const canvasRef = ref<HTMLCanvasElement | null>(null);
let ctx: CanvasRenderingContext2D | null = null;

let drawing = false;
let currentStroke: { x: number; y: number }[] = [];
let strokes: { x: number; y: number }[][] = [];

onMounted(() => {
    const canvas = canvasRef.value!;
    ctx = canvas.getContext("2d");

    // Adjust canvas for high-DPI screens
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + "px";
    canvas.style.height = rect.height + "px";

    ctx!.scale(dpr, dpr);
    ctx!.strokeStyle = "black";
    ctx!.lineWidth = 2;
    ctx!.lineCap = "round";
    ctx!.lineJoin = "round";

    // Mouse events
    canvas.addEventListener("mousedown", (e) => startDrawing(e));
    canvas.addEventListener("mousemove", (e) => draw(e));
    canvas.addEventListener("mouseup", stopDrawing);

    // Touch events
    canvas.addEventListener("touchstart", (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        if (touch) {
            startDrawing(touch);
        }
    });
    canvas.addEventListener("touchmove", (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        if (touch) {
            draw(touch);
        }
    });
    canvas.addEventListener("touchend", (e) => {
        e.preventDefault();
        stopDrawing();
    });
});

/**
 * Starts a new stroke when the user begins drawing.
 * Stores initial coordinates in currentStroke array.
 */
const startDrawing = (e: MouseEvent | Touch) => {
    drawing = true;
    currentStroke = [];
    const { x, y } = getCanvasCoordinates(e);
    currentStroke.push({ x, y });
};

/**
 * Captures the user's movement while drawing.
 * Adds each point to the currentStroke array.
 * Draws a temporary live line for immediate feedback.
 */
const draw = (e: MouseEvent | Touch) => {
    if (!drawing) return;
    const { x, y } = getCanvasCoordinates(e);
    currentStroke.push({ x, y });

    // Draw live stroke from last point to current
    ctx!.beginPath();
    const last = currentStroke[currentStroke.length - 2];
    if (last) {
        ctx!.moveTo(last.x, last.y);
        ctx!.lineTo(x, y);
        ctx!.stroke();
    }
};

/**
 * Ends the current stroke when the user stops drawing.
 * Adds the stroke to the strokes array.
 */
const stopDrawing = () => {
    if (!drawing) return;
    drawing = false;

    if (currentStroke.length > 30) {
        strokes.push(simplify(currentStroke, 2));
    } else {
        strokes.push(currentStroke);
    }

    redrawAll();
};

/**
 * Simplifies a stroke using the Ramer–Douglas–Peucker algorithm.
 * Removes points that do not significantly affect the overall curve.
 * @param points Array of points {x, y} representing the stroke
 * @param tolerance Max distance in pixels allowed between original and simplified stroke
 * @returns Simplified array of points
 * Reference: https://en.wikipedia.org/wiki/Ramer–Douglas–Peucker_algorithm
 */
const simplify = (points: { x: number; y: number }[], tolerance: number) => {
    if (points.length < 3) return points;

    const sqTolerance = tolerance * tolerance;

    // Calculate squared distance from a point to a line segment
    const getSqSegDist = (p: { x: number; y: number }, p1: { x: number; y: number }, p2: { x: number; y: number }) => {
        let x = p1.x,
            y = p1.y;
        let dx = p2.x - x,
            dy = p2.y - y;

        if (dx !== 0 || dy !== 0) {
            const t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);
            if (t > 1) {
                x = p2.x;
                y = p2.y;
            } else if (t > 0) {
                x += dx * t;
                y += dy * t;
            }
        }

        dx = p.x - x;
        dy = p.y - y;
        return dx * dx + dy * dy;
    }

    // Recursive RDP algorithm implementation
    const simplifyDP = (points: { x: number; y: number }[], first: number, last: number, sqTol: number, out: { x: number; y: number }[]) => {
        let maxSqDist = sqTol;
        let index: number | null = null;

        for (let i = first + 1; i < last; i++) {
            const sqDist = getSqSegDist(points[i]!, points[first]!, points[last]!);
            if (sqDist > maxSqDist) {
                index = i;
                maxSqDist = sqDist;
            }
        }

        if (index !== null) {
            if (index - first > 1) simplifyDP(points, first, index, sqTol, out);
            out.push(points[index]!);
            if (last - index > 1) simplifyDP(points, index, last, sqTol, out);
        }
    }

    const out: { x: number; y: number }[] = [points[0]!];
    simplifyDP(points, 0, points.length - 1, sqTolerance, out);
    out.push(points[points.length - 1]!);
    return out;
}

/**
 * Redraws all strokes on the canvas using quadratic Bezier curves.
 * Creates smooth curves by averaging midpoints between consecutive points.
 */
const redrawAll = () => {
    const canvas = canvasRef.value!;
    ctx!.clearRect(0, 0, canvas.width, canvas.height);

    for (const stroke of strokes) {
        if (stroke.length === 1) {
            // Draw dot
            const p = stroke[0]!;
            ctx!.beginPath();
            ctx!.arc(p.x, p.y, 2, 0, Math.PI * 2);
            ctx!.fillStyle = "black";
            ctx!.fill();
        } else if (stroke.length >= 2) {
            // Draw smooth curve
            ctx!.beginPath();
            const first = stroke[0]!;
            ctx!.moveTo(first.x, first.y);

            for (let i = 1; i < stroke.length - 1; i++) {
                const p1 = stroke[i]!;
                const p2 = stroke[i + 1]!;
                const midX = (p1.x + p2.x) / 2;
                const midY = (p1.y + p2.y) / 2;
                ctx!.quadraticCurveTo(p1.x, p1.y, midX, midY);
            }

            ctx!.stroke();
        }
    }
};

/**
 * Converts a MouseEvent or Touch to canvas coordinates.
 * Accounts for canvas position and CSS scaling.
 */
const getCanvasCoordinates = (e: MouseEvent | Touch) => {
    const canvas = canvasRef.value!;
    const rect = canvas.getBoundingClientRect();
    const clientX = "clientX" in e ? e.clientX : (e as Touch).clientX;
    const clientY = "clientY" in e ? e.clientY : (e as Touch).clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
};

/**
 * Clears all strokes from the canvas and resets stroke storage.
 */
const clear = () => {
    strokes = [];
    const canvas = canvasRef.value!;
    ctx!.clearRect(0, 0, canvas.width, canvas.height);
};

/**
 * Returns the current canvas content as a Base64 PNG.
 */
const getBase64 = () => {
    return strokes.length > 0 ? canvasRef.value!.toDataURL("image/png") : null;
};

defineExpose({
    clear,
    getBase64,
});
</script>

<template>
    <div class="flex flex-col w-full rounded-lg bg-white">
        <div class="relative flex flex-col w-full">
            <div
                class="absolute top-4 right-4 border-t-2 border-r-2 border-dark-accent/20 rounded-tr w-1/4 h-1/4 pointer-events-none z-10">
            </div>
            <div
                class="absolute top-4 left-4 border-t-2 border-l-2 border-dark-accent/20 rounded-tl w-1/4 h-1/4 pointer-events-none z-10">
            </div>
            <div
                class="absolute bottom-4 right-4 border-b-2 border-r-2 border-dark-accent/20 rounded-br w-1/4 h-1/4 pointer-events-none z-10">
            </div>
            <div
                class="absolute bottom-4 left-4 border-b-2 border-l-2 border-dark-accent/20 rounded-bl w-1/4 h-1/4 pointer-events-none z-10">
            </div>
            <canvas ref="canvasRef" class="relative border cursor-crosshair" style="touch-action: none;"></canvas>
        </div>
        <div class="p-4 text-sm text-dark-accent/70 flex flex-row items-center gap-2">
            <button @click="clear" class="text-black bg-gray-500/30 rounded-md p-2 px-4">Clear</button>
        </div>
    </div>
</template>