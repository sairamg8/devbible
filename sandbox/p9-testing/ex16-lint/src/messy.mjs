import { readFileSync } from 'node:fs'
const unused = 42
export async function load( path ) {
    let data = readFileSync(path,'utf8')
    if (data == '') { return null }
    return JSON.parse( data )
}
