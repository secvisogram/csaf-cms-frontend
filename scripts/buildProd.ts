import { execFileSync } from 'node:child_process'
import { cp, stat } from 'node:fs/promises'

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
}
