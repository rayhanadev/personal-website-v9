interface GameOfLife {
  start: () => void;
  stop: (onComplete?: () => void) => void;
}

export function createGameOfLife(canvas: HTMLCanvasElement): GameOfLife {
  let worker: Worker | null = null;
  let onFadeOutComplete: (() => void) | null = null;
  let running = false;
  let initialized = false;

  function handleMouseMove(e: MouseEvent): void {
    worker?.postMessage({ type: "mousemove", payload: { x: e.clientX, y: e.clientY } });
  }

  function handleMouseDown(): void {
    worker?.postMessage({ type: "mousedown" });
  }

  function handleMouseUp(): void {
    worker?.postMessage({ type: "mouseup" });
  }

  function handleResize(): void {
    worker?.postMessage({
      type: "resize",
      payload: { width: window.innerWidth, height: window.innerHeight },
    });
  }

  function addEventListeners(): void {
    window.addEventListener("resize", handleResize);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);
  }

  function removeEventListeners(): void {
    window.removeEventListener("resize", handleResize);
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mousedown", handleMouseDown);
    window.removeEventListener("mouseup", handleMouseUp);
  }

  return {
    start(): void {
      if (running) return;
      running = true;

      if (!initialized) {
        const offscreen = canvas.transferControlToOffscreen();

        worker = new Worker(new URL("./game-of-life.worker.ts", import.meta.url), {
          type: "module",
        });

        worker.onmessage = (e: MessageEvent) => {
          if (e.data.type === "fadeOutComplete") {
            running = false;
            removeEventListeners();
            onFadeOutComplete?.();
            onFadeOutComplete = null;
          }
        };

        worker.postMessage(
          {
            type: "init",
            payload: {
              canvas: offscreen,
              width: window.innerWidth,
              height: window.innerHeight,
            },
          },
          [offscreen],
        );

        initialized = true;
      } else {
        worker?.postMessage({
          type: "start",
          payload: { width: window.innerWidth, height: window.innerHeight },
        });
      }

      addEventListeners();
    },

    stop(onComplete?: () => void): void {
      if (!running) {
        onComplete?.();
        return;
      }
      onFadeOutComplete = onComplete ?? null;
      worker?.postMessage({ type: "stop" });
    },
  };
}
