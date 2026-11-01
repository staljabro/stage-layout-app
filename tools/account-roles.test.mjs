import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve,dirname} from 'node:path'
import {openStore,roles,designer,manager} from './account-store.mjs'
import {createUserWorkspace} from './user-workspace.mjs'

test('role migration preserves identities, ownership and disabled state while replacing old roles',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'stageplot-roles-'))
  let store=await openStore(directory)
  try{
    for(const role of ['owner','admin','editor','contributor']){
      store.run('INSERT INTO users(id,email,name,role,password,disabled) VALUES(?,?,?,?,?,?)',role,role+'@test.invalid',role,role,'github-only',role==='contributor'?1:0)
      store.run('INSERT INTO sessions VALUES(?,?,?)',role,role,Date.now()+100000)
    }
    store.saveAsset('items','old-design',{schema:'stageplot-item@3',label:'Retained'}, {id:'editor'},'editor')
    createUserWorkspace(store)
    store.run('INSERT INTO wf_organisations VALUES(?,?,?,?,?)','team','Team','owner',1,new Date().toISOString())
    store.run('INSERT INTO wf_members VALUES(?,?,?)','team','editor','member')
    store.run('INSERT INTO wf_org_invitations VALUES(?,?,?,?,?,?,?)','invite','team','a'.repeat(48),'','member','owner',new Date().toISOString())
    store.db.close();store=await openStore(directory);createUserWorkspace(store)
    assert.deepEqual(roles,['user','admin','owner'])
    assert.equal(store.get('SELECT role FROM users WHERE id=?','editor').role,'user')
    assert.equal(store.get('SELECT role,disabled FROM users WHERE id=?','contributor').disabled,1)
    assert.equal(store.asset('items','old-design').owner_id,'editor')
    assert.equal(store.get('SELECT role FROM users WHERE id=?','owner').role,'owner')
    assert.equal(store.get('SELECT role FROM users WHERE id=?','admin').role,'admin')
    assert.equal(store.get('SELECT hash FROM sessions WHERE user_id=?','editor'),undefined)
    assert.ok(store.get('SELECT hash FROM sessions WHERE user_id=?','owner'))
    assert.equal(store.get('SELECT role FROM wf_members WHERE organisation_id=?','team').role,'user')
    assert.equal(store.get('SELECT role FROM wf_org_invitations WHERE id=?','invite').role,'user')
    assert.equal(designer({role:'user'}),true);assert.equal(manager({role:'user'}),false)
  }finally{store.db.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true})}
})
