<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import type { Block } from '../types';
import { fileService } from '../services/FileService';

const props = defineProps<{
    block: Block;
    rootHandle: FileSystemDirectoryHandle | null;
    currentFilePath: string | null;
}>();

const emit = defineEmits<{
    (e: 'save'): void;
    (e: 'cancel'): void;
}>();

const containerRef = ref<HTMLDivElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const ctx = ref<CanvasRenderingContext2D | null>(null);

// State
const strokes = ref<{ x: number; y: number }[][]>([]);
const redoStack = ref<{ x: number; y: number }[][]>([]);
const backgroundHtml = ref<string>('');
const currentStroke = ref<{ x: number; y: number }[]>([]);
const isDrawing = ref(false);
const isPanning = ref(false);
const scale = ref(1);
const offset = ref({ x: 0, y: 0 });
const lastPan = ref({ x: 0, y: 0 });
const isSpacePressed = ref(false);

// Config
const LINE_WIDTH = 3;

// Initialize
const handleKeydown = (e: KeyboardEvent) => {
    if (e.code === 'Space') isSpacePressed.value = true;

    // Undo/Redo
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        redo();
    }
};
const handleKeyup = (e: KeyboardEvent) => {
    if (e.code === 'Space') isSpacePressed.value = false;
};



const undo = () => {
    if (strokes.value.length === 0) return;
    const lastStroke = strokes.value.pop();
    if (lastStroke) {
        redoStack.value.push(lastStroke);
        drawAll();
    }
};

const redo = () => {
    if (redoStack.value.length === 0) return;
    const nextStroke = redoStack.value.pop();
    if (nextStroke) {
        strokes.value.push(nextStroke);
        drawAll();
    }
};

const handleClickOutside = (e: MouseEvent) => {
    if (containerRef.value && !containerRef.value.contains(e.target as Node)) {
        save();
    }
};

onMounted(async () => {
    initCanvas();
    window.addEventListener('resize', handleResize);
    window.addEventListener('keydown', handleKeydown);
    window.addEventListener('keyup', handleKeyup);
    document.addEventListener('mousedown', handleClickOutside);

    // Load existing SVG if present
    if (props.block.markdown) {
        await loadFromMarkdown(props.block.markdown);
    }
});

onUnmounted(() => {
    window.removeEventListener('resize', handleResize);
    window.removeEventListener('keydown', handleKeydown);
    window.removeEventListener('keyup', handleKeyup);
    document.removeEventListener('mousedown', handleClickOutside);
});

const initCanvas = () => {
    if (!canvasRef.value || !containerRef.value) return;
    const canvas = canvasRef.value;
    const rect = containerRef.value.getBoundingClientRect();

    // Set size big enough for "infinite" feel (virtual)
    // But physically limited to window * 2 for performance?
    // Actually, proper infinite canvas uses transform.
    // We will size the canvas to the container and map coordinates.
    canvas.width = rect.width;
    canvas.height = rect.height;

    ctx.value = canvas.getContext('2d');
    if (ctx.value) {
        ctx.value.lineCap = 'round';
        ctx.value.lineJoin = 'round';
        ctx.value.strokeStyle = 'black';
    }

    drawAll();
};

const handleResize = () => {
    initCanvas();
};

// Coordinate mapping
const toVirtual = (clientX: number, clientY: number) => {
    if (!canvasRef.value) return { x: 0, y: 0 };
    const rect = canvasRef.value.getBoundingClientRect();
    return {
        x: (clientX - rect.left - offset.value.x) / scale.value,
        y: (clientY - rect.top - offset.value.y) / scale.value
    };
};

const toScreen = (vx: number, vy: number) => {
    return {
        x: vx * scale.value + offset.value.x,
        y: vy * scale.value + offset.value.y
    };
};

