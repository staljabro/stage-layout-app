import { DatabaseSync } from 'node:sqlite'
import { randomBytes, createHash } from 'node:crypto'
import { mkdir, readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

export const uid = () => randomBytes(16).toString('hex')
export const token = () => randomBytes(24).toString('hex')
export const digest = value => createHash('sha256').update(value).digest('hex')
export const roles = ['owner','admin','contributor','editor']
export const manager = user => ['owner','admin'].includes(user?.role)
export const designer = user => manager(user) || user?.role === 'contributor'
export const fail = (status,message) => {throw Object.assign(new Error(message),{status})}
export const publicUser = row => row ? {id:row.id,email:row.email,name:row.name,friendlyName:row.friendly_name || '',role:row.role,disabled:!!row.disabled,empire:!!row.empire,githubId:row.github_id || null,githubLogin:row.github_login || null} : null
export async function openStore(root) {
  const directory=join(root,'account-data')
  await mkdir(directory,{recursive:true})
  const db=new DatabaseSync(join(directory,'stageplot.sqlite'))
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,role TEXT NOT NULL,password TEXT NOT NULL,disabled INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS assets(kind TEXT NOT NULL,id TEXT NOT NULL,owner_id TEXT REFERENCES users(id),data TEXT NOT NULL,revision INTEGER NOT NULL,deleted INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(kind,id));
    CREATE TABLE IF NOT EXISTS revisions(kind TEXT NOT NULL,asset_id TEXT NOT NULL,revision INTEGER NOT NULL,data TEXT NOT NULL,actor TEXT,created TEXT NOT NULL,deleted INTEGER NOT NULL,PRIMARY KEY(kind,asset_id,revision));
    CREATE TABLE IF NOT EXISTS submissions(id TEXT PRIMARY KEY,kind TEXT NOT NULL,asset_id TEXT NOT NULL,owner_id TEXT NOT NULL,snapshot TEXT NOT NULL,target_id TEXT NOT NULL,target_revision INTEGER NOT NULL,status TEXT NOT NULL,review_note TEXT NOT NULL DEFAULT '',created TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id),name TEXT NOT NULL,data TEXT NOT NULL,revision INTEGER NOT NULL,deleted INTEGER NOT NULL DEFAULT 0,share_token TEXT UNIQUE,updated TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS project_revisions(project_id TEXT NOT NULL,revision INTEGER NOT NULL,data TEXT NOT NULL,name TEXT NOT NULL,created TEXT NOT NULL,PRIMARY KEY(project_id,revision));
    CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);`)
  if(!db.prepare('PRAGMA table_info(users)').all().some(column=>column.name==='empire')) {
    db.exec("ALTER TABLE users ADD COLUMN empire INTEGER NOT NULL DEFAULT 0; UPDATE users SET empire=1 WHERE role='owner'")
  }
  if(!db.prepare('PRAGMA table_info(users)').all().some(column=>column.name==='friendly_name'))db.exec("ALTER TABLE users ADD COLUMN friendly_name TEXT NOT NULL DEFAULT ''")
  const get=(sql,...args)=>db.prepare(sql).get(...args)
  const all=(sql,...args)=>db.prepare(sql).all(...args)
  const run=(sql,...args)=>db.prepare(sql).run(...args)
  const transaction=fn=>{db.exec('BEGIN IMMEDIATE');try{const value=fn();db.exec('COMMIT');return value}catch(error){db.exec('ROLLBACK');throw error}}
  const asset=(kind,id)=>get('SELECT * FROM assets WHERE kind=? AND id=?',kind,id)
  const saveAsset=(kind,id,data,user,owner=null,deleted=0)=>{
    const previous=asset(kind,id),revision=(previous?.revision || 0)+1
    const cleaned={...data,id,revision,ownerId:owner}
    delete cleaned.resetShareLink
    const json=JSON.stringify(cleaned)
    run('INSERT INTO assets VALUES(?,?,?,?,?,?) ON CONFLICT(kind,id) DO UPDATE SET owner_id=excluded.owner_id,data=excluded.data,revision=excluded.revision,deleted=excluded.deleted',kind,id,owner,json,revision,deleted)
    run('INSERT INTO revisions VALUES(?,?,?,?,?,?,?)',kind,id,revision,json,user?.id || null,new Date().toISOString(),deleted)
    return cleaned
  }
  if(!get("SELECT * FROM settings WHERE key='imported'")) {
    for(const [kind,folder,suffix] of [['items','equipment-library','.stageplot-item.json'],['stages','stage-library','.stageplot-stage.json']]) {
      await mkdir(join(root,folder),{recursive:true})
      for(const file of await readdir(join(root,folder)))if(file.endsWith(suffix)) {
        const data=JSON.parse(await readFile(join(root,folder,file),'utf8'))
        transaction(()=>saveAsset(kind,data.id,data,null))
      }
    }
    let groups=[]
    try{groups=JSON.parse(await readFile(join(root,'equipment-library','groups.json'),'utf8'))}catch(error){if(error.code!=='ENOENT')throw error}
    run("INSERT OR REPLACE INTO settings VALUES('groups',?)",JSON.stringify(groups))
    run("INSERT INTO settings VALUES('imported','true')")
  }
  return {db,get,all,run,transaction,asset,saveAsset}
}
