import { describe, expect, it, vi } from 'vitest';
import { runLinkDevelopmentPlugin } from '../../../scripts/link-development-plugin.mjs';

describe('development plugin link', () => {
  it('rejects a release-package conflict even when the correct link already exists', async () => {
    const doesPathExist = vi.fn(async () => true);
    const resolvePath = vi.fn(async () => '/repo/iina-jellyfin-integration');
    const runCli = vi.fn();

    await expect(
      runLinkDevelopmentPlugin({
        pluginRoot: '/repo/iina-jellyfin-integration',
        developmentLinkPath: '/plugins/iina-jellyfin-integration.iinaplugin-dev',
        pluginIdentifier: 'dev.germagla.iina-jellyfin',
        findConflicts: async () => ['/plugins/dev.germagla.iina-jellyfin.iinaplugin'],
        doesPathExist,
        resolvePath,
        runCli,
      }),
    ).rejects.toThrow('IINA already has dev.germagla.iina-jellyfin installed');

    expect(doesPathExist).not.toHaveBeenCalled();
    expect(resolvePath).not.toHaveBeenCalled();
    expect(runCli).not.toHaveBeenCalled();
  });

  it('keeps an existing correct link idempotent when there are no conflicts', async () => {
    const output = vi.fn();
    const runCli = vi.fn();

    await runLinkDevelopmentPlugin({
      pluginRoot: '/repo/iina-jellyfin-integration',
      developmentLinkPath: '/plugins/iina-jellyfin-integration.iinaplugin-dev',
      findConflicts: async () => [],
      doesPathExist: async () => true,
      resolvePath: async () => '/repo/iina-jellyfin-integration',
      runCli,
      writeStdout: output,
    });

    expect(output).toHaveBeenCalledWith(
      'IINA development plugin is already linked to /repo/iina-jellyfin-integration\n',
    );
    expect(runCli).not.toHaveBeenCalled();
  });
});