// Drawing Logic
const startDrawing = (e: MouseEvent | TouchEvent) => {
    // Pan mode check: Middle mouse (button 1) or Space key
    const isMiddleMouse = (e instanceof MouseEvent && e.button === 1);

    if (isMiddleMouse || isSpacePressed.value) {
        isPanning.value = true;
        let clientX = 0;
        let clientY = 0;

        if (e instanceof MouseEvent) {
            clientX = e.clientX;
            clientY = e.clientY;
        } else {
            const t = e.touches[0];
            if (t) {
                clientX = t.clientX;
                clientY = t.clientY;
            }
        }

        lastPan.value = { x: clientX, y: clientY };
        return;
    }

    if (e instanceof MouseEvent && e.button !== 0) return;

    // Clear redo stack on new action
    if (redoStack.value.length > 0) {
        redoStack.value = [];
    }

    isDrawing.value = true;
    currentStroke.value = [];

    let clientX = 0;
    let clientY = 0;

    if (e instanceof MouseEvent) {
        clientX = e.clientX;
        clientY = e.clientY;
    } else {
        const t = e.touches[0];
        if (t) {
            clientX = t.clientX;
            clientY = t.clientY;
        }
    }

    const p = toVirtual(clientX, clientY);
    currentStroke.value.push(p);

    drawAll();
};

const moveDrawing = (e: MouseEvent | TouchEvent) => {
    let clientX = 0;
    let clientY = 0;

    if (e instanceof MouseEvent) {
        clientX = e.clientX;
        clientY = e.clientY;
    } else {
        const t = e.touches[0];
        if (t) {
            clientX = t.clientX;
            clientY = t.clientY;
        }
    }

    if (isPanning.value) {
        const dx = clientX - lastPan.value.x;
        const dy = clientY - lastPan.value.y;
        offset.value.x += dx;
        offset.value.y += dy;
        lastPan.value = { x: clientX, y: clientY };
        drawAll();
        return;
    }

    if (!isDrawing.value) return;

    const p = toVirtual(clientX, clientY);
    currentStroke.value.push(p);

    // Optimization: Draw only last segment? 
    // For now simple redrawAll is safe for reasonable stroke counts.
    // Ideally we draw just the new segment on top.
    drawAll();
};

const stopDrawing = () => {
    if (isPanning.value) {
        isPanning.value = false;
        return;
    }

    if (!isDrawing.value) return;
    isDrawing.value = false;

    if (currentStroke.value.length > 0) {
        // Simple smoothing
        const smoothed = smoothStroke(currentStroke.value);
        strokes.value.push(smoothed);
    }
    currentStroke.value = [];
    drawAll();
};

const smoothStroke = (points: { x: number, y: number }[]) => {
    if (points.length < 3) return points;
    // Basic smoothing
    // Could use Chaikin's or just keep it raw if user wants "less smoothing"
    // Requirement: "smooth a bit ... but not as much as DrawingSection"
    // Let's simple average neighbors?
    // Actually, RDP (simplify) is what DrawingSection uses.
    // We can use RDP with a very small tolerance.
    return simplify(points, 0.5);
};

// RDP Algorithm (Simplified version of DrawingSection's)
const simplify = (points: { x: number; y: number }[], tolerance: number) => {
    if (points.length < 3) return points;
    const sqTolerance = tolerance * tolerance;

    const getSqSegDist = (p: { x: number, y: number }, p1: { x: number, y: number }, p2: { x: number, y: number }) => {
        let x = p1.x, y = p1.y, dx = p2.x - x, dy = p2.y - y;
        if (dx !== 0 || dy !== 0) {
            const t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);
            if (t > 1) { x = p2.x; y = p2.y; }
            else if (t > 0) { x += dx * t; y += dy * t; }
        }
        dx = p.x - x; dy = p.y - y;
        return dx * dx + dy * dy;
    }

    const simplifyDP = (points: { x: number, y: number }[], first: number, last: number, sqTol: number, out: { x: number, y: number }[]) => {
        let maxSqDist = sqTol;
        let index = -1;
        for (let i = first + 1; i < last; i++) {
            const p = points[i];
            const p1 = points[first];
            const p2 = points[last];
            if (!p || !p1 || !p2) continue; // Safety check

            const sqDist = getSqSegDist(p, p1, p2);
            if (sqDist > maxSqDist) { index = i; maxSqDist = sqDist; }
        }
        if (index > -1) {
            simplifyDP(points, first, index, sqTol, out);
            const p = points[index];
            if (p) out.push(p);
            simplifyDP(points, index, last, sqTol, out);
        }
    }

    const firstPoint = points[0];
    if (!firstPoint) return points;

    const out = [firstPoint];
    simplifyDP(points, 0, points.length - 1, sqTolerance, out);

    const lastPoint = points[points.length - 1];
    if (lastPoint && lastPoint !== firstPoint) out.push(lastPoint);

    return out;
};


