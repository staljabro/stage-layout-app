import {appendFile} from 'node:fs/promises'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {validReleaseVersion,readVersion} from './set-version.mjs'

export function releaseMetadata(version){if(!validReleaseVersion(version))throw new Error('Invalid release version');return {version,tag:'v'+version,prerelease:version.includes('-')}}
export async function githubReleaseExists(repository,tag,token,fetcher=fetch){
  const response=await fetcher(`https://api.github.com/repos/${repository}/releases/tags/${encodeURIComponent(tag)}`,{headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`,'X-GitHub-Api-Version':'2022-11-28'}})
  if(response.status===404)return false
  if(!response.ok)throw new Error('Unable to check existing GitHub release: HTTP '+response.status)
  return true
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
  const metadata=releaseMetadata(await readVersion(root))
  const exists=process.argv.includes('--github')?await githubReleaseExists(process.env.GITHUB_REPOSITORY,metadata.tag,process.env.GH_TOKEN):false
  const output=Object.entries({...metadata,publish_version:!exists}).map(([key,value])=>`${key}=${value}`).join('\n')+'\n'
  if(process.env.GITHUB_OUTPUT)await appendFile(process.env.GITHUB_OUTPUT,output);else process.stdout.write(output)
}
