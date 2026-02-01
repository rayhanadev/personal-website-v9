export type Edge = 'top' | 'bottom' | 'left' | 'right';

export function getEdge(e: MouseEvent, rect: DOMRect): Edge {
  const distances = {
    top: Math.abs(e.clientY - rect.top),
    bottom: Math.abs(e.clientY - rect.bottom),
    left: Math.abs(e.clientX - rect.left),
    right: Math.abs(e.clientX - rect.right),
  };
  return Object.entries(distances).reduce((a, b) => a[1] < b[1] ? a : b)[0] as Edge;
}

export function isHorizontal(edge: Edge): boolean {
  return edge === 'left' || edge === 'right';
}

export function getScaleTransform(edge: Edge): string {
  return isHorizontal(edge) ? 'scaleX(0)' : 'scaleY(0)';
}
