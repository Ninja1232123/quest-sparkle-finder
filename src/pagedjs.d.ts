// Minimal ambient types for pagedjs (ships no .d.ts). Only what the document
// builder uses: the Previewer, the Handler base class, and handler registration.
declare module "pagedjs" {
  export class Handler {
    constructor(chunker?: unknown, polisher?: unknown, caller?: unknown);
    afterPageLayout?(pageElement: HTMLElement, page?: unknown, breakToken?: unknown, chunker?: unknown): void;
  }
  export class Previewer {
    preview(
      content: Node | string,
      stylesheets?: Array<string | Record<string, string>>,
      renderTo?: HTMLElement,
    ): Promise<{ total: number; pages: unknown[] }>;
  }
  export function registerHandlers(...handlers: Array<typeof Handler>): void;
}
