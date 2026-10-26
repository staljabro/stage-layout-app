export function workspaceLabels(kind='festival') {
  if(kind==='production')return {singular:'client',plural:'clients',title:'Client layout',notes:'Production notes',invite:'client edit link'}
  if(kind==='eisteddfod')return {singular:'group',plural:'groups',title:'Group layouts',notes:'Group notes',invite:'group edit link'}
  return {singular:'band',plural:'bands',title:'Band plots',notes:'Band notes',invite:'band edit link'}
}
