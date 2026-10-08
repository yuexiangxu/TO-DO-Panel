const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow, screen } = require('electron');

const profile = process.env.TODO_TEST_USER_DATA;
app.commandLine.appendSwitch('user-data-dir', profile);
if (process.platform === 'darwin') app.commandLine.appendSwitch('use-mock-keychain');

const errors = [];
async function waitFor(read, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = read();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return null;
}

setTimeout(() => {
  console.error('Desktop pet test timed out', errors);
  app.exit(1);
}, 25000);

app.on('web-contents-created', (_event, contents) => {
  contents.on('console-message', (details) => {
    if (details.level === 'error') errors.push(`${details.message} (${details.sourceId}:${details.lineNumber})`);
  });
  contents.once('did-finish-load', () => {
    if (!contents.getURL().endsWith('/renderer/index.html')) return;
    setTimeout(async () => {
      try {
        await contents.executeJavaScript(`document.getElementById('desktop-pet-toggle').click()`);
        const petWindow = await waitFor(() => BrowserWindow.getAllWindows().find((candidate) =>
          candidate.webContents.getURL().endsWith('/renderer/pet.html')
        ));
        assert.ok(petWindow, 'pet window should be created');
        assert.equal(petWindow.isVisible(), true);
        assert.equal(petWindow.isAlwaysOnTop(), true);
        const display = screen.getDisplayMatching(petWindow.getBounds());
        const bounds = petWindow.getBounds();
        assert.ok(bounds.x >= display.workArea.x);
        assert.ok(bounds.y >= display.workArea.y);
        assert.ok(bounds.x + bounds.width <= display.workArea.x + display.workArea.width);
        assert.ok(bounds.y + bounds.height <= display.workArea.y + display.workArea.height);
        assert.equal(await contents.executeJavaScript(`document.getElementById('desktop-pet-toggle').getAttribute('aria-pressed')`), 'true');

        await petWindow.webContents.executeJavaScript(`document.getElementById('pet-hide').click()`);
        await waitFor(() => !petWindow.isVisible());
        assert.equal(petWindow.isVisible(), false);
        assert.equal(await contents.executeJavaScript(`document.getElementById('desktop-pet-toggle').getAttribute('aria-pressed')`), 'false');
        assert.deepEqual(errors, []);
        assert.equal(fs.existsSync(path.join(profile, 'desktop-pet.json')), true);
        console.log('Desktop pet toggle, placement and retract checks passed');
        app.quit();
      } catch (error) {
        console.error(error);
        app.exit(1);
      }
    }, 1200);
  });
});

require('../main.js');
