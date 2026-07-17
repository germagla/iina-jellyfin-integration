import { execFile } from 'node:child_process';
import { lstat, readFile, readdir, realpath } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const root = path.resolve(import.meta.dirname, '..');
const manifest = JSON.parse(await readFile(path.join(root, 'Info.json'), 'utf8'));
const pluginDirectory = path.join(
  homedir(),
  'Library',
  'Application Support',
  'com.colliderli.iina',
  'plugins',
);
const linkPath = path.join(pluginDirectory, `${path.basename(root)}.iinaplugin-dev`);
const cli = '/Applications/IINA.app/Contents/MacOS/iina-plugin';

async function pathExists(candidate) {
  try {
    await lstat(candidate);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

async function installedPluginEntries() {
  try {
    return await readdir(pluginDirectory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
}

async function conflictingPackages() {
  const conflicts = [];
  for (const entry of await installedPluginEntries()) {
    if (
      entry.name === path.basename(linkPath) ||
      (!entry.name.endsWith('.iinaplugin') && !entry.name.endsWith('.iinaplugin-dev'))
    ) {
      continue;
    }

    const packagePath = path.join(pluginDirectory, entry.name);
    try {
      const installedManifest = JSON.parse(
        await readFile(path.join(packagePath, 'Info.json'), 'utf8'),
      );
      if (installedManifest.identifier === manifest.identifier) conflicts.push(packagePath);
    } catch {
      // IINA will report unrelated malformed packages. They cannot be safely
      // identified as a duplicate here.
    }
  }
  return conflicts;
}

export async function runLinkDevelopmentPlugin(options = {}) {
  const pluginRoot = options.pluginRoot ?? root;
  const developmentLinkPath = options.developmentLinkPath ?? linkPath;
  const pluginIdentifier = options.pluginIdentifier ?? manifest.identifier;
  const findConflicts = options.findConflicts ?? conflictingPackages;
  const doesPathExist = options.doesPathExist ?? pathExists;
  const resolvePath = options.resolvePath ?? realpath;
  const runCli = options.runCli ?? ((command, args) => exec(command, args));
  const writeStdout = options.writeStdout ?? ((value) => process.stdout.write(value));
  const writeStderr = options.writeStderr ?? ((value) => process.stderr.write(value));

  const conflicts = await findConflicts();
  if (conflicts.length > 0) {
    throw new Error(
      [
        `IINA already has ${pluginIdentifier} installed:`,
        ...conflicts.map((candidate) => `- ${candidate}`),
        'Uninstall or move that package before creating the development link.',
      ].join('\n'),
    );
  }

  if (await doesPathExist(developmentLinkPath)) {
    let target;
    try {
      target = await resolvePath(developmentLinkPath);
    } catch {
      throw new Error(`The existing development link is broken: ${developmentLinkPath}`);
    }
    if (target === pluginRoot) {
      writeStdout(`IINA development plugin is already linked to ${pluginRoot}\n`);
      return;
    }
    throw new Error(`A different development link already occupies ${developmentLinkPath}`);
  }

  const result = await runCli(cli, ['link', pluginRoot]);
  if (result.stdout !== '') writeStdout(result.stdout);
  if (result.stderr !== '') writeStderr(result.stderr);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runLinkDevelopmentPlugin();
}
