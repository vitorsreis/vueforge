type Props = Record<string, unknown>
export type Render = (props?: Props) => Promise<string>

export function renderFrom(module: unknown): Render {
  if (
    typeof module !== 'object' ||
    module === null ||
    !('render' in module) ||
    typeof module.render !== 'function'
  ) {
    throw new Error('VueForge could not load the render entry.')
  }

  return module.render as Render
}

export function documentShell(script: string, styles = '') {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>VueForge</title>${styles}</head><body><div id="app"><!--vueforge--></div><script type="module" src="${script}"></script></body></html>`
}
