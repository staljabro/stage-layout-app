import test from 'node:test'
import assert from 'node:assert/strict'
import {workspaceRoute,workspaceUrl,studioLink,studioReturn} from './navigation.js'

test('workspace routes expose stages, private layouts and self-registration without quick plots',()=>{
  assert.equal(workspaceRoute('').view,'home')
  assert.equal(workspaceRoute('?view=invalid').view,'home')
  assert.equal(workspaceRoute('?view=events').view,'events')
  for(const query of ['?band=token','?plot=id'])assert.equal(workspaceRoute(query).screen,'layout')
  assert.deepEqual(workspaceRoute('?space=id&mode=stock'),{screen:'stage',stageId:'id',reusable:true,mode:'stock'})
  for(const query of ['?draw=1','?project=share-token','?savedProject=id','?view=projects'])assert.equal(workspaceRoute(query).screen,'workspace')
  assert.deepEqual(workspaceRoute('?join=invitation'),{screen:'invitation',token:'invitation'})
  assert.deepEqual(workspaceRoute('?stageShare=share'),{screen:'stage-share',token:'share'})
  assert.equal(new URL(workspaceUrl({event:'event-id'},'https://app.test/?band=token#private')).search,'?event=event-id')
})

test('Studio round trips preserve the originating workspace and reject external returns',()=>{
  const origin='https://app.test/planner?event=festival&profile=empire'
  const studio=studioLink('https://studio.test/',origin,'reviews')
  assert.equal(new URL(studio).searchParams.get('section'),'reviews')
  assert.equal(studioReturn('https://app.test/planner',studio),origin)
  for(const returnTo of ['https://evil.test/phish','javascript:alert(1)','https://app.test/another-app','https://user:pass@app.test/planner'])assert.equal(studioReturn('https://app.test/planner','https://studio.test/?returnTo='+encodeURIComponent(returnTo)),'https://app.test/planner')
})
