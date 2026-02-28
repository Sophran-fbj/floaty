export async function invoke(_cmd: string, _args?: Record<string, unknown>): Promise<unknown> {
  return {};
}

export async function listen(_event: string, _handler: (event: unknown) => void): Promise<() => void> {
  return () => {};
}

export async function emit(_event: string, _payload?: unknown): Promise<void> {}

export function getCurrent() {
  return {
    label: "test-window",
    listen: async (_event: string, _handler: (event: unknown) => void) => () => {},
    emit: async (_event: string, _payload?: unknown) => {},
    setAlwaysOnTop: async (_alwaysOnTop: boolean) => {},
    setSize: async (_size: { width: number; height: number }) => {},
    setPosition: async (_position: { x: number; y: number }) => {},
    close: async () => {},
    show: async () => {},
    hide: async () => {},
    onMoved: async (_handler: (event: unknown) => void) => () => {},
    onResized: async (_handler: (event: unknown) => void) => () => {},
  };
}
