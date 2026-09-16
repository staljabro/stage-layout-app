import { createServer } from 'node:http'
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const libraryDir = join(root, 'equipment-library')
const stageLibraryDir = join(root, 'stage-library')
const groupsFile = join(libraryDir, 'groups.json')
const port = Number(process.env.STAGEPLOT_LIBRARY_PORT || 8787)

await mkdir(libraryDir, { recursive: true })
await mkdir(stageLibraryDir, { recursive: true })

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
}

const send = (response, status, body) => {
  response.writeHead(status, { ...headers, 'Content-Type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(body))
}

const validId = (value) => /^[a-z0-9][a-z0-9-]{0,79}$/.test(value)

function migrateItem(item) {
  let working = item
  let migrated = false
  if (working.schema === 'stageplot-item@1') {
    const layers = (working.editor?.layers || []).map((layer) => ({ ...layer, collision: layer.type !== 'line' }))
    const shapes = layers.map((layer) => ({
      id: String(layer.id), name: layer.name, type: layer.type,
      x: layer.x / 100, y: layer.y / 100, width: layer.width / 100, height: layer.height / 100,
      fill: layer.fill, stroke: layer.stroke, strokeWidth: layer.strokeWidth, rotation: layer.rotation || 0,
    }))
    const collisionShapes = layers.filter((layer) => layer.collision).map((layer) => ({
      type: layer.type === 'circle' ? 'ellipse' : layer.type === 'roundRect' ? 'rect' : layer.type,
      x: layer.x / 100, y: layer.y / 100, width: layer.width / 100, height: layer.height / 100, rotation: layer.rotation || 0,
    }))
    working = { schema: 'stageplot-item@2', id: working.id, label: working.label, groupId: null, dimensions: working.dimensions, shapes, collisionShapes, editor: { layers } }
    migrated = true
  }
  if (working.schema === 'stageplot-item@2') {
    const width = working.dimensions.widthMeters
    const depth = working.dimensions.depthMeters
    const toMetres = (shape) => ({ ...shape, x: shape.x * width, y: shape.y * depth, width: shape.width * width, height: shape.height * depth })
    const shapes = working.shapes.map(toMetres)
    const collisionShapes = working.collisionShapes.map(toMetres)
    const layers = shapes.map((shape) => ({ ...shape, id: Number(shape.id) || shape.id, collision: collisionShapes.some((candidate) => candidate.type === (shape.type === 'circle' ? 'ellipse' : shape.type === 'roundRect' ? 'rect' : shape.type) && Math.abs(candidate.x - shape.x) < .0001 && Math.abs(candidate.y - shape.y) < .0001) }))
    working = { ...working, schema: 'stageplot-item@3', shapes, collisionShapes, editor: { layers } }
    migrated = true
  }
  return { item: working, migrated }
}

async function readLibraryItem(file) {
  const parsed = JSON.parse(await readFile(file, 'utf8'))
  const result = migrateItem(parsed)
  if (result.migrated) await writeFile(file, `${JSON.stringify(result.item, null, 2)}\n`, 'utf8')
  return result.item
}

const server = createServer(async (request, response) => {
  if (request.method === 'OPTIONS') return send(response, 204, {})
  const url = new URL(request.url, `http://${request.headers.host}`)

  try {
    if (request.method === 'GET' && url.pathname === '/api/items') {
      const names = (await readdir(libraryDir)).filter((name) => name.endsWith('.stageplot-item.json'))
      const items = await Promise.all(names.map((name) => readLibraryItem(join(libraryDir, name))))
      return send(response, 200, items.sort((a, b) => a.label.localeCompare(b.label)))
    }

    if (request.method === 'GET' && url.pathname === '/api/stages') {
      const names = (await readdir(stageLibraryDir)).filter((name) => name.endsWith('.stageplot-stage.json'))
      const stages = await Promise.all(names.map(async (name) => JSON.parse(await readFile(join(stageLibraryDir, name), 'utf8'))))
      return send(response, 200, stages.sort((a, b) => a.label.localeCompare(b.label)))
    }

    if (url.pathname === '/api/groups') {
      if (request.method === 'GET') {
        try { return send(response, 200, JSON.parse(await readFile(groupsFile, 'utf8'))) }
        catch (error) { if (error.code === 'ENOENT') return send(response, 200, []) ; throw error }
      }
      if (request.method === 'PUT') {
        let raw = ''
        for await (const chunk of request) raw += chunk
        const groups = JSON.parse(raw)
        if (!Array.isArray(groups) || groups.some((group) => !validId(group.id) || typeof group.label !== 'string')) return send(response, 400, { error: 'Invalid group data' })
        const temporary = `${groupsFile}.tmp`
        await writeFile(temporary, `${JSON.stringify(groups, null, 2)}\n`, 'utf8')
        await rename(temporary, groupsFile)
        return send(response, 200, groups)
      }
    }

    const match = url.pathname.match(/^\/api\/items\/([^/]+)$/)
    if (match && validId(match[1])) {
      const file = join(libraryDir, `${match[1]}.stageplot-item.json`)
      if (request.method === 'GET') return send(response, 200, await readLibraryItem(file))
      if (request.method === 'PUT') {
        let raw = ''
        for await (const chunk of request) raw += chunk
        if (raw.length > 2_000_000) return send(response, 413, { error: 'Item is too large' })
        const item = JSON.parse(raw)
        if (item.id !== match[1]) return send(response, 400, { error: 'Item ID does not match its filename' })
        if (item.schema !== 'stageplot-item@3') return send(response, 400, { error: 'Unsupported Stageplot item format' })
        if (typeof item.label !== 'string' || !item.label.trim()) return send(response, 400, { error: 'Give the item a name before saving' })
        if (!Array.isArray(item.shapes)) return send(response, 400, { error: 'Item artwork is invalid' })
        if (!Array.isArray(item.collisionShapes)) return send(response, 400, { error: 'Item collision geometry is invalid' })
        const temporary = `${file}.tmp`
        await writeFile(temporary, `${JSON.stringify(item, null, 2)}\n`, 'utf8')
        await rename(temporary, file)
        return send(response, 200, item)
      }
    }

    const stageMatch = url.pathname.match(/^\/api\/stages\/([^/]+)$/)
    if (stageMatch && validId(stageMatch[1])) {
      const file = join(stageLibraryDir, `${stageMatch[1]}.stageplot-stage.json`)
      if (request.method === 'GET') return send(response, 200, JSON.parse(await readFile(file, 'utf8')))
      if (request.method === 'PUT') {
        let raw = ''
        for await (const chunk of request) raw += chunk
        if (raw.length > 15_000_000) return send(response, 413, { error: 'Stage is too large' })
        const stage = JSON.parse(raw)
        if (stage.id !== stageMatch[1] || stage.schema !== 'stageplot-stage@1') return send(response, 400, { error: 'Invalid Stageplot stage' })
        if (!stage.label?.trim() || !stage.dimensions || !Array.isArray(stage.boundary?.nodes) || stage.boundary.nodes.length < 3 || !Array.isArray(stage.collisionBoundary)) return send(response, 400, { error: 'Stage boundary is invalid' })
        const temporary = `${file}.tmp`
        await writeFile(temporary, `${JSON.stringify(stage, null, 2)}\n`, 'utf8')
        await rename(temporary, file)
        return send(response, 200, stage)
      }
    }

    send(response, 404, { error: 'Not found' })
  } catch (error) {
    const status = error.code === 'ENOENT' ? 404 : 500
    send(response, status, { error: status === 404 ? 'Item not found' : error.message })
  }
})

server.listen(port, '127.0.0.1', () => {
  console.log(`Stageplot equipment library: http://127.0.0.1:${port}`)
  console.log(`Files: ${libraryDir}`)
  console.log(`Stages: ${stageLibraryDir}`)
})