const drawStroke = (context: CanvasRenderingContext2D, stroke: { x: number, y: number }[]) => {
    if (stroke.length < 2) return;
    context.beginPath();
    const start = toScreen(stroke[0]!.x, stroke[0]!.y);
    context.moveTo(start.x, start.y);

    for (let i = 1; i < stroke.length; i++) {
        const p = toScreen(stroke[i]!.x, stroke[i]!.y);
        context.lineTo(p.x, p.y);
    }
    context.stroke();
};

const drawAll = () => {
    if (!ctx.value || !canvasRef.value) return;
    ctx.value.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height);

    // Grid or background? White for now.

    ctx.value.lineWidth = LINE_WIDTH * scale.value;

    for (const stroke of strokes.value) {
        drawStroke(ctx.value, stroke);
    }

    if (currentStroke.value.length > 0) {
        drawStroke(ctx.value, currentStroke.value);
    }
};

const handleWheel = (e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
        if (!canvasRef.value) return;
        e.preventDefault();
        const zoomIntensity = 0.1;
        const delta = -Math.sign(e.deltaY) * zoomIntensity;
        const newScale = Math.min(Math.max(0.1, scale.value + delta), 5);

        // Zoom towards mouse
        const rect = canvasRef.value!.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const virtualX = (mouseX - offset.value.x) / scale.value;
        const virtualY = (mouseY - offset.value.y) / scale.value;

        offset.value.x = mouseX - virtualX * newScale;
        offset.value.y = mouseY - virtualY * newScale;

        scale.value = newScale;
        drawAll();
    } else {
        // Pan
        // e.preventDefault();
        // offset.value.x -= e.deltaX;
        // offset.value.y -= e.deltaY;
        // drawAll();
    }
};

