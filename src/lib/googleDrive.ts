export async function uploadToGoogleDrive(
  file: File,
  token: string
): Promise<string | null> {
  const metadata = {
    name: file.name,
    mimeType: file.type
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file);

  try {
    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: form
    });

    const result = await response.json();
    return result.id;
  } catch {
    return null;
  }
}

export async function createGoogleSheet(
  title: string,
  data: any[][],
  token: string
): Promise<string | null> {
  try {
    const spreadsheet = {
      properties: {
        title: title
      }
    };

    const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(spreadsheet)
    });

    const result = await response.json();
    const spreadsheetId = result.spreadsheetId;

    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: data
        })
      }
    );

    return spreadsheetId;
  } catch {
    return null;
  }
}
