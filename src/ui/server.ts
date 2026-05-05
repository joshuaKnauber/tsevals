export interface UiServerOptions {
  port?: number;
}

export async function startUiServer(_options: UiServerOptions = {}): Promise<void> {
  throw new Error("ui server not implemented");
}
