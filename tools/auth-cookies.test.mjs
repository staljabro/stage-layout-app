import test from 'node:test'
import assert from 'node:assert/strict'
import {createAuthCookies} from './auth-cookies.mjs'

test('local login remains host-only and cookie deletion keeps the same path',()=>{
  const cookies=createAuthCookies({}),request={headers:{}}
  assert.ok(!cookies.session(request,'session',600).includes('Domain='))
  assert.ok(!cookies.oauth(request,'state',600).includes('Secure'))
  assert.match(cookies.session(request,'',0),/^stageplot_session=; Path=\/;.*Max-Age=0/)
  assert.match(cookies.oauth(request,'',0),/^stageplot_oauth=; Path=\/api\/auth\/github;.*Max-Age=0/)
})

test('sibling-domain session and OAuth cookies use the same secure scope on issue and deletion',()=>{
  const cookies=createAuthCookies({STAGEPLOT_COOKIE_DOMAIN:'.BRAITHWAITE.work',STAGEPLOT_APP_URL:'https://stageplot.braithwaite.work/',STAGEPLOT_STUDIO_URL:'https://stageplotstudio.braithwaite.work/',STAGEPLOT_GITHUB_CALLBACK_URL:'https://stageplot.braithwaite.work/api/auth/github/callback'})
  for(const name of ['session','oauth'])for(const [value,age] of [['opaque-value',600],['',0]]) {
    const cookie=cookies[name]({headers:{}},value,age)
    assert.ok(cookie.includes('Domain=braithwaite.work'))
    assert.ok(cookie.includes('; Secure'))
    assert.ok(cookie.includes('; HttpOnly; SameSite=Lax;'))
    assert.ok(cookie.includes('Max-Age='+age))
  }
})

test('invalid cookie domains and unrelated app addresses fail configuration',()=>{
  for(const domain of ['localhost','https://braithwaite.work','braithwaite.work:443','braithwaite.work/path','braithwaite.work; Secure','127.0.0.1'])assert.throws(()=>createAuthCookies({STAGEPLOT_COOKIE_DOMAIN:domain}))
  for(const key of ['STAGEPLOT_APP_URL','STAGEPLOT_STUDIO_URL','STAGEPLOT_GITHUB_CALLBACK_URL'])assert.throws(()=>createAuthCookies({STAGEPLOT_COOKIE_DOMAIN:'braithwaite.work',[key]:'https://notbraithwaite.work/'}),/must belong/)
})
