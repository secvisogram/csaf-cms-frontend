import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cp, readFile, stat, writeFile } from 'node:fs/promises'

const editorDist =
  'vendor/secvisogram-editor/node_modules/@secvisogram/editor/dist'

if (!(await stat(editorDist).catch(() => null))?.isDirectory()) {
  console.error(
    `The Secvisogram editor is not installed (missing ${editorDist}). ` +
      'Run `npm ci` in vendor/secvisogram-editor first (see README).',
  )
  process.exitCode = 1
} else {
  execFileSync('npm run build', {
    stdio: 'inherit',
    env: { ...process.env, VITE_EMBED_EDITOR: 'true' },
    shell: true,
  })

  await cp(editorDist, 'build/client/secvisogram-editor', { recursive: true })

  // The edge's CSP allows the SPA shell's inline bootstrap scripts by hash.
  const shell = await readFile('build/client/index.html', 'utf8')
  const hashes = [
    ...shell.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g),
  ].map(
    ([, body]) =>
      `'sha256-${createHash('sha256').update(body!).digest('base64')}'`,
  )
  if (hashes.length === 0) {
    throw new Error('No inline scripts found in build/client/index.html')
  }
  await writeFile('build/csp-script-hashes.txt', hashes.join(' '))
}
