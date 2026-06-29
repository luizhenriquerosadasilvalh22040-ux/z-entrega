const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { detectImageExtension, UploadStorageService } = require('../dist/services/UploadStorageService');

const ONE_PIXEL_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lxvzcAAAAABJRU5ErkJggg==';

test('detectImageExtension detects PNG magic bytes', () => {
  assert.equal(detectImageExtension(Buffer.from(ONE_PIXEL_PNG, 'base64')), 'png');
  assert.equal(detectImageExtension(Buffer.from('not-an-image')), null);
});

test('storeImage rejects mismatched MIME and image bytes', async () => {
  await assert.rejects(
    () => UploadStorageService.storeImage(
      `data:image/jpeg;base64,${ONE_PIXEL_PNG}`,
      { actorType: 'merchant', actorId: 'merchant-1' },
      'https://cdn.example.com/uploads'
    ),
    /Tipo MIME da imagem não corresponde/
  );
});

test('storeImage writes local file under actor scoped key', async () => {
  const previousCwd = process.cwd();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'traz-upload-test-'));

  try {
    process.chdir(tmpDir);
    const stored = await UploadStorageService.storeImage(
      `data:image/png;base64,${ONE_PIXEL_PNG}`,
      { actorType: 'merchant', actorId: 'merchant-1' },
      'https://cdn.example.com/uploads'
    );

    assert.equal(stored.storageProvider, 'local');
    assert.equal(stored.contentType, 'image/png');
    assert.equal(stored.key.startsWith('merchant/merchant-1/'), true);
    assert.equal(stored.url.startsWith('https://cdn.example.com/uploads/merchant/merchant-1/'), true);
    assert.equal(fs.existsSync(path.join(tmpDir, 'uploads', stored.key)), true);
  } finally {
    process.chdir(previousCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
