/**
 * dsh-shot · Host half.
 *
 * Answers one question for the browser: the rectangle the user just picked on
 * screen, as PNG bytes. Picking is done here rather than in the page: this is a
 * plain Node process with neither Electron's desktopCapturer nor a renderer's
 * getDisplayMedia, and a page cannot draw a selection frame outside its own
 * window. Windows gets a selection layer of our own (windows-script.js) so it
 * can span every monitor; macOS and Linux use the platform's snipper.
 *
 * The browser half owns everything else: the composer attachment, the prompt
 * shortcuts, and the shortcut command.
 */
import { execFile } from 'node:child_process'
import { access, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { encodeWindowsScript, windowsScript } from './windows-script.js'

/** Exactly one snip route, absolute below /api; only the owner Peer may call it. */
const ROUTE_PATH = '/api/dsh-shot.snip'
/** How long the user may take in the selection UI. */
const SNIP_TIMEOUT_MS = 120_000

export const name = 'dsh-shot'
export const inject = ['connection']

/**
 * Register the snip route for this Host.
 * @param ctx - Host context carrying the Connection service.
 */
export function apply(ctx) {
  ctx.effect(() => ctx.connection.fetch.register({
    path: ROUTE_PATH,
    methods: ['GET'],
    requestBody: 'buffered',
    fetch: async () => {
      try {
        const png = await snip()
        return new Response(png, {
          status: 200,
          headers: {
            'content-type': 'image/png',
            'content-length': String(png.length),
            'cache-control': 'no-store',
          },
        })
      } catch (error) {
        return new Response(JSON.stringify({ error: messageOf(error) }), {
          status: 500,
          headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
        })
      }
    },
  }), 'dsh-shot: snip route')
}

/**
 * Open the selection UI and read the picked PNG back.
 * @returns PNG bytes.
 */
async function snip() {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-shot-'))
  const destination = join(directory, 'shot.png')
  try {
    await snipTo(destination)
    const bytes = await readFile(destination).catch(() => undefined)
    if (bytes === undefined || bytes.length === 0) throw new Error('the screen snip was cancelled')
    return bytes
  } finally {
    await rm(directory, { recursive: true, force: true }).catch(() => {})
  }
}

/**
 * Let the user pick a rectangle and write it to a path.
 * @param destination - absolute path of the PNG to create.
 */
async function snipTo(destination) {
  if (process.platform === 'win32') {
    await run('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-STA',
      '-EncodedCommand', encodeWindowsScript(windowsScript(destination)),
    ])
    return
  }
  if (process.platform === 'darwin') {
    await run('screencapture', ['-i', '-x', '-t', 'png', destination])
    await ensureFile(destination)
    return
  }
  await snipLinux(destination)
}

/**
 * The usual Linux snip tools, most specific first; the first one that is
 * installed and writes a file wins.
 * @param destination - absolute path of the PNG to write.
 */
async function snipLinux(destination) {
  const attempts = [
    ['maim', ['-s', destination]],
    ['scrot', ['-s', destination]],
    ['gnome-screenshot', ['-a', '-f', destination]],
    ['spectacle', ['-r', '-b', '-n', '-o', destination]],
    ['import', [destination]],
  ]
  const failures = []
  for (const [file, args] of attempts) {
    try {
      await run(file, args)
      const bytes = await readFile(destination).catch(() => undefined)
      if (bytes !== undefined && bytes.length > 0) return
      failures.push(`${file}: produced no image`)
    } catch (error) {
      failures.push(`${file}: ${messageOf(error)}`)
    }
  }
  throw new Error(`no usable screen snip command (${failures.join('; ')})`)
}

/**
 * Fail with the cancellation message when the helper never wrote its file.
 * @param path - the file the helper was asked to write.
 */
async function ensureFile(path) {
  try {
    await access(path)
  } catch {
    throw new Error('the screen snip was cancelled')
  }
}

/**
 * Run one platform helper to completion.
 * @param file - executable path or name.
 * @param args - arguments.
 * @returns stdout text.
 */
function run(file, args) {
  return new Promise((resolve, reject) => {
    execFile(file, args, { timeout: SNIP_TIMEOUT_MS, windowsHide: true, maxBuffer: 8 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error === null) {
          resolve(stdout)
          return
        }
        const detail = String(stderr ?? '').trim()
        reject(new Error(detail === '' ? messageOf(error) : detail))
      })
  })
}

/**
 * @param error - any thrown value.
 * @returns a readable message.
 */
function messageOf(error) {
  return error instanceof Error ? error.message : String(error)
}
