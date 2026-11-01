import {readFile,writeFile} from 'node:fs/promises'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'

export const validReleaseVersion=version=>/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:alpha|beta|rc)\.(0|[1-9]\d*))?$/.test(version)
export async function readVersion(root=resolve(dirname(fileURLToPath(import.meta.url)),'..')) {
  const source=await readFile(resolve(root,'src/version.js'),'utf8')
  const version=source.match(/^export const RELEASE_VERSION\s*=\s*['"]([^'"]+)['"]/m)?.[1]
  if(!validReleaseVersion(version))throw new Error('Invalid RELEASE_VERSION in src/version.js')
  return version
}
export async function setVersion(version,root=resolve(dirname(fileURLToPath(import.meta.url)),'..')) {
  const sourcePath=resolve(root,'src/version.js'),source=await readFile(sourcePath,'utf8')
  const previous=await readVersion(root)
  version??=previous
  if(!validReleaseVersion(version))throw new Error('Use a version such as 1.2.3 or 1.2.3-alpha.0, beta.0 or rc.0.')
  const files=['package.json','package-lock.json','tools/svg-shape-studio/package.json','tools/svg-shape-studio/package-lock.json']
  const entries=await Promise.all(files.map(async file=>{const target=resolve(root,file),data=JSON.parse(await readFile(target,'utf8'));data.version=version;if(data.packages?.[''])data.packages[''].version=version;return {target,data}}))
  if(version!==previous)await writeFile(sourcePath,source.replace(/^(export const RELEASE_VERSION\s*=\s*['"])[^'"]+(['"])/m,(_,prefix,suffix)=>prefix+version+suffix))
  for(const {target,data} of entries){const content=JSON.stringify(data,null,2)+'\n';if(await readFile(target,'utf8')!==content)await writeFile(target,content)}
  return version
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  console.log('Package versions synced from src/version.js: '+await setVersion(process.argv[2]))
}
