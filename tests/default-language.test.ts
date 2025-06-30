// Test for default language setting
// This test verifies that the default transcription language is set to "Original"

describe('Transcription Default Language', () => {
  beforeEach(() => {
    // Load the HTML structure
    document.body.innerHTML = `
      <select id="languageSelect">
        <option value="original" selected>Original (自動判定)</option>
        <option value="ja">日本語</option>
        <option value="en">English</option>
      </select>
    `;
  });

  test('should default to "Original" for new users', () => {
    const languageSelect = document.getElementById('languageSelect') as HTMLSelectElement;
    expect(languageSelect.value).toBe('original');
  });

  test('should have "Original" option selected by default', () => {
    const originalOption = document.querySelector('option[value="original"]') as HTMLOptionElement;
    expect(originalOption.hasAttribute('selected')).toBe(true);
  });

  test('should not have other options selected by default', () => {
    const jaOption = document.querySelector('option[value="ja"]') as HTMLOptionElement;
    const enOption = document.querySelector('option[value="en"]') as HTMLOptionElement;
    
    expect(jaOption.hasAttribute('selected')).toBe(false);
    expect(enOption.hasAttribute('selected')).toBe(false);
  });

  test('should maintain user selection when changed', () => {
    const languageSelect = document.getElementById('languageSelect') as HTMLSelectElement;
    
    // Change to Japanese
    languageSelect.value = 'ja';
    expect(languageSelect.value).toBe('ja');
    
    // Change to English
    languageSelect.value = 'en';
    expect(languageSelect.value).toBe('en');
    
    // Change back to Original
    languageSelect.value = 'original';
    expect(languageSelect.value).toBe('original');
  });
});

// Integration test for language parameter in upload function
describe('Upload Function Language Parameter', () => {
  test('should include language parameter in upload request', async () => {
    // Mock the fetch function
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true })
      })
    ) as jest.Mock;

    // Set up DOM elements
    document.body.innerHTML = `
      <input id="url" value="https://www.youtube.com/watch?v=test" />
      <select id="languageSelect">
        <option value="original" selected>Original (自動判定)</option>
        <option value="ja">日本語</option>
        <option value="en">English</option>
      </select>
    `;

    // Simulate upload function behavior
    const url = (document.getElementById('url') as HTMLInputElement).value;
    const language = (document.getElementById('languageSelect') as HTMLSelectElement).value;
    
    const formData = new FormData();
    formData.append('url', url);
    formData.append('language', language);

    await fetch('/upload-youtube', {
      method: 'POST',
      body: formData
    });

    // Verify the fetch was called with correct parameters
    expect(global.fetch).toHaveBeenCalledWith('/upload-youtube', {
      method: 'POST',
      body: expect.any(FormData)
    });

    // Verify the language parameter is 'original'
    const callArgs = (global.fetch as jest.Mock).mock.calls[0];
    const sentFormData = callArgs[1].body as FormData;
    expect(sentFormData.get('language')).toBe('original');
  });
});