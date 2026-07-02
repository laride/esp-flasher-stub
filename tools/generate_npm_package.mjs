// @ts-check

// Without a local TS project or @types/node, keep the Node built-in imports
// as narrowly suppressed as possible and still type-check the rest of the file.

// @ts-ignore
import { cp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
// @ts-ignore
import path from 'node:path';

const REPO_URL = 'https://github.com/espressif/esp-flasher-stub';
const PACKAGE_NAME = 'esp-flasher-stub';

/**
 * @typedef {object} Options
 * @property {string} version
 * @property {string} stubDir
 * @property {string} outDir
 */

/**
 * @param {string[]} argv
 * @returns {Options}
 */
function parseArgs(argv) {
  /** @type {Partial<Options>} */
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];

    if (!value) {
      throw new Error(`Missing value for argument: ${key}`);
    }

    switch (key) {
      case '--version':
        options.version = value;
        break;
      case '--stub-dir':
        options.stubDir = value;
        break;
      case '--out-dir':
        options.outDir = value;
        break;
      default:
        throw new Error(`Unknown argument: ${key}`);
    }

    index += 1;
  }

  if (!options.version || !options.stubDir || !options.outDir) {
    throw new Error('Usage: node tools/generate_npm_package.mjs --version <version> --stub-dir <dir> --out-dir <dir>');
  }

  return /** @type {Options} */ (options);
}

/**
 * @param {string} stubDir
 * @returns {Promise<string[]>}
 */
async function collectStubFiles(stubDir) {
  const entries = await readdir(stubDir, { recursive: true, withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.parentPath ? path.join(entry.parentPath, entry.name) : path.join(stubDir, entry.name))
    .filter((filePath) => filePath.endsWith('.json'))
    .filter((filePath) => !filePath.endsWith('.base.json'))
    .filter((filePath) => path.basename(filePath).startsWith('esp'))
    .sort((left, right) => left.localeCompare(right));
}

/**
 * @param {string} version
 * @returns {string}
 */
function buildReadme(version) {
  const releaseTagUrl = `${REPO_URL}/releases/tag/v${version}`;
  const licenseYears = new Date().getFullYear() === 2026 ? '2026' : `2026-${new Date().getFullYear()}`;

  return `# esp-flasher-stub

ESP Flasher Stub is a set of small firmware programs (stubs) that run on Espressif ESP chips \
to enable fast and reliable flash programming via [esptool](https://github.com/espressif/esptool/).

## This Package

This npm package (\`${PACKAGE_NAME}\`) distributes the pre-built stub JSON files for all supported \
ESP chips. These files are consumed by esptool to upload the flasher stub into the chip's RAM at \
runtime.

## More Information

For full documentation, supported chips, build instructions, and contribution guidelines, \
visit the GitHub repository: ${REPO_URL}

This package is based on **v${version}**. See the release notes at: ${releaseTagUrl}

## License

Copyright (c) ${licenseYears} Espressif Systems (Shanghai) Co., Ltd.

See https://github.com/espressif/esp-flasher-stub#license for the license of the source code.
`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const stubFiles = await collectStubFiles(options.stubDir);

  if (stubFiles.length === 0) {
    throw new Error(`No stub JSON files found in ${options.stubDir}`);
  }

  const packageJson = {
    name: PACKAGE_NAME,
    version: options.version,
    description: 'Stub JSON files for ESP flasher',
    exports: {
      './*.json': './*.json',
    },
    files: [
      '*.json',
      'README.md',
    ],
    publishConfig: {
      access: 'public',
    },
    keywords: [
      'esp',
      'espressif',
      'esptool',
    ],
    license: 'Apache-2.0 OR MIT',
    type: 'module',
    repository: {
      type: 'git',
      url: `git+${REPO_URL}.git`,
    },
    homepage: REPO_URL,
  };

  await rm(options.outDir, { force: true, recursive: true });
  await mkdir(options.outDir, { recursive: true });

  await writeFile(
    path.join(options.outDir, 'package.json'),
    `${JSON.stringify(packageJson, null, 2)}\n`,
    'utf8',
  );
  await writeFile(path.join(options.outDir, 'README.md'), buildReadme(options.version), 'utf8');

  for (const stubFile of stubFiles) {
    await cp(stubFile, path.join(options.outDir, path.basename(stubFile)));
  }
}

await main();
