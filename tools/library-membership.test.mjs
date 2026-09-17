import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { isPublishedItem } from './library-membership.mjs'

test('only explicitly checked equipment is published', () => {
  assert.equal(isPublishedItem({ editor: { layers: [] } }), false)
  assert.equal(isPublishedItem({ editor: { advancedShapeRole: 'seatedPerson' } }), false)
  assert.equal(isPublishedItem({ stageplotPublished: true, editor: { advancedShapeRole: 'custom' } }), true)
  assert.equal(isPublishedItem({ stageplotPublished: false }), false)
})

test('API separates custom artwork, publishing, and removing Stageplot entries', { timeout: 15000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'stageplot-membership-'))
  const child = spawn(process.execPath, [fileURLToPath(new URL('./library-server.mjs', import.meta.url))], {
    env: { ...process.env, STAGEPLOT_LIBRARY_ROOT: directory, STAGEPLOT_LIBRARY_PORT: '0' },
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  })
  try {
    const base = await new Promise((resolve, reject) => {
      let output = ''
      child.stdout.on('data', chunk => {
        output += chunk
        const url = output.match(/http:\/\/127\.0\.0\.1:\d+/)
        if (url) resolve(`${url[0]}/api/items`)
      })
      child.once('error', reject)
      child.once('exit', code => reject(new Error(`Library exited: ${code}`)))
    })
    const design = { schema: 'stageplot-item@3', id: 'custom-person', label: 'Custom person', dimensions: { widthMeters: 1, depthMeters: 1 }, shapes: [{ type: 'rect' }], collisionShapes: [], editor: { advancedShapeRole: 'custom', layers: [{ id: 1 }], referenceImages: [{ id: 'photo' }] } }
    const put = async data => {
      const response = await fetch(`${base}/${data.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      assert.equal(response.status, 200)
      return response.json()
    }
    const list = async scope => (await fetch(base + scope)).json()
    await put(design)
    assert.deepEqual(await list(''), [])
    assert.equal((await list('?scope=all')).length, 1)
    await put({ ...design, stageplotPublished: true })
    assert.equal((await list('')).length, 1)
    const response = await fetch(`${base}/${design.id}`, { method: 'DELETE' })
    assert.equal(response.status, 200)
    const removed = await response.json()
    assert.equal(removed.stageplotPublished, false)
    assert.deepEqual(removed.editor, design.editor)
    assert.deepEqual(await list(''), [])
    assert.equal((await list('?scope=all')).length, 1)
    const saved = JSON.parse(await readFile(join(directory, 'equipment-library', 'custom-person.stageplot-item.json'), 'utf8'))
    assert.equal(saved.stageplotPublished, false)
    await put({ ...saved, stageplotPublished: true })
    assert.equal((await list('')).length, 1)
    const groupsUrl = base.replace('/api/items', '/api/groups')
    const putGroups = groups => fetch(groupsUrl, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(groups) })
    const groups = [{ id: 'people', label: 'People' }, { id: 'empty', label: 'Empty' }]
    assert.equal((await putGroups(groups)).status, 200)
    await put({ ...saved, groupId: 'people', stageplotPublished: true })
    assert.equal((await putGroups([{ id: 'people', label: 'Performers' }])).status, 200)
    assert.deepEqual(await (await fetch(groupsUrl)).json(), [{ id: 'people', label: 'Performers' }])
    assert.equal((await list(''))[0].groupId, 'people')
    assert.equal((await putGroups([])).status, 409)
    await fetch(`${base}/${design.id}`, { method: 'DELETE' })
    assert.equal((await putGroups([])).status, 409, 'unpublished designs still prevent group deletion')
    const renamed = await put({ ...saved, label: 'Renamed person', groupId: null, stageplotPublished: true })
    assert.equal(renamed.label, 'Renamed person')
    assert.deepEqual(renamed.editor, saved.editor)
    assert.deepEqual(renamed.shapes, saved.shapes)
    assert.equal((await putGroups([])).status, 200)
    assert.equal((await putGroups([{ id: 'invalid', label: '  ' }])).status, 400)
    const deleted = await fetch(`${base}/${design.id}?permanent=true`, { method: 'DELETE' })
    assert.equal(deleted.status, 200)
    assert.deepEqual(await list('?scope=all'), [])
    await assert.rejects(readFile(join(directory, 'equipment-library', 'custom-person.stageplot-item.json')), { code: 'ENOENT' })
  } finally {
    const exited = child.exitCode === null ? once(child, 'exit') : null
    child.kill()
    if (exited) await exited
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()))
    assert.ok(basename(directory).startsWith('stageplot-membership-'))
    await rm(directory, { recursive: true, force: true })
  }
})
