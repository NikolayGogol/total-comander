const fs = require('fs')
const path = require('path')

const pkgPath = path.resolve(__dirname, '../package.json')
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))

const now = new Date()
const pad = (n) => String(n).padStart(2, '0')
const year = now.getFullYear()
const month = pad(now.getMonth() + 1)
const day = pad(now.getDate())
const hours = pad(now.getHours())
const minutes = pad(now.getMinutes())
const seconds = pad(now.getSeconds())

const buildNumber = `${year}.${month}.${day}.${hours}${minutes}`
const buildDate = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`

const content = `// Auto-generated during build. Do not edit manually.
export const APP_VERSION = '${pkg.version}'
export const BUILD_NUMBER = '${buildNumber}'
export const BUILD_DATE = '${buildDate}'
`

const outPath = path.resolve(__dirname, '../src/buildInfo.ts')
fs.writeFileSync(outPath, content, 'utf-8')
console.log(`[build-info] Version ${pkg.version} (build ${buildNumber}) written to ${outPath}`)
