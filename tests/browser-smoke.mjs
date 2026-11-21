import assert from 'node:assert/strict'
import { execFile, spawn } from 'node:child_process'
import { once } from 'node:events'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { join } from 'node:path'
import { env, execPath } from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath, URL } from 'node:url'
import { promisify } from 'node:util'

import { chromium } from 'playwright-core'
import { createServer as createViteServer } from 'vite'

const { fetch, AbortSignal, console } = globalThis
const run = promisify(execFile)
const cli = fileURLToPath(new URL('../bin/vueforge', import.meta.url))
const fixture = new URL('./fixtures/browser/', import.meta.url)
const scratch = fileURLToPath(new URL('../.vueforge/', import.meta.url))

async function listenPort() {
  const socket = createServer().listen(0, '127.0.0.1')
  await once(socket, 'listening')
  const { port } = socket.address()
  await new Promise((resolve, reject) =>
    socket.close((error) => (error ? reject(error) : resolve())),
  )
  return port
}

async function startBackend(renderer, cwd) {
  const context = { title: 'External renderer', initialCount: 2 }
  const backend = await createViteServer({
    root: cwd,
    configFile: false,
    appType: 'custom',
    server: {
      host: '127.0.0.1',
      port: 0,
      ws: false,
      proxy: { '^/(?!$)': { target: renderer, ws: true } },
    },
    plugins: [
      {
        name: 'external-backend',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (req.url !== '/') return next()

            try {
              const response = await fetch(renderer + '/render', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                  context,
                  props: {
                    title: context.title,
                    'initial-count': context.initialCount,
                    'data-request-note': 'External',
                  },
                  hydrate: true,
                  format: 'html',
                }),
                signal: AbortSignal.timeout(5000),
              })
              const document = await response.text()
              assert.equal(response.status, 200, document)
              assert.match(document, /<title>External renderer 2<\/title>/)
              assert.match(document, /<button\b/)
              res.setHeader('content-type', 'text/html; charset=utf-8')
              res.end(
                document.replace(
                  '<head>',
                  '<head><meta charset="utf-8"><link rel="icon" href="data:,">',
                ),
              )
            } catch (error) {
              next(error)
            }
          })
        },
      },
    ],
  })
  await backend.listen()
  return backend
}

function inspectPage() {
  const { document, performance } = globalThis
  const button = document.querySelector('button')
  return {
    title: document.title,
    titleCount: document.querySelectorAll('head title').length,
    buttonText: button?.textContent,
    requestNoteCount: document.querySelectorAll('[data-request-note]').length,
    color: button && globalThis.getComputedStyle(button).color,
    styles: Array.from(
      document.querySelectorAll('style[data-vite-dev-id]'),
      (style) => style.getAttribute('data-vite-dev-id'),
    ),
    scope: button
      ?.getAttributeNames()
      .find((name) => name.startsWith('data-v-')),
    navigation: performance.timeOrigin,
  }
}

