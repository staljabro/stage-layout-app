import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve,dirname} from 'node:path'
import {setVersion,readVersion,validReleaseVersion} from './set-version.mjs'
import {releaseMetadata,githubReleaseExists} from './release-version.mjs'
import {APP_VERSION,RELEASE_VERSION} from '../src/version.js'

test('release and UI versions follow version.js with stable and prerelease tags',async()=>{
  assert.equal(await readVersion(),RELEASE_VERSION)
  assert.ok(validReleaseVersion(RELEASE_VERSION));assert.ok(APP_VERSION.startsWith(RELEASE_VERSION.split('-')[0]))
  assert.deepEqual(releaseMetadata('1.2.3'),{version:'1.2.3',tag:'v1.2.3',prerelease:false})
  assert.equal(releaseMetadata('1.2.3-alpha.0').prerelease,true)
  for(const value of ['latest','../1.2.3','v1.2.3','1.2.3;bad','01.2.3','1.2.3-alpha.01'])assert.equal(validReleaseVersion(value),false)
})
test('version command updates both packages and lockfiles without changing dependencies',async()=>{
  const root=await mkdtemp(join(tmpdir(),'stageplot-version-'))
  try{
    await mkdir(join(root,'tools/svg-shape-studio'),{recursive:true})
    await mkdir(join(root,'src'))
    await writeFile(join(root,'src/version.js'),"export const RELEASE_VERSION='1.0.0'\nexport const APP_VERSION=RELEASE_VERSION\n")
    const files=['package.json','package-lock.json','tools/svg-shape-studio/package.json','tools/svg-shape-studio/package-lock.json']
    for(const file of files)await writeFile(join(root,file),JSON.stringify({version:'1.0.0',dependencies:{react:'latest'},packages:{'':{version:'1.0.0'}}}))
    await setVersion('1.1.0-beta.2',root)
    assert.equal(await readVersion(root),'1.1.0-beta.2')
    for(const file of files){const saved=JSON.parse(await readFile(join(root,file),'utf8'));assert.equal(saved.version,'1.1.0-beta.2');assert.equal(saved.packages[''].version,'1.1.0-beta.2');assert.deepEqual(saved.dependencies,{react:'latest'})}
    await writeFile(join(root,'src/version.js'),"export const RELEASE_VERSION='2.3.4'\nexport const APP_VERSION=RELEASE_VERSION\n")
    assert.equal(releaseMetadata(await readVersion(root)).tag,'v2.3.4','release metadata reads the source even before package mirrors are synced')
    assert.equal(await setVersion(undefined,root),'2.3.4','direct source edits sync without repeating the version')
    for(const file of files)assert.equal(JSON.parse(await readFile(join(root,file),'utf8')).version,'2.3.4')
    await assert.rejects(setVersion('not-semver',root),/Use a version/)
    assert.equal(await readVersion(root),'2.3.4')
    await writeFile(join(root,'src/version.js'),"export const RELEASE_VERSION='invalid'\n")
    await assert.rejects(readVersion(root),/Invalid RELEASE_VERSION/)
  }finally{assert.equal(dirname(resolve(root)),resolve(tmpdir()));await rm(root,{recursive:true,force:true})}
})
test('release checks preserve published versions and fail on GitHub errors',async()=>{
  assert.equal(await githubReleaseExists('owner/repo','v1.2.3','token',async()=>({status:200,ok:true})),true)
  assert.equal(await githubReleaseExists('owner/repo','v1.2.3','token',async()=>({status:404,ok:false})),false)
  await assert.rejects(githubReleaseExists('owner/repo','v1.2.3','token',async()=>({status:403,ok:false})),/HTTP 403/)
})
