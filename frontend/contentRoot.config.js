import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const workspaceRoot = path.resolve(repoRoot, '..')
const canonicalContentRoot = path.join(workspaceRoot, 'ks-content')

export const contentRoot = fs.existsSync(canonicalContentRoot) ? canonicalContentRoot : path.join(workspaceRoot, 'content')