// IO
const generateSvg = () => {
    // Calculate bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    const allStrokes = [...strokes.value, ...((currentStroke.value.length > 0) ? [currentStroke.value] : [])];

    if (allStrokes.length === 0) return null;

    for (const stroke of allStrokes) {
        for (const p of stroke) {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
        }
    }

    // Padding
    const padding = 20;
    minX -= padding; minY -= padding;
    maxX += padding; maxY += padding;
    const width = maxX - minX;
    const height = maxY - minY;

    let pathData = '';
    for (const stroke of allStrokes) {
        if (stroke.length < 2) continue;
        pathData += `M ${stroke[0]!.x - minX} ${stroke[0]!.y - minY} `;
        for (let i = 1; i < stroke.length; i++) {
            pathData += `L ${stroke[i]!.x - minX} ${stroke[i]!.y - minY} `;
        }
    }

    const strokeJson = JSON.stringify(strokes.value);
    const encodedStrokes = strokeJson.replace(/"/g, '&quot;');

    const svg = `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" stroke="black" fill="none" class="handwritten-block-svg">
    ${backgroundHtml.value ? `<foreignObject width="100%" height="100%" x="0" y="0">${backgroundHtml.value}</foreignObject>` : ''}
    <desc>${encodedStrokes}</desc>
    <path d="${pathData}" stroke-width="${LINE_WIDTH}" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

    return svg.trim();
};

const save = async () => {
    const svgContent = generateSvg();
    if (!svgContent) {
        // If empty, maybe just cancel or clear?
        emit('cancel');
        return;
    }

    const currentPath = props.currentFilePath;
    const rootHandle = props.rootHandle;

    if (!rootHandle || !currentPath) {
        alert("Please save the file to disk first.");
        return;
    }

    try {
        const timestamp = new Date().getTime();
        let filename = `drawing_${timestamp}.svg`;

        // Reuse existing filename if available
        const match = props.block.markdown?.match(/!\[.*?\]\((.*?)\)/);
        if (match && match[1]) {
            // Extract basename and strip query params
            const fullPath = decodeURI(match[1]).split('?')[0] || '';
            const existingName = fullPath.split('/').pop();
            if (existingName && existingName.endsWith('.svg')) {
                filename = existingName;
            }
        }

        // Save relative to current file
        const fileDir = currentPath.substring(0, currentPath.lastIndexOf('/'));
        const currentFileName = currentPath.split('/').pop()?.replace('.mthd', '') || 'untitled';
        const imagesDirName = `${currentFileName}___images`;
        const targetPath = fileDir ? `${fileDir}/${imagesDirName}/${filename}` : `${imagesDirName}/${filename}`;

        // Create a File object
        const blob = new Blob([svgContent], { type: 'image/svg+xml' });
        const file = new File([blob], filename, { type: 'image/svg+xml' });

        await fileService.saveAsset(rootHandle, targetPath, file);

        // Update block markdown (force reload with timestamp)
        const relativeMarkdownPath = `${imagesDirName}/${filename}`;
        const encodedPath = encodeURI(relativeMarkdownPath);
        props.block.markdown = `![Drawing](${encodedPath}?t=${timestamp})`;

        emit('save');
    } catch (e) {
        console.error("Failed to save drawing", e);
        alert("Failed to save drawing.");
    }
};

const loadFromMarkdown = async (markdown: string) => {
    // Extract image path
    const match = markdown.match(/!\[.*?\]\((.*?)\)/);
    if (!match || !match[1]) return;

    // Strip query params (like ?t=...)
    const relativePath = decodeURI(match[1]).split('?')[0] || '';

    if (!props.rootHandle || !props.currentFilePath) return;

    try {
        const fileDir = props.currentFilePath.substring(0, props.currentFilePath.lastIndexOf('/'));
        const targetPath = fileDir ? `${fileDir}/${relativePath}` : relativePath;

        const fileHandle = await fileService.getFileHandleByPath(props.rootHandle, targetPath);
        const file = await fileHandle.getFile();
        const text = await file.text();

        // Parse SVG to find desc
        // Parse SVG to find desc and background
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'image/svg+xml');
        const desc = doc.querySelector('desc');
        const foreignObject = doc.querySelector('foreignObject');

        if (desc && desc.textContent) {
            strokes.value = JSON.parse(desc.textContent);
            drawAll();
        }

        if (foreignObject) {
            backgroundHtml.value = foreignObject.innerHTML;
        }
    } catch (e) {
        console.error("Failed to load existing drawing strokes", e);
    }
};
</script>

<template>
    <div class="flex flex-col w-full h-[500px] border border-neutral-300 rounded bg-white relative overflow-hidden"
        ref="containerRef">
        <!-- Toolbar -->
        <div class="absolute top-2 left-2 z-10 flex gap-2">
            <button @click="emit('cancel')"
                class="px-3 py-1 bg-white shadow rounded text-sm hover:bg-neutral-50">Cancel</button>
            <button @click="save"
                class="px-3 py-1 bg-neutral-900 text-white shadow rounded text-sm hover:bg-neutral-700">Done</button>
        </div>

        <div class="absolute top-2 right-2 z-10 flex gap-2 bg-white/80 p-1 rounded shadow text-xs text-neutral-500">
            <span>Space+Drag to Pan</span>
            <span>Ctrl+Scroll to Zoom</span>
        </div>

        <!-- Background Content (Text) -->
        <div v-if="backgroundHtml" class="absolute top-0 left-0 w-full h-full pointer-events-none"
            :style="{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`, transformOrigin: '0 0' }">
            <div v-html="backgroundHtml"></div>
        </div>

        <canvas ref="canvasRef" class="w-full h-full cursor-crosshair touch-none" @mousedown="startDrawing"
            @mousemove="moveDrawing" @mouseup="stopDrawing" @mouseleave="stopDrawing" @touchstart.prevent="startDrawing"
            @touchmove.prevent="moveDrawing" @touchend.prevent="stopDrawing" @wheel="handleWheel"></canvas>
    </div>
</template>
