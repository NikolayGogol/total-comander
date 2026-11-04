import { execSync } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'

export default async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return

  // Skip intermediate packaging temp directories created during universal builds
  if (context.appOutDir.endsWith('-temp')) {
    console.log(`[after-pack] Skipping intermediate temp directory: ${context.appOutDir}`)
    return
  }

  const appName = context.packager.appInfo.productFilename
  const appPath = path.join(context.appOutDir, `${appName}.app`)

  if (!fs.existsSync(appPath)) {
    console.warn(`[after-pack] App path not found: ${appPath}`)
    return
  }

  console.log(`[after-pack] Cleaning extended attributes: ${appPath}`)
  try {
    execSync(`xattr -cr "${appPath}"`, { stdio: 'inherit' })
  } catch (err) {
    console.warn(`[after-pack] Warning during xattr clean:`, err.message)
  }

  console.log(`[after-pack] Performing ad-hoc code signing for: ${appPath}`)
  try {
    execSync(`codesign --force --deep -s - "${appPath}"`, { stdio: 'inherit' })
    execSync(`codesign -vvv --deep --strict "${appPath}"`, { stdio: 'inherit' })
    console.log(`[after-pack] Code signing successfully validated!`)
  } catch (err) {
    console.error(`[after-pack] Error signing app bundle:`, err)
    throw err
  }
}
