import { spawn } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const studio = join(root, 'tools', 'svg-shape-studio')
const viteEntry = (directory) => join(directory, 'node_modules', 'vite', 'bin', 'vite.js')

const processes = [
  spawn(process.execPath, ['--watch', join(root, 'tools', 'library-server.mjs')], { cwd: root, stdio: 'inherit', windowsHide: true }),
  spawn(process.execPath, [viteEntry(root), '--port', '5173'], { cwd: root, stdio: 'inherit' }),
  spawn(process.execPath, [viteEntry(studio), '--port', '5174'], { cwd: studio, stdio: 'inherit' }),
]

const stop = () => processes.forEach((child) => child.kill())
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
processes.forEach((child) => child.on('exit', (code) => { if (code) { stop(); process.exitCode = code } }))
