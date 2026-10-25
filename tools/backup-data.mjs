import {DatabaseSync,backup} from 'node:sqlite'
import {resolve} from 'node:path'

const [source,destination]=process.argv.slice(2)
if(!source || !destination)throw new Error('Usage: node tools/backup-data.mjs path/to/stageplot.sqlite path/to/backup.sqlite')
if(resolve(source)===resolve(destination))throw new Error('Choose a different destination for the backup')
const database=new DatabaseSync(resolve(source),{readOnly:true})
try {await backup(database,resolve(destination));console.log('Database backup complete')}finally{database.close()}