async function checkBrowser(browser, cwd, dev, source) {
  const mode = dev ? 'development' : 'production'
  if (!dev) await run(execPath, [cli, 'build'], { cwd, timeout: 30000 })

  const port = await listenPort()
  const renderer = `http://127.0.0.1:${port}`
  const child = spawn(
    execPath,
    [cli, 'serve', '--port', String(port), ...(dev ? ['--dev'] : [])],
    {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  const closed = once(child, 'close')
  let log = ''
  for (const stream of [child.stdout, child.stderr]) {
    stream.setEncoding('utf8').on('data', (chunk) => {
      log += chunk
    })
  }

  let backend, staticPage, page
  try {
    const deadline = Date.now() + 15000
    while (!log.includes(renderer)) {
      assert.ok(
        child.exitCode === null && Date.now() < deadline,
        'Renderer startup failed',
      )
      await delay(50)
    }

    backend = await startBackend(renderer, cwd)
    const backendURL = `http://127.0.0.1:${backend.httpServer.address().port}`
    staticPage = await browser.newPage({ javaScriptEnabled: false })
    const rawResponse = await staticPage.goto(backendURL)
    assert.equal(rawResponse.status(), 200, await rawResponse.text())
    const staticState = await staticPage.evaluate(inspectPage)
    await staticPage.close()
    assert.equal(staticState.title, 'External renderer 2')
    assert.equal(staticState.titleCount, 1)
    assert.equal(staticState.buttonText, 'External renderer 2')
    assert.equal(staticState.requestNoteCount, 0)
    assert.equal(staticState.color, 'rgb(20, 60, 100)')

    page = await browser.newPage()
    page.setDefaultTimeout(8000)
    const errors = []
    const requests = []
    const sockets = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
      if (['warning', 'error'].includes(message.type()))
        errors.push(message.text())
    })
    page.on('request', (request) => requests.push(request.url()))
    page.on('websocket', (socket) => sockets.push(new URL(socket.url()).host))
    const hmr =
      dev &&
      page.waitForEvent('console', {
        predicate: (message) => message.text().includes('[vite] connected'),
        timeout: 8000,
      })
    await Promise.all([page.goto(backendURL), hmr])

    const button = page.getByRole('button', { name: 'External renderer 2' })
    await button.click()
    await page.waitForFunction(
      () => globalThis.document.title === 'External renderer 3',
    )
    const hydrated = await page.evaluate(inspectPage)
    assert.equal(hydrated.titleCount, 1)
    assert.equal(hydrated.buttonText, 'External renderer 3')
    assert.equal(hydrated.requestNoteCount, 0)
    assert.equal(hydrated.color, staticState.color)
    assert.equal(await page.locator('head meta[charset="utf-8"]').count(), 1)
    assert.equal(
      await page.locator('head link[rel="icon"][href="data:,"]').count(),
      1,
    )

    if (dev) {
      const file = join(cwd, 'src/App.vue').replaceAll('\\', '/')
      const scope = staticState.scope.replace('data-v-', '')
      const styleId = `${file}?vue&type=style&index=0&scoped=${scope}&lang.css`
      assert.deepEqual(staticState.styles, [styleId])
      assert.deepEqual(hydrated.styles, [styleId])
      assert.deepEqual(sockets, [new URL(backendURL).host])

      await writeFile(
        file,
        (await readFile(file, 'utf8')).replace('20, 60, 100', '100, 60, 20'),
      )
      await page.waitForFunction(() => {
        const button = globalThis.document.querySelector('button')
        return (
          button &&
          globalThis.getComputedStyle(button).color === 'rgb(100, 60, 20)'
        )
      })
      const updated = await page.evaluate(inspectPage)
      assert.deepEqual(updated.styles, [styleId])
      assert.equal(updated.navigation, hydrated.navigation)
      assert.equal(updated.title, 'External renderer 3')
      assert.equal(updated.titleCount, 1)
      assert.equal(updated.buttonText, 'External renderer 3')
      // Let the browser close the HMR socket before shutting down the proxy.
      await page.goto('about:blank')
    } else {
      assert.deepEqual(hydrated.styles, [])
      assert.deepEqual(sockets, [])
      assert.ok(requests.some((url) => new URL(url).pathname.endsWith('.js')))
      assert.ok(
        requests.every(
          (url) => !/\/(?:@vite|@vueforge|@id|@fs|src)\//.test(url),
        ),
      )
      assert.equal((await fetch(renderer + '/@vite/client')).status, 404)
      assert.equal((await fetch(renderer + '/@vueforge/client')).status, 404)
      assert.equal((await fetch(renderer + '/src/App.vue')).status, 404)
    }

    assert.deepEqual(errors, [])
    console.log(`Browser smoke passed in ${mode} for ${source}`)
  } catch (error) {
    throw new Error(`Browser smoke failed in ${mode} for ${source}\n${log}`, {
      cause: error,
    })
  } finally {
    try {
      await Promise.all([page?.close(), staticPage?.close()])
      await backend?.close()
    } finally {
      child.kill()
      await closed
    }
  }
}

await mkdir(scratch, { recursive: true })
const cwd = await mkdtemp(join(scratch, 'browser-test-'))
try {
  const browser = await chromium.launch(
    env.BROWSER_EXECUTABLE
      ? { executablePath: env.BROWSER_EXECUTABLE }
      : { channel: 'chrome' },
  )
  try {
    for (const [name, path] of [
      ['factory', 'src/entry.ts'],
      ['component', 'src/App.vue'],
    ]) {
      await cp(fixture, join(cwd, 'src'), { recursive: true })
      await writeFile(
        join(cwd, 'vueforge.config.ts'),
        `export default { ${path.endsWith('.vue') ? 'template' : 'entry'}: ${JSON.stringify(path)} }`,
      )
      // Production runs before the development check edits the fixture's styles.
      await checkBrowser(browser, cwd, false, name)
      await checkBrowser(browser, cwd, true, name)
    }
  } finally {
    await browser.close()
  }
} finally {
  await rm(cwd, { recursive: true, force: true, maxRetries: 3 })
}
